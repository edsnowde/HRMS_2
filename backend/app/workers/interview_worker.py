"""
Interview worker for managing asynchronous interview processes.
Handles question generation, timing, response evaluation, and retry logic.
"""

import time
import json
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from app.workers.celery_app import celery
import google.generativeai as genai
from app.config import settings
from app.services.prompt_templates import PromptTemplates
from app.services.audit import AuditService
from app.services.scorer import LLMScoringService
from app.services.notifier import NotificationService
from app.services.embedder import EmbedderService
from app.services.cache import CacheService
from app.database import AsyncMongoClient

# Initialize services
audit_service = AuditService()
scorer_service = LLMScoringService()
notifier = NotificationService()
embedder = EmbedderService()
cache = CacheService()

logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=settings.gemini_api_key)
model = genai.GenerativeModel('gemini-2.5-flash')

class InterviewSession:
    """Manages state for a single interview session."""
    
    def __init__(self, session_id: str, application_id: str):
        self.session_id = session_id
        self.application_id = application_id
        self.questions: List[Dict[str, Any]] = []
        self.current_question = 0
        self.start_time: Optional[datetime] = None
        self.responses: Dict[str, Any] = {}
        self.scores: Dict[str, Any] = {}
        self.status = "initialized"
        self.retries = 0
        self.max_retries = 3
        self.time_limit_per_question = 60  # Default 60 seconds
        self.question_start_time: Optional[datetime] = None
        self.timer_warnings = []
        
    def start_question_timer(self):
        """Start timer for current question."""
        self.question_start_time = datetime.utcnow()
        self.timer_warnings = []
        
    def check_time_remaining(self) -> Dict[str, Any]:
        """Check remaining time for current question."""
        # Always return the same keys so callers don't KeyError
        if not self.question_start_time:
            return {"status": "not_started", "remaining": self.time_limit_per_question, "elapsed": 0}

        elapsed = (datetime.utcnow() - self.question_start_time).total_seconds()
        remaining = max(0, self.time_limit_per_question - elapsed)

        status = "in_progress"
        if remaining <= 0:
            status = "time_up"
        elif remaining <= 10 and "10_seconds" not in self.timer_warnings:
            self.timer_warnings.append("10_seconds")
            status = "warning_10"
        elif remaining <= 30 and "30_seconds" not in self.timer_warnings:
            self.timer_warnings.append("30_seconds")
            status = "warning_30"

        return {
            "status": status,
            "remaining": int(remaining),
            "elapsed": int(elapsed)
        }
        
    def is_answer_timed_out(self) -> bool:
        """Check if current question has timed out."""
        if not self.question_start_time:
            return False
            
        elapsed = (datetime.utcnow() - self.question_start_time).total_seconds()
        return elapsed >= self.time_limit_per_question

    def to_dict(self) -> Dict[str, Any]:
        """Convert session to dict for storage."""
        return {
            "session_id": self.session_id,
            "application_id": self.application_id,
            "questions": self.questions,
            "current_question": self.current_question,
            "start_time": self.start_time,
            "responses": self.responses,
            "scores": self.scores,
            "status": self.status,
            "retries": self.retries,
            "question_start_time": self.question_start_time,
            "time_limit_per_question": self.time_limit_per_question,
            "timer_warnings": self.timer_warnings,
            "timestamp": datetime.utcnow()
        }

