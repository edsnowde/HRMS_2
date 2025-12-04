"""
Routes for managing interview processes.
Handles interview sessions, question generation, and response evaluation.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.auth import get_current_user, get_user_role
from app.schemas import (
    InterviewRequest,
    InterviewResponse,
    InterviewSession,
    InterviewQuestion
)
from app.workers.interview_worker import (
    generate_interview_questions,
    evaluate_interview_response
)
from app.services.notifier import NotificationService
from app.database import AsyncMongoClient
from app.config import settings
from app.services.audit import AuditService
from typing import Tuple
import logging

logger = logging.getLogger(__name__)
try:
    from bson import ObjectId
except Exception:
    ObjectId = None

router = APIRouter(prefix="/api/interviews", tags=["interviews"])
notifier = NotificationService()
audit = AuditService()

@router.post("/create", response_model=Dict[str, Any])
async def create_interview_session(
    request: InterviewRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    role = Depends(get_user_role)
) -> Dict[str, Any]:
    """
    Create a new interview session.
    
    Args:
        request: Interview session request
        background_tasks: Background task runner
        current_user: Current authenticated user
        role: User's role
        
    Returns:
        Dict with session details
    """
    if role not in ["recruiter", "hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    try:
        # Validate application status
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]

            # Robustly find the application by either its Mongo _id or application_id field
            query_or = [{"application_id": request.application_id}, {"_id": request.application_id}]
            if ObjectId and ObjectId.is_valid(request.application_id):
                query_or.append({"_id": ObjectId(request.application_id)})

            application = await db.applications.find_one({"$or": query_or})
            if not application:
                raise HTTPException(status_code=404, detail="Application not found")
                
            if application.get("status") not in ["resume_screened", "shortlisted"]:
                raise HTTPException(
                    status_code=400,
                    detail="Application not ready for interview"
                )
            
            # Generate questions (async)
            task = generate_interview_questions.delay(
                application_id=request.application_id,
                job_id=application["job_id"],
                role_type=request.role_type,
                time_per_question=request.time_per_question
            )
            
            # Update application status
            # Update by application_id to be robust regardless of _id type
            await db.applications.update_one(
                {"application_id": application.get("application_id")},
                {"$set": {
                    "status": "interview_scheduled",
                    "interview_task_id": task.id,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user.get("uid") if isinstance(current_user, dict) else getattr(current_user, "id", None)
                }}
            )
            
            try:
                await audit.log_action(
                    actor_uid=current_user.get("uid") if isinstance(current_user, dict) else getattr(current_user, "id", None),
                    action="create_interview",
                    target_type="application",
                    target_id=request.application_id,
                    metadata={"task_id": task.id}
                )
            except Exception:
                # Best-effort audit; do not fail the main flow
                audit.log_error(operation="create_interview", entity_id=request.application_id, error="audit log failure")
            
            return {
                "application_id": request.application_id,
                "task_id": task.id,
                "status": "scheduled"
            }
            
    except Exception as e:
        audit.log_error(
            operation="create_interview",
            entity_id=request.application_id,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/answer", response_model=Dict[str, Any])
async def submit_interview_answer(
    session_id: str,
    question_id: str,
    response: InterviewResponse,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Submit an answer for an interview question.
    
    Args:
        session_id: Interview session ID
        question_id: Question being answered
        response: Response data
        background_tasks: Background task runner
        current_user: Current authenticated user
        
    Returns:
        Dict with submission status
    """
    try:
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]
            
            # Validate session
            session = await db.interview_sessions.find_one({"session_id": session_id})
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
                
            # Validate question (support legacy shapes: id, qid, question_id)
            question = None
            for q in session.get("questions", []):
                if (q.get("id") == question_id) or (q.get("qid") == question_id) or (q.get("question_id") == question_id):
                    question = q
                    break
            if not question:
                raise HTTPException(status_code=404, detail="Question not found")
                
            # Check if already answered
            if question_id in session.get("responses", {}):
                raise HTTPException(
                    status_code=400,
                    detail="Question already answered"
                )
            # Persist the submitted answer immediately so frontend sees it
            response_doc = {
                "text": response.text,
                "audio_url": response.audio_url,
                "transcript": response.transcript,
                "submitted_at": datetime.utcnow()
            }

            update_result = await db.interview_sessions.update_one(
                {"session_id": session_id},
                {"$set": {f"responses.{question_id}": response_doc, "updated_at": datetime.utcnow()}}
            )

            logger.info(f"submit_interview_answer: updated session {session_id} matched={update_result.matched_count} modified={update_result.modified_count}")

            # Also persist answer into the application document (gemini_answers) so UI and logs match
            try:
                app_query_or = [{"application_id": session.get("application_id")}]
                if ObjectId and ObjectId.is_valid(str(session.get("application_id"))):
                    app_query_or.append({"_id": ObjectId(session.get("application_id"))})

                answer_doc = {
                    "qid": question.get("qid") or question.get("id") or question.get("question_id") or question_id,
                    "question": question.get("text") or question.get("question") or "",
                    "answer": response.text,
                    "audio_url": response.audio_url,
                    "transcript": response.transcript,
                    "session_id": session_id,
                    "submitted_at": datetime.utcnow()
                }

                await db.applications.update_one(
                    {"$or": app_query_or},
                    {"$push": {"gemini_answers": answer_doc}}
                )
            except Exception:
                logger.exception(f"Failed to persist answer to applications.gemini_answers for session={session_id}, application_id={session.get('application_id')}")
            # Enqueue evaluation task (can be processed asynchronously)
            try:
                task = evaluate_interview_response.delay(
                    session_id=session_id,
                    question_id=question_id,
                    response_text=response.text,
                    audio_url=response.audio_url,
                    transcript=response.transcript
                )
            except Exception as task_exc:
                # Log but do not fail the request — answer is already persisted
                logger.exception(f"Failed to enqueue evaluation task for session={session_id}, question={question_id}: {task_exc}")
                task = None

            try:
                await audit.log_action(
                    actor_uid=current_user.get("uid") if isinstance(current_user, dict) else getattr(current_user, "id", None),
                    action="submit_answer",
                    target_type="interview_session",
                    target_id=session_id,
                    metadata={
                        "question_id": question_id,
                        "task_id": task.id if task is not None else None
                    }
                )
            except Exception:
                audit.log_error(operation="submit_answer", entity_id=session_id, error="audit log failure")

            return {
                "session_id": session_id,
                "question_id": question_id,
                "task_id": task.id if task is not None else None,
                "status": "evaluating"
            }
            
    except Exception as e:
        audit.log_error(
            operation="submit_answer",
            entity_id=session_id,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}", response_model=InterviewSession)
async def get_interview_session(
    session_id: str,
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get interview session details.
    
    Args:
        session_id: Interview session ID
        current_user: Current authenticated user
        
    Returns:
        Interview session data
    """
    try:
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]

            session = await db.interview_sessions.find_one({"session_id": session_id})
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")

            # Check authorization: find application robustly (application_id or _id)
            query_or = [{"application_id": session.get("application_id")}, {"_id": session.get("application_id")}]
            if ObjectId and ObjectId.is_valid(str(session.get("application_id"))):
                query_or.append({"_id": ObjectId(session.get("application_id"))})
            application = await db.applications.find_one({"$or": query_or})
            if not application:
                raise HTTPException(status_code=404, detail="Application not found")

            # Authorization: allow candidate (match by candidate_uid or candidate_id) or recruiter/hr
            user_uid = current_user.get("uid") if isinstance(current_user, dict) else getattr(current_user, "id", None)
            user_role = current_user.get("role") if isinstance(current_user, dict) else None
            # Accept multiple candidate identifier fields stored on the application
            candidate_match = (
                user_uid == application.get("candidate_uid") or
                user_uid == application.get("candidate_id") or
                (isinstance(application.get("candidate"), dict) and (
                    user_uid == application.get("candidate", {}).get("_id") or
                    user_uid == application.get("candidate", {}).get("uid")
                ))
            )
            if not (candidate_match or user_role in ["recruiter", "hr"]):
                raise HTTPException(status_code=403, detail="Not authorized")

            return session
            
    except Exception as e:
        # If the error is an HTTPException (like 403/404) re-raise so FastAPI handles it
        if isinstance(e, HTTPException):
            raise
        audit.log_error(
            operation="get_session",
            entity_id=session_id,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/application/{application_id}", response_model=List[InterviewSession])
async def get_application_interviews(
    application_id: str,
    current_user = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Get all interview sessions for an application.
    
    Args:
        application_id: Application ID
        current_user: Current authenticated user
        
    Returns:
        List of interview sessions
    """
    try:
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]

            # Find the application by application_id or _id
            query_or = [{"application_id": application_id}, {"_id": application_id}]
            if ObjectId and ObjectId.is_valid(application_id):
                query_or.append({"_id": ObjectId(application_id)})

            # Debug: log the query we will use (use module-level `logger`)
            logger.info(f"get_application_interviews: query_or={query_or}")

            application = await db.applications.find_one({"$or": query_or})
            logger.info(f"get_application_interviews: application found keys={list(application.keys()) if application else 'None'}")
            logger.debug(f"get_application_interviews: application snippet={str(application)[:500]}")
            if not application:
                raise HTTPException(status_code=404, detail="Application not found")

            # Authorization: allow candidate (match by candidate_uid or candidate_id) or recruiter/hr
            user_uid = current_user.get("uid") if isinstance(current_user, dict) else getattr(current_user, "id", None)
            user_role = current_user.get("role") if isinstance(current_user, dict) else None
            # Accept multiple candidate identifier fields stored on the application
            candidate_match = (
                user_uid == application.get("candidate_uid") or
                user_uid == application.get("candidate_id") or
                (isinstance(application.get("candidate"), dict) and (
                    user_uid == application.get("candidate", {}).get("_id") or
                    user_uid == application.get("candidate", {}).get("uid")
                ))
            )
            if not (candidate_match or user_role in ["recruiter", "hr"]):
                raise HTTPException(status_code=403, detail="Not authorized")

            # Get all sessions for this application (match by application_id field)
            app_id_val = application.get("application_id") or application.get("_id")
            logger.info(f"get_application_interviews: using application_id value={app_id_val}")
            sessions = await db.interview_sessions.find(
                {"application_id": app_id_val}
            ).sort("timestamp", -1).to_list(length=None)
            logger.info(f"get_application_interviews: sessions found count={len(sessions)}")

            # Normalize sessions to match `InterviewSession` schema expected by the
            # frontend. Some legacy session documents (or worker-produced docs)
            # may use `qid` for question ids or omit candidate_id/job_id/created_at.
            def _iso(dt_val):
                try:
                    if dt_val is None:
                        return None
                    if hasattr(dt_val, "isoformat"):
                        return dt_val.isoformat()
                    return str(dt_val)
                except Exception:
                    return None

            normalized_sessions = []
            for s in sessions:
                # ensure we treat Mongo _id as metadata not part of response
                session_id = s.get("session_id") or str(s.get("_id"))
                candidate_id = s.get("candidate_id") or application.get("candidate_id") or application.get("candidate_uid")
                job_id = s.get("job_id") or application.get("job_id")
                status = s.get("status") or application.get("status") or "interview"

                questions = []
                for q in s.get("questions", []):
                    qid = q.get("id") or q.get("qid") or q.get("question_id")
                    text = q.get("text") or q.get("question") or q.get("content") or ""
                    questions.append({
                        "id": qid or "",
                        "text": text,
                        "type": q.get("type") or "technical",
                        "max_time": q.get("max_time") or q.get("time") or 60,
                        "required": q.get("required") if isinstance(q.get("required"), bool) else True
                    })

                created_at = _iso(s.get("created_at") or application.get("created_at") or s.get("timestamp")) or datetime.utcnow().isoformat()
                updated_at = _iso(s.get("updated_at") or application.get("updated_at"))

                normalized_sessions.append({
                    "session_id": session_id,
                    "application_id": s.get("application_id") or application.get("application_id"),
                    "candidate_id": candidate_id,
                    "job_id": job_id,
                    "status": status,
                    "questions": questions,
                    "responses": s.get("responses") or {},
                    "scores": s.get("scores"),
                    "feedback": s.get("feedback"),
                    "created_at": created_at,
                    "updated_at": updated_at
                })

            # If no sessions but synthetic path will return earlier, otherwise
            # return normalized sessions so they validate against Pydantic schema
            return normalized_sessions
            # If there are no interview session documents but the application already
            # contains generated Gemini questions, synthesize a lightweight session
            # so the frontend can render the questions immediately.
            if not sessions and application.get("gemini_questions"):
                try:
                    logger.info(f"get_application_interviews: synthesizing session from {len(application.get('gemini_questions'))} gemini_questions")
                    questions = []
                    for q in application.get("gemini_questions"):
                        qid = q.get("qid") or q.get("id") or q.get("question_id")
                        text = q.get("text") or q.get("question") or q.get("content") or ""
                        questions.append({
                            "id": qid,
                            "text": text,
                            "type": "technical",
                            "max_time": q.get("max_time") or 60,
                            "required": True
                        })

                    # Safely format created_at/updated_at regardless of stored type
                    def _to_iso(dt_val):
                        try:
                            if hasattr(dt_val, "isoformat"):
                                return dt_val.isoformat()
                            return str(dt_val)
                        except Exception:
                            return None

                    synthetic = {
                        "session_id": f"legacy-{application.get('application_id')}",
                        "application_id": application.get("application_id"),
                        "candidate_id": application.get("candidate_id") or application.get("candidate_uid"),
                        "job_id": application.get("job_id"),
                        "status": application.get("status") or "interview",
                        "questions": questions,
                        "responses": {},
                        "scores": None,
                        "feedback": None,
                        "created_at": _to_iso(application.get("created_at")) or datetime.utcnow().isoformat(),
                        "updated_at": _to_iso(application.get("updated_at"))
                    }
                    logger.info(f"get_application_interviews: returning synthetic session id={synthetic.get('session_id')}")
                    return [synthetic]
                except Exception:
                    logger.exception("Error while synthesizing session from application.gemini_questions")
                    # Fall back to returning empty session list on error
                    return []

            return sessions
            
    except Exception as e:
        # Re-raise HTTPExceptions so FastAPI can return correct status codes
        if isinstance(e, HTTPException):
            raise
        logger.exception(f"Unhandled error in get_application_interviews for application_id={application_id}: {e}")
        try:
            audit.log_error(
                operation="get_application_interviews",
                entity_id=application_id,
                error=str(e)
            )
        except Exception:
            logger.exception("Failed to write audit log for get_application_interviews")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.delete("/{session_id}", response_model=Dict[str, Any])