async def generate_interview_questions_async(
    application_id: str,
    job_id: str,
    role_type: str = "technical",
    time_per_question: int = 60
) -> Dict[str, Any]:
    """
    Generate interview questions for an application.
    
    Args:
        application_id: ID of the application
        job_id: ID of the job
        role_type: Type of role (technical, non-technical, leadership)
        time_per_question: Time in seconds per question
        
    Returns:
        Dict with session_id and questions
    """
    try:
        # Get application and job details
        # Use explicit database name to avoid Motor's get_default_database
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]

            # Resolve application by either `application_id` (business id) or `_id` (Mongo ObjectId)
            try:
                from bson import ObjectId
                or_clause = [{"application_id": application_id}]
                if ObjectId.is_valid(application_id):
                    or_clause.append({"_id": ObjectId(application_id)})
            except Exception:
                or_clause = [{"application_id": application_id}]

            application = await db.applications.find_one({"$or": or_clause})

            # Resolve job similarly: job may be stored as `job_id` or `_id`
            try:
                from bson import ObjectId as _OID
                job_or = [{"job_id": job_id}]
                if _OID.is_valid(job_id):
                    job_or.append({"_id": _OID(job_id)})
            except Exception:
                job_or = [{"job_id": job_id}]

            job = await db.jobs.find_one({"$or": job_or})
            
            if not application or not job:
                raise ValueError("Application or job not found")
                
            # Create interview session
            session_id = f"interview_{application_id}_{int(time.time())}"
            session = InterviewSession(session_id, application_id)
            
            # Generate questions
            prompt = PromptTemplates.get_interview_question_generator_prompt(
                job_description=job.get("description", ""),
                candidate_resume=application.get("resume_text", ""),
                role_type=role_type,
                time_per_question=time_per_question
            )
            
            # Get questions with retries
            for attempt in range(3):
                try:
                    response = model.generate_content(prompt)

                    # Try to extract text/content from various response shapes
                    raw_text = None
                    try:
                        if hasattr(response, 'text') and getattr(response, 'text'):
                            raw_text = getattr(response, 'text')
                        elif hasattr(response, 'content') and getattr(response, 'content'):
                            raw_text = getattr(response, 'content')
                        elif hasattr(response, 'candidates') and getattr(response, 'candidates'):
                            cand = response.candidates[0]
                            if isinstance(cand, dict):
                                raw_text = cand.get('content') or cand.get('text') or str(cand)
                            else:
                                raw_text = str(cand)
                        else:
                            # Fallback to string representation
                            raw_text = str(response)
                    except Exception as extract_err:
                        raw_text = str(response)
                        logger.debug(f"Failed to introspect Gemini response: {extract_err}")

                    # If raw_text is empty, treat as failure
                    if not raw_text or not raw_text.strip():
                        logger.error("Gemini returned empty response when generating questions")
                        audit_service.log_error(operation="generate_interview_empty_response", entity_id=application_id, error=str(response))
                        raise ValueError("Empty response from Gemini")

                    # Attempt to find JSON array in raw_text
                    questions = None
                    try:
                        # Prefer direct parse
                        questions = json.loads(raw_text)
                    except Exception:
                        # Try to extract the first JSON array block present in the string
                        start = raw_text.find('[')
                        end = raw_text.rfind(']')
                        if start != -1 and end != -1 and end > start:
                            snippet = raw_text[start:end+1]
                            try:
                                questions = json.loads(snippet)
                            except Exception as e_parse:
                                logger.error(f"JSON parsing failed for extracted snippet: {e_parse}")
                                audit_service.log_error(operation="generate_interview_json_parse_error", entity_id=application_id, error=f"parse_error:{e_parse}; raw:{raw_text[:200]}")
                                raise
                        else:
                            logger.error("No JSON array found in Gemini response")
                            audit_service.log_error(operation="generate_interview_no_json", entity_id=application_id, error=raw_text[:500])
                            raise ValueError("No JSON array found in Gemini response")

                    if not questions or not isinstance(questions, list):
                        raise ValueError("Invalid question format: expected a JSON array of questions")

                    # Store questions
                    processed = []
                    now_ts = datetime.utcnow()
                    for idx, q in enumerate(questions):
                        # Extract text from either 'text' or 'question' field (Gemini returns 'question')
                        if isinstance(q, dict):
                            text = q.get("text") or q.get("question") or str(q)
                        else:
                            text = q if isinstance(q, str) else str(q)
                        # Extract question ID from various possible field names
                        qid = (q.get("qid") if isinstance(q, dict) else None) or \
                              (q.get("id") if isinstance(q, dict) else None) or \
                              (q.get("question_id") if isinstance(q, dict) else None) or \
                              f"Q{idx+1}"
                        expires_at = now_ts + timedelta(seconds=time_per_question)
                        processed.append({
                            "qid": qid,
                            "text": text,
                            "expires_at": expires_at,
                            "role_type": role_type
                        })

                    session.questions = processed
                    session.status = "questions_generated"

                    # Save session
                    await db.interview_sessions.insert_one(session.to_dict())

                    # Persist questions into the application document so frontend can read them
                    try:
                        # Reuse the application lookup OR clause to match either business id or ObjectId
                        try:
                            from bson import ObjectId
                            update_or = [{"application_id": application_id}]
                            if ObjectId.is_valid(application_id):
                                update_or.append({"_id": ObjectId(application_id)})
                        except Exception:
                            update_or = [{"application_id": application_id}]

                        # Log the query and data being persisted for debugging
                        update_data = {
                            "gemini_questions": [
                                {"qid": q["qid"], "text": q["text"], "expires_at": q["expires_at"]} for q in session.questions
                            ],
                            "stage": "interview",
                            "updated_at": datetime.utcnow()
                        }
                        logger.info(f"Persisting questions for {application_id}: update_or={update_or}, num_questions={len(session.questions)}")
                        logger.debug(f"Question texts: {[q.get('text', '')[:50] for q in session.questions]}")

                        result = await db.applications.update_one(
                            {"$or": update_or},
                            {"$set": update_data},
                            upsert=False
                        )
                        logger.info(f"MongoDB update result: matched_count={result.matched_count}, modified_count={result.modified_count}, application_id={application_id}")
                        if result.matched_count == 0:
                            logger.error(f"No application matched for update! application_id={application_id}, update_or={update_or}")
                        if result.modified_count == 0:
                            logger.warning(f"Application matched but not modified (data unchanged?): {application_id}")
                    except Exception as e:
                        logger.error(f"Failed to persist generated questions to application {application_id}: {e}")
                        audit_service.log_error(
                            operation="persist_generated_questions",
                            entity_id=application_id,
                            error=str(e)
                        )

                    # Notify application update
                    try:
                        notifier.publish_event("interview_ready", job.get("job_id") or str(job.get("_id")), {
                            "application_id": application_id,
                            "session_id": session_id,
                            "questions": [
                                {"qid": q["qid"], "text": q["text"], "expires_at": q["expires_at"].isoformat()} for q in session.questions
                            ]
                        })
                    except Exception as e:
                        logger.error(f"Failed to publish interview_ready event for {application_id}: {e}")
                        audit_service.log_error(
                            operation="publish_interview_ready",
                            entity_id=application_id,
                            error="failed to publish interview_ready"
                        )

                    return {
                        "session_id": session_id,
                        "questions": questions,
                        "application_id": application_id,
                        "status": "ready"
                    }

                except Exception as e:
                    logger.warning(f"Attempt {attempt+1} to generate questions failed: {e}")
                    if attempt == 2:  # Last attempt
                        logger.error(f"All attempts failed for application {application_id}")
                        raise
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                    
    except Exception as e:
        audit_service.log_error(
            operation="generate_interview_questions",
            entity_id=application_id,
            error=str(e)
        )
        # Let the caller/wrapper decide on retries; propagate exception
        raise