async def delete_interview_session(
    session_id: str,
    current_user = Depends(get_current_user),
    role = Depends(get_user_role)
) -> Dict[str, Any]:
    """
    Delete an interview session.
    Only allowed for recruiters/HR and only for incomplete sessions.
    
    Args:
        session_id: Interview session ID
        current_user: Current authenticated user
        role: User's role
        
    Returns:
        Deletion status
    """
    if role not in ["recruiter", "hr"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    try:
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]
            
            session = await db.interview_sessions.find_one({
                "session_id": session_id,
                "status": {"$nin": ["complete", "expired"]}
            })
            
            if not session:
                raise HTTPException(
                    status_code=404,
                    detail="Session not found or already completed"
                )
            
            # Delete session
            await db.interview_sessions.delete_one({"session_id": session_id})
            
            # Update application (use application_id field to be robust)
            await db.applications.update_one(
                {"application_id": session.get("application_id")},
                {"$set": {
                    "status": "resume_screened",  # Revert to previous state
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user.get("uid") if isinstance(current_user, dict) else getattr(current_user, "id", None)
                }}
            )
            
            try:
                await audit.log_action(
                    actor_uid=current_user.get("uid") if isinstance(current_user, dict) else getattr(current_user, "id", None),
                    action="delete_session",
                    target_type="interview_session",
                    target_id=session_id,
                )
            except Exception:
                audit.log_error(operation="delete_session", entity_id=session_id, error="audit log failure")
            
            return {"status": "deleted", "session_id": session_id}
            
    except Exception as e:
        audit.log_error(
            operation="delete_session",
            entity_id=session_id,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))