@celery.task(bind=True, max_retries=3)
def generate_interview_questions(self, application_id: str, job_id: str, role_type: str = "technical", time_per_question: int = 60) -> Dict[str, Any]:
    """Synchronous Celery task wrapper for generating interview questions."""
    try:
        return asyncio.run(generate_interview_questions_async(application_id, job_id, role_type, time_per_question))
    except Exception as e:
        audit_service.log_error(
            operation="generate_interview_questions",
            entity_id=application_id,
            error=str(e)
        )
        raise self.retry(exc=e, countdown=5)

async def evaluate_interview_response_async(
    session_id: str,
    question_id: str,
    response_text: str,
    audio_url: Optional[str] = None,
    transcript: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluate a candidate's interview response.
    
    Args:
        session_id: Interview session ID
        question_id: Question being answered
        response_text: Candidate's response text
        audio_url: Optional URL to audio recording
        transcript: Optional full interview transcript
        
    Returns:
        Dict with score and feedback
    """
    try:
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]
            
            # Get session
            session_data = await db.interview_sessions.find_one({"session_id": session_id})
            if not session_data:
                raise ValueError("Interview session not found")
                
            session = InterviewSession(
                session_id=session_data["session_id"],
                application_id=session_data["application_id"]
            )
            session.__dict__.update(session_data)
            
            # Find the question - defensive lookup supporting multiple field names (qid, id, question_id)
            question = None
            for q in session.questions:
                if q.get("qid") == question_id or q.get("id") == question_id or q.get("question_id") == question_id:
                    question = q
                    break
            
            if not question:
                logger.error(f"Question not found for question_id={question_id}. Available questions: {[q.get('qid') or q.get('id') or q.get('question_id') for q in session.questions]}")
                raise ValueError(f"Question not found for question_id={question_id}")

            # Check for timeout
            if session.is_answer_timed_out():
                # Timed-out responses get zero score; use structured feedback dict
                score = 0
                feedback = {
                    "score": 0,
                    "time_penalty": 0,
                    "criteria_scores": {
                        "technical_accuracy": {"score": 0, "weight": 0},
                        "communication": {"score": 0, "weight": 0},
                        "problem_solving": {"score": 0, "weight": 0}
                    },
                    "timing": {
                        "elapsed": session.time_limit_per_question,
                        "limit": session.time_limit_per_question,
                        "overtime": 0
                    },
                    "message": f"Response submitted after time limit. Maximum time allowed was {session.time_limit_per_question} seconds."
                }
                attempt = 1
            else:
                # Extract question text defensively from various possible field names
                question_text = question.get("text") or question.get("question") or question.get("content") or ""
                logger.debug(f"Question text extracted: {question_text[:100] if question_text else '(empty)'}")
                
                # Ensure question has default scoring criteria if missing
                if "scoring_criteria" not in question:
                    question["scoring_criteria"] = {
                        "technical_accuracy": {"weight": 60, "rubric": "Accuracy and depth of technical knowledge"},
                        "communication": {"weight": 40, "rubric": "Clarity, structure, and articulation"},
                        "problem_solving": {"weight": 0, "rubric": "Problem-solving approach"},
                        "time_management": {"grace_period": 5, "penalty_per_second": 0.5}
                    }
                    logger.debug(f"Assigned default scoring_criteria to question {question_id}")
                
                if "expected_answer_points" not in question:
                    question["expected_answer_points"] = 10
                    logger.debug(f"Assigned default expected_answer_points=10 to question {question_id}")
                
                # Get application and job (support application_id or _id)
                try:
                    from bson import ObjectId
                    app_or = [{"application_id": session.application_id}]
                    if ObjectId.is_valid(str(session.application_id)):
                        app_or.append({"_id": ObjectId(session.application_id)})
                except Exception:
                    app_or = [{"application_id": session.application_id}]

                logger.debug(f"Querying application with $or={app_or}")
                application = await db.applications.find_one({"$or": app_or})
                logger.debug(f"Application query result: {'found' if application else 'not found'}")

                # Resolve job robustly
                job_id_val = None
                if application:
                    job_id_val = application.get("job_id") or application.get("job", {}).get("job_id") or application.get("job", {}).get("_id")

                try:
                    from bson import ObjectId as _OID
                    job_or = [{"job_id": job_id_val}]
                    if job_id_val and _OID.is_valid(str(job_id_val)):
                        job_or.append({"_id": _OID(job_id_val)})
                except Exception:
                    job_or = [{"job_id": job_id_val}]

                job = await db.jobs.find_one({"$or": job_or})
                
                # Calculate time-based penalty
                time_data = session.check_time_remaining()
                elapsed_time = time_data.get("elapsed", 0)
                time_penalty = 0
                
                if elapsed_time > session.time_limit_per_question:
                    grace_period = question["scoring_criteria"].get("time_management", {}).get("grace_period", 5)
                    penalty_per_second = question["scoring_criteria"].get("time_management", {}).get("penalty_per_second", 0.5)
                    overtime = elapsed_time - session.time_limit_per_question
                    if overtime > grace_period:
                        time_penalty = min(30, (overtime - grace_period) * penalty_per_second)

                # Score response with retries. Use the service's `score_response` (blocking)
                for attempt in range(session.max_retries):
                    try:
                        q_text = question.get("text") or question.get("question") or question.get("content") or ""

                        # scorer_service.score_response returns (score_0_10, feedback_text)
                        tech_raw, tech_feedback = await asyncio.to_thread(
                            scorer_service.score_response,
                            q_text,
                            response_text,
                            application.get("job_description", "") if application else "",
                            transcript
                        )

                        comm_raw, comm_feedback = await asyncio.to_thread(
                            scorer_service.score_response,
                            q_text,
                            response_text,
                            application.get("job_description", "") if application else "",
                            transcript
                        )

                        ps_raw, ps_feedback = await asyncio.to_thread(
                            scorer_service.score_response,
                            q_text,
                            response_text,
                            application.get("job_description", "") if application else "",
                            transcript
                        )

                        # Normalize 0-10 scale to 0-100
                        technical_score = float(tech_raw) * 10
                        communication_score = float(comm_raw) * 10
                        problem_solving_score = float(ps_raw) * 10

                        weights = question.get("scoring_criteria", {})
                        t_w = weights.get("technical_accuracy", {}).get("weight", 60)
                        c_w = weights.get("communication", {}).get("weight", 40)
                        p_w = weights.get("problem_solving", {}).get("weight", 0)

                        weighted_score = (
                            (technical_score * t_w / 100) +
                            (communication_score * c_w / 100) +
                            (problem_solving_score * p_w / 100)
                        )

                        final_score = max(0, weighted_score - time_penalty)

                        feedback = {
                            "score": round(final_score, 2),
                            "time_penalty": round(time_penalty, 2),
                            "criteria_scores": {
                                "technical_accuracy": {"score": round(technical_score, 2), "weight": t_w},
                                "communication": {"score": round(communication_score, 2), "weight": c_w},
                                "problem_solving": {"score": round(problem_solving_score, 2), "weight": p_w}
                            },
                            "timing": {
                                "elapsed": elapsed_time,
                                "limit": session.time_limit_per_question,
                                "overtime": max(0, elapsed_time - session.time_limit_per_question)
                            },
                            "tech_feedback": tech_feedback,
                            "comm_feedback": comm_feedback,
                            "ps_feedback": ps_feedback
                        }

                        break
                    except Exception as e:
                        logger.exception(f"Scoring attempt {attempt+1} failed: {e}")
                        if attempt == session.max_retries - 1:
                            raise
                        await asyncio.sleep(2 ** attempt)
            
            # Store response and detailed score
            session.responses[question_id] = {
                "text": response_text,
                "audio_url": audio_url,
                "transcript": transcript,
                "timing": {
                    "started_at": session.question_start_time,
                    "completed_at": datetime.utcnow(),
                    "elapsed_seconds": elapsed_time
                }
            }
            
            session.scores[question_id] = {
                "final_score": feedback.get("score", 0),
                "time_penalty": feedback.get("time_penalty", 0),
                "criteria_scores": feedback.get("criteria_scores", {}),
                "timing": feedback.get("timing", {}),
                "timestamp": datetime.utcnow(),
                "attempt": attempt + 1,
                "question_type": question.get("type", "unknown"),
                "difficulty_level": question.get("difficulty_level", "unknown")
            }
            
            # Update session with aggregated statistics
            total_questions_answered = len(session.scores)
            avg_technical_score = sum(
                s["criteria_scores"]["technical_accuracy"]["score"] 
                for s in session.scores.values()
            ) / total_questions_answered if total_questions_answered > 0 else 0
            
            avg_communication_score = sum(
                s["criteria_scores"]["communication"]["score"]
                for s in session.scores.values()
            ) / total_questions_answered if total_questions_answered > 0 else 0
            
            avg_problem_solving_score = sum(
                s["criteria_scores"]["problem_solving"]["score"]
                for s in session.scores.values()
            ) / total_questions_answered if total_questions_answered > 0 else 0
            
            await db.interview_sessions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "responses": session.responses,
                    "scores": session.scores,
                    "statistics": {
                        "total_questions": len(session.questions),
                        "questions_answered": total_questions_answered,
                        "avg_technical_score": round(avg_technical_score, 2),
                        "avg_communication_score": round(avg_communication_score, 2),
                        "avg_problem_solving_score": round(avg_problem_solving_score, 2),
                        "total_time": sum(
                            s["timing"]["elapsed"] 
                            for s in session.scores.values()
                        ),
                        "last_updated": datetime.utcnow()
                    }
                }}
            )

            # Also persist feedback and score into the application document's gemini_answers
            try:
                try:
                    from bson import ObjectId
                    app_or = [{"application_id": session.application_id}]
                    if ObjectId.is_valid(str(session.application_id)):
                        app_or.append({"_id": ObjectId(session.application_id)})
                except Exception:
                    app_or = [{"application_id": session.application_id}]

                qid_val = question.get("qid") or question.get("id") or question.get("question_id") or question_id

                # Prefer array_filters-based update to avoid ambiguity with positional operator
                update_result = await db.applications.update_one(
                    {"$or": app_or},
                    {"$set": {
                        "gemini_answers.$[elem].feedback": feedback,
                        "gemini_answers.$[elem].score": feedback.get("score", 0),
                        "gemini_answers.$[elem].evaluated_at": datetime.utcnow()
                    }},
                    array_filters=[{"elem.qid": qid_val, "elem.session_id": session_id}]
                )

                # Log result for diagnostics
                logger.info("Attempted array_filters update for gemini_answers",
                            extra={"app_id": session.application_id, "qid": qid_val, "session_id": session_id, "matched": getattr(update_result, "matched_count", None), "modified": getattr(update_result, "modified_count", None)})

                if update_result.matched_count == 0:
                    # No existing array element matched for (qid + session_id).
                    # Try a broader update by matching only on qid (covers older entries without session_id)
                    try:
                        alt_update = await db.applications.update_one(
                            {"$or": app_or},
                            {"$set": {
                                "gemini_answers.$[elem].feedback": feedback,
                                "gemini_answers.$[elem].score": feedback.get("score", 0),
                                "gemini_answers.$[elem].evaluated_at": datetime.utcnow(),
                                "gemini_answers.$[elem].session_id": session_id
                            }},
                            array_filters=[{"elem.qid": qid_val}]
                        )
                        logger.info("Attempted array_filters update for gemini_answers (qid-only)",
                                    extra={"app_id": session.application_id, "qid": qid_val, "matched": getattr(alt_update, "matched_count", None), "modified": getattr(alt_update, "modified_count", None)})
                    except Exception:
                        alt_update = None

                    if alt_update and getattr(alt_update, "matched_count", 0) > 0:
                        # Successfully updated an existing element matched by qid; nothing more to do
                        pass
                    else:
                        # No matching element found even by qid; push a new entry with feedback
                        answer_with_feedback = {
                            "qid": qid_val,
                            "question": question.get("text") or question.get("question") or "",
                            "answer": response_text,
                            "audio_url": audio_url,
                            "transcript": transcript,
                            "session_id": session_id,
                            "submitted_at": datetime.utcnow(),
                            "feedback": feedback,
                            "score": feedback.get("score", 0),
                            "evaluated_at": datetime.utcnow()
                        }
                        push_res = await db.applications.update_one(
                            {"$or": app_or},
                            {"$push": {"gemini_answers": answer_with_feedback}}
                        )
                        logger.info("Pushed new gemini_answers entry as fallback",
                                    extra={"app_id": session.application_id, "qid": qid_val, "push_result": getattr(push_res, "raw_result", None)})
            except Exception:
                logger.exception(f"Failed to persist feedback to applications.gemini_answers for application_id={session.application_id}, session={session_id}, qid={question_id}")
            
            # Store in vector DB for analysis
            metadata = {
                "type": "interview_qa",
                "session_id": session_id,
                "application_id": session.application_id,
                "job_id": application["job_id"],
                "question_id": question_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            vector_id = f"interview_{session_id}_{question_id}"
            try:
                q_text_for_vec = question.get("text") or question.get("question") or question.get("content") or ""
                embedder.upsert_to_pinecone(
                    vector_id=vector_id,
                    text=f"Q: {q_text_for_vec}\nA: {response_text}",
                    metadata=metadata
                )
            except Exception:
                logger.exception("Failed to upsert QA pair to vector DB")
            
            # Check if interview is complete
            completed_questions = len(session.scores)
            total_questions = len(session.questions)
            
            if completed_questions == total_questions:
                await finalize_interview(session_id)
                
            return {
                "question_id": question_id,
                "score": feedback.get("score", 0),
                "feedback": feedback,
                "status": "complete" if completed_questions == total_questions else "in_progress",
                "progress": f"{completed_questions}/{total_questions}"
            }
            
    except Exception as e:
        audit_service.log_error(
            operation="evaluate_interview_response",
            entity_id=session_id,
            error=str(e)
        )
        # Propagate exception to wrapper for retry handling
        raise


@celery.task(bind=True)
def evaluate_interview_response(self, session_id: str, question_id: str, response_text: str, audio_url: Optional[str] = None, transcript: Optional[str] = None) -> Dict[str, Any]:
    """Synchronous Celery wrapper for evaluating an interview response."""
    try:
        return asyncio.run(evaluate_interview_response_async(session_id, question_id, response_text, audio_url, transcript))
    except Exception as e:
        audit_service.log_error(
            operation="evaluate_interview_response",
            entity_id=session_id,
            error=str(e)
        )
        raise self.retry(exc=e, countdown=5)

async def finalize_interview(session_id: str):
    """Calculate final interview scores and update application with detailed statistics."""
    try:
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]

            session_data = await db.interview_sessions.find_one({"session_id": session_id})
            if not session_data:
                raise ValueError("Interview session not found")

            logger.info(f"finalize_interview: session_id={session_id}, application_id={session_data.get('application_id')}")

            # Get all scores and statistics
            scores = session_data.get("scores", {})
            statistics = session_data.get("statistics", {})
            if not scores or not statistics:
                logger.warning(f"finalize_interview: no scores or statistics to finalize for session={session_id}")
                return

            logger.debug(f"finalize_interview: scores={len(scores)}, statistics keys={list(statistics.keys())}")

            # Calculate comprehensive final score
            avg_technical = statistics.get("avg_technical_score", 0)
            avg_communication = statistics.get("avg_communication_score", 0)
            avg_problem_solving = statistics.get("avg_problem_solving_score", 0)

            # Weight the averages based on role type (fetch from session)
            role_weights = {
                "technical": {"technical": 0.5, "communication": 0.2, "problem_solving": 0.3},
                "non-technical": {"technical": 0.2, "communication": 0.5, "problem_solving": 0.3},
                "leadership": {"technical": 0.3, "communication": 0.4, "problem_solving": 0.3}
            }

            # Get role type from first question
            role_type = (
                session_data.get("questions", [{}])[0]
                .get("role_type", "technical")
            )
            weights = role_weights.get(role_type, role_weights["technical"])

            # Calculate weighted final score
            final_score = round(
                (avg_technical * weights["technical"]) +
                (avg_communication * weights["communication"]) +
                (avg_problem_solving * weights["problem_solving"]),
                2
            )

            logger.info(f"finalize_interview: calculated final_score={final_score}, role_type={role_type}")

            # Update application with detailed results - use resilient query to match by application_id or _id
            try:
                from bson import ObjectId
                app_id_val = session_data.get("application_id")
                app_or = [{"application_id": app_id_val}]
                if ObjectId.is_valid(str(app_id_val)):
                    app_or.append({"_id": ObjectId(app_id_val)})
                logger.debug(f"finalize_interview: querying applications with $or={app_or}")
            except Exception:
                app_or = [{"application_id": session_data.get("application_id")}]
                logger.debug(f"finalize_interview: ObjectId conversion failed, using simple query: {app_or}")

            total_time = statistics.get("total_time", 0)
            avg_time_per_question = round(
                total_time / statistics.get("questions_answered", 1),
                1
            )

            # Generate performance by type
            performance_by_type = {}
            for q_id, score in scores.items():
                q_type = score.get("question_type", "unknown")
                performance_by_type.setdefault(q_type, []).append(score.get("final_score", 0))

            type_averages = {
                q_type: round(sum(scores_list) / len(scores_list), 2)
                for q_type, scores_list in performance_by_type.items()
            }

            app_update_result = await db.applications.update_one(
                {"$or": app_or},
                {"$set": {
                    "interview_score": final_score,
                    "interview_completed": True,
                    "interview_timestamp": datetime.utcnow(),
                    "interview_statistics": {
                        "total_score": final_score,
                        "technical_score": avg_technical,
                        "communication_score": avg_communication,
                        "problem_solving_score": avg_problem_solving,
                        "total_time": total_time,
                        "avg_time_per_question": avg_time_per_question,
                        "performance_by_type": type_averages,
                        "questions_completed": statistics.get("questions_answered", 0),
                        "total_questions": statistics.get("total_questions", 0)
                    },
                    "status": "interview_completed"
                }}
            )
            logger.info(f"finalize_interview: application update result matched={app_update_result.matched_count}, modified={app_update_result.modified_count}, application_id={session_data.get('application_id')}")
            if app_update_result.matched_count == 0:
                logger.error(f"finalize_interview: NO APPLICATION FOUND TO UPDATE! application_id={session_data.get('application_id')}, query={app_or}")
            elif app_update_result.modified_count == 0:
                logger.warning(f"finalize_interview: application matched but not modified (data unchanged?): {session_data.get('application_id')}")

            # Store interview summary in vector DB for analysis
            summary_text = f"""
Interview Summary for Application {session_data['application_id']}:
Total Score: {final_score}/100
Technical Score: {avg_technical}/100
Communication Score: {avg_communication}/100
Problem Solving Score: {avg_problem_solving}/100
Questions Completed: {statistics.get('questions_answered', 0)}/{statistics.get('total_questions', 0)}
Average Time per Question: {avg_time_per_question}s
Performance by Question Type: {json.dumps(type_averages)}
"""

            vector_id = f"interview_summary_{session_id}"
            try:
                embedder.upsert_to_pinecone(
                    vector_id=vector_id,
                    text=summary_text,
                    metadata={
                        "type": "interview_summary",
                        "session_id": session_id,
                        "application_id": session_data["application_id"],
                        "final_score": final_score,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
            except Exception:
                logger.exception("Failed to store interview summary in vector DB")

            # Notify completion with detailed stats
            try:
                await notifier.notify_interview_completed(
                    application_id=session_data["application_id"],
                    score=final_score,
                    statistics={
                        "technical_score": avg_technical,
                        "communication_score": avg_communication,
                        "problem_solving_score": avg_problem_solving,
                        "completion_rate": f"{statistics.get('questions_answered', 0)}/{statistics.get('total_questions', 0)}",
                        "avg_time_per_question": f"{avg_time_per_question}s"
                    }
                )
            except Exception:
                logger.exception("Failed to notify interview completion")
    except Exception as e:
        logger.error(f"finalize_interview failed for session_id={session_id}: {str(e)}", exc_info=True)
        audit_service.log_error(operation="finalize_interview", entity_id=session_id, error=str(e))

async def cleanup_expired_sessions_async() -> int:
    """Cleanup expired interview sessions older than 7 days (async helper)."""
    try:
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]
            
            expiry = datetime.utcnow() - timedelta(days=7)
            result = await db.interview_sessions.delete_many({
                "timestamp": {"$lt": expiry},
                "status": {"$in": ["complete", "expired"]}
            })
            
            return result.deleted_count
            
    except Exception as e:
        audit_service.log_error(
            operation="cleanup_expired_sessions",
            error=str(e)
        )
        # Propagate to wrapper
        raise


@celery.task(bind=True)
def cleanup_expired_sessions(self) -> int:
    try:
        return asyncio.run(cleanup_expired_sessions_async())
    except Exception as e:
        audit_service.log_error(
            operation="cleanup_expired_sessions",
            error=str(e)
        )
        raise self.retry(exc=e, countdown=60)