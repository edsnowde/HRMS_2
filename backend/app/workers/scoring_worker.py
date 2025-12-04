from typing import Dict, Any, List
import logging
import time
from datetime import datetime
from app.workers.celery_app import celery
from app.services import (
    EmbedderService,
    ScorerService,
    SyncDatabaseService,
    NotificationService,
    CacheService,
    AuditService
)
from app.config import settings

logger = logging.getLogger(__name__)


@celery.task(name="app.workers.scoring_worker.score_candidate", bind=True)
def score_candidate(self, candidate_id: str, job_description: str, job_id: str = None) -> Dict[str, Any]:
    """
    Score a candidate against a job description using LLM.
    """
    try:
        # Validate input parameters
        if not candidate_id:
            raise ValueError("candidate_id cannot be None or empty")
        if not job_description:
            raise ValueError("job_description cannot be None or empty")

        # Initialize services
        scorer = ScorerService()
        db_service = SyncDatabaseService()  # Use sync wrapper
        notifier = NotificationService()
        cache = CacheService()

        print(f"[score_candidate] candidate_id={candidate_id} job_id={job_id} - starting scoring")
        logger.info(f"[score_candidate] Scoring candidate {candidate_id} for job {job_id}")

        # Get candidate data with retries
        retry_count = 0
        max_retries = 3
        candidate = None
        
        while retry_count < max_retries:
            try:
                candidate = db_service.get_candidate(candidate_id)
                if candidate:
                    print(f"[score_candidate] Successfully retrieved candidate data: {candidate_id}")
                    break
                logger.warning(f"[score_candidate] Candidate {candidate_id} not found on attempt {retry_count + 1}")
                retry_count += 1
                if retry_count < max_retries:
                    time.sleep(1)  # Wait 1 second before retrying
            except Exception as e:
                logger.error(f"[score_candidate] Attempt {retry_count + 1} failed to get candidate {candidate_id}: {str(e)}")
                retry_count += 1
                if retry_count < max_retries:
                    time.sleep(1)

        if not candidate:
            error_msg = f"Candidate {candidate_id} not found after {max_retries} attempts"
            logger.error(f"[score_candidate] {error_msg}")
            raise ValueError(error_msg)

        resume_text = candidate.get('resume_text', '')
        if not resume_text:
            # Try to get resume text from resume_url if available
            resume_url = candidate.get('resume_url')
            if resume_url:
                try:
                    storage_service = db_service.get_storage_service()
                    resume_text = storage_service.get_file_text(resume_url)
                    if resume_text:
                        # Update candidate with extracted text
                        db_service.update_candidate(candidate_id, {"resume_text": resume_text})
                        logger.info(f"[score_candidate] Successfully extracted and updated resume text for {candidate_id}")
                    else:
                        raise ValueError("Failed to extract text from resume")
                except Exception as e:
                    # If resume extraction fails, fallback to assigning score 0 instead of raising
                    logger.error(f"[score_candidate] Failed to extract text from resume: {str(e)}")
                    logger.warning(f"[score_candidate] Assigning fallback score=0 for candidate {candidate_id} due to resume fetch failure")
                    # Build fallback score data
                    score_data = {
                        "score": 0,
                        "rationale": "Resume unavailable or could not be processed. Assigned fallback score 0.",
                        "model": "fallback",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    # Persist fallback score and notify; avoid retry loop
                    try:
                        db_service.update_candidate_score(candidate_id, score_data, job_id)
                        logger.info(f"[score_candidate] Persisted fallback score for candidate {candidate_id}")
                        if job_id:
                            # Try to update corresponding application record
                            try:
                                application = db_service.get_application_by_job_and_candidate(job_id, candidate_id)
                                if application:
                                    application_id = application.get('application_id') or application.get('_id')
                                    db_service.update_application(application_id, {
                                        "ai_match_score": 0,
                                        "match_score": 0,
                                        "latest_score": score_data,
                                        "updated_at": datetime.utcnow()
                                    })
                                    logger.info(f"[score_candidate] Updated application {application_id} with fallback score")
                            except Exception as e2:
                                logger.error(f"[score_candidate] Failed to update application with fallback score: {str(e2)}")

                        # Notify frontend of fallback scoring
                        try:
                            if job_id:
                                notifier.publish_event("candidate_scored", job_id, {
                                    "candidate_id": candidate_id,
                                    "score": 0,
                                    "rationale": score_data.get('rationale'),
                                    "status": "scored"
                                })
                        except Exception:
                            pass

                        return {
                            "candidate_id": candidate_id,
                            "score": 0,
                            "rationale": score_data.get('rationale'),
                            "status": "completed"
                        }
                    except Exception:
                        # If persisting fallback fails, raise to trigger retry logic
                        raise
            else:
                error_msg = "No resume text or URL available for candidate"
                logger.error(f"[score_candidate] {error_msg}")
                raise ValueError(error_msg)

        # Check cache for existing score
        score_key = cache.generate_score_key(candidate_id, job_description)
        cached_score = cache.get_score(score_key)

        if cached_score:
            print(f"[score_candidate] Using cached score for {candidate_id}")
            score_data = cached_score
        else:
            print(f"[score_candidate] Generating new LLM score for {candidate_id}")
            # Generate new score using LLM
            score_data = scorer.score_candidate(resume_text, job_description)
            # Cache the result
            cache.set_score(score_key, score_data)

        # Update candidate with score
        try:
            db_service.update_candidate_score(candidate_id, score_data, job_id)
            logger.info(f"[score_candidate] Successfully updated score for candidate {candidate_id}")

            # Also update application document (if exists) so front-end shows the ai_match_score
            if job_id:
                try:
                    application = db_service.get_application_by_job_and_candidate(job_id, candidate_id)
                    if application:
                        application_id = application.get('application_id') or application.get('_id')
                        # Update the application with the ai match score and rationale
                        db_service.update_application(application_id, {
                            "ai_match_score": score_data.get('score'),
                            "match_score": score_data.get('score'),
                            "latest_score": score_data,
                            "updated_at": datetime.utcnow()
                        })
                        logger.info(f"[score_candidate] Updated application {application_id} with score for job {job_id}")
                    else:
                        logger.warning(f"[score_candidate] No application found for job={job_id} candidate={candidate_id}")
                except Exception as e:
                    logger.error(f"[score_candidate] Failed to update application with score: {str(e)}")
        except Exception as e:
            logger.error(f"[score_candidate] Failed to update score in database: {str(e)}")
            raise

        # Notify frontend if job_id provided
        if job_id:
            try:
                notifier.publish_event("candidate_scored", job_id, {
                    "candidate_id": candidate_id,
                    "score": score_data.get('score'),
                    "rationale": score_data.get('rationale'),
                    "status": "SCORED"
                })
                logger.info(f"[score_candidate] Sent scoring notification for candidate {candidate_id}")
            except Exception as e:
                logger.error(f"[score_candidate] Failed to send notification: {str(e)}")

        return {
            "candidate_id": candidate_id,
            "score": score_data.get('score'),
            "rationale": score_data.get('rationale'),
            "status": "completed"
        }

    except Exception as e:
        # Log error and notify frontend
        try:
            if job_id:
                notifier.publish_event("candidate_scored", job_id, {
                    "candidate_id": candidate_id,
                    "status": "failed",
                    "error": str(e)
                })
        except Exception:
            pass

        raise self.retry(exc=e, countdown=60, max_retries=3)



@celery.task(name="app.workers.scoring_worker.match_job_candidates", bind=True)
def match_job_candidates(self, job_id: str, job_description: str, top_k: int = 10) -> Dict[str, Any]:
    """
    Match candidates for a job using vector similarity + LLM scoring.
    """
    try:
        # Initialize services
        embedder = EmbedderService()
        db_service = SyncDatabaseService()  # Use sync wrapper
        notifier = NotificationService()

        # Update job status to matching
        db_service.update_job_status(job_id, "MATCHING")
        print(f"[match_job_candidates] job_id={job_id} top_k={top_k} - starting matching")
        logger.info(f"[match_job_candidates] job_id={job_id} - starting matching (top_k={top_k})")

        # Create embedding for job description
        print(f"[match_job_candidates] Creating job embedding (may take a moment)")
        job_embedding = embedder.create_embedding(job_description)
        logger.info(f"[match_job_candidates] job_embedding created for job_id={job_id}")

        # Query Pinecone for similar candidates (resume vectors)
        print(f"[match_job_candidates] Querying Pinecone for top_k={top_k} resume vectors")
        similar_candidates = embedder.query_similar(
            job_embedding,
            top_k=top_k,
            min_score=0.0,  # Lower threshold to get more matches
            vector_type="resume"  # This matches metadata.vector_type
        )
        print(f"[match_job_candidates] Pinecone returned {len(similar_candidates) if similar_candidates else 0} matches")
        logger.info(f"[match_job_candidates] Pinecone returned {len(similar_candidates) if similar_candidates else 0} matches for job {job_id}")

        if not similar_candidates:
            # Fallback to database query
            similar_candidates = db_service.get_candidates_for_matching(limit=top_k)
            if not similar_candidates:
                logger.warning(f"[match_job_candidates] No candidates found for job {job_id}")
                return {
                    "job_id": job_id,
                    "total_candidates": 0,
                    "status": "completed",
                    "message": "No candidates found"
                }

        # Score each candidate with LLM
        scored_candidates = []
        for idx, candidate_data in enumerate(similar_candidates or []):
            metadata = candidate_data.get('metadata', {}) or {}
            
            # Extract IDs with proper validation
            application_id = (
                metadata.get('application_id') or 
                metadata.get('applicationId') or 
                candidate_data.get('application_id')
            )
            
            candidate_id = (
                metadata.get('candidate_id') or 
                metadata.get('candidateId') or 
                candidate_data.get('candidate_id') or 
                candidate_data.get('id')
            )
            
            # Attempt to resolve candidate via application_id if candidate_id missing
            if (not candidate_id or candidate_id == "None") and application_id:
                try:
                    app_record = db_service.get_application(application_id)
                    if app_record and app_record.get('candidate_id'):
                        candidate_id = app_record.get('candidate_id')
                        logger.info(f"[match_job_candidates] Resolved candidate_id from application: {candidate_id}")
                    else:
                        logger.warning(f"[match_job_candidates] candidate_id missing and application {application_id} has no candidate_id")
                except Exception as _e:
                    logger.warning(f"[match_job_candidates] Failed to resolve application {application_id}: {_e}")

            # If still missing candidate_id, try to resolve application via candidate_id; otherwise include Pinecone-only result
            if not candidate_id or candidate_id == "None":
                logger.warning(f"[match_job_candidates] Invalid candidate_id found: {candidate_id}, attempting to resolve application_id from DB")
                resolved_app_id = None
                try:
                    if candidate_id:
                        app_record = db_service.get_application_by_job_and_candidate(job_id, candidate_id)
                        if app_record:
                            resolved_app_id = app_record.get('application_id') or app_record.get('_id')
                            logger.info(f"[match_job_candidates] Resolved application_id from DB for candidate {candidate_id}: {resolved_app_id}")
                except Exception as _e:
                    logger.warning(f"[match_job_candidates] Failed to resolve application for candidate {candidate_id}: {_e}")

                scored_candidates.append({
                    "application_id": resolved_app_id,
                    "candidate_id": candidate_id or None,
                    "similarity_score": candidate_data.get('score', 0.0),
                    "status": "pinecone_only",
                    "score": candidate_data.get('score', 0.0),
                    "rationale": "Pinecone match only; candidate record not found in DB"
                })
                # Continue to next candidate
                continue

            # Ensure application_id refers to a real application in DB. If not, attempt to resolve via candidate_id
            try:
                if application_id:
                    app_check = db_service.get_application(application_id)
                    if not app_check:
                        # suspicious application_id (not found), try resolving via candidate_id
                        if candidate_id:
                            app_record = db_service.get_application_by_job_and_candidate(job_id, candidate_id)
                            if app_record:
                                application_id = app_record.get('application_id') or app_record.get('_id')
                                logger.info(f"[match_job_candidates] Corrected application_id from DB for candidate {candidate_id}: {application_id}")
                else:
                    # No application_id provided; try to resolve from candidate_id
                    if candidate_id:
                        app_record = db_service.get_application_by_job_and_candidate(job_id, candidate_id)
                        if app_record:
                            application_id = app_record.get('application_id') or app_record.get('_id')
                            logger.info(f"[match_job_candidates] Resolved missing application_id from DB for candidate {candidate_id}: {application_id}")
            except Exception as _e:
                logger.warning(f"[match_job_candidates] Application resolution check failed: {_e}")

            print(f"[match_job_candidates] candidate[{idx}] application_id={application_id} candidate_id={candidate_id} score={candidate_data.get('score')}")
            logger.info(f"[match_job_candidates] candidate idx={idx} app={application_id} cand={candidate_id} score={candidate_data.get('score')}")

                # Skip only if we don't have either ID
            if not candidate_id and not application_id:
                logger.warning(f"[match_job_candidates] Skipping match with no IDs")
                continue

            try:
                # Get Pinecone similarity score
                similarity_score = candidate_data.get('score', 0.0)
                print(f"[match_job_candidates] Processing match: app={application_id} score={similarity_score}")

                # Update application record with similarity score
                if application_id:
                    try:
                        db_service.update_application(application_id, {
                            "similarity_score": similarity_score,
                            "match_score": similarity_score,  # Also update match_score for compatibility
                            "ai_match_score": similarity_score,  # And ai_match_score
                            "status": "embedded generated",
                            "stage": "ai_screening",
                            "pinecone_metadata": metadata
                        })
                        print(f"[match_job_candidates] Updated application {application_id} with score {similarity_score}")
                    except Exception as e:
                        print(f"[match_job_candidates] Failed to update application {application_id}: {e}")

                # Add to matches list for job_matches collection
                scored_candidates.append({
                    "application_id": application_id,
                    "candidate_id": candidate_id,
                    "similarity_score": candidate_data.get('score', 0.0),
                    "score": candidate_data.get('score', 0.0),  # Use similarity as final score
                    "status": "embedded generated"  # Mark as embedded generated for Pinecone score
                })
            except Exception as e:
                logger.error(f"[match_job_candidates] Error processing candidate {candidate_id}: {str(e)}")
                continue

        # Store initial matches in database
        db_service.store_job_matches(job_id, scored_candidates)

        # Update job status
        db_service.update_job_status(job_id, "MATCHING_COMPLETED", {
            "total_candidates": len(scored_candidates)
        })

        # Notify frontend
        notifier.publish_event("job_matching_started", job_id, {
            "total_candidates": len(scored_candidates),
            "status": "matching"
        })

        return {
            "job_id": job_id,
            "total_candidates": len(scored_candidates),
            "status": "completed"
        }

    except Exception as e:
        # Update job status to failed
        try:
            db_service.update_job_status(job_id, "FAILED", {"error": str(e)})
        except Exception:
            pass

        # Notify frontend of failure
        try:
            notifier.publish_event("job_matching_failed", job_id, {
                "error": str(e)
            })
        except Exception:
            pass

        raise self.retry(exc=e, countdown=60, max_retries=3)








@celery.task(name="app.workers.scoring_worker.batch_score_candidates")
def batch_score_candidates(candidate_ids: List[str], job_description: str, job_id: str) -> Dict[str, Any]:
    """
    Score multiple candidates in batch for a job.
    
    Args:
        candidate_ids: List of candidate IDs
        job_description: Job description
        job_id: Job ID for tracking
    
    Returns:
        Dict with batch processing results
    """
    results = []
    
    for candidate_id in candidate_ids:
        try:
            result = score_candidate.delay(candidate_id, job_description, job_id)
            results.append({
                "candidate_id": candidate_id,
                "task_id": result.id,
                "status": "queued"
            })
        except Exception as e:
            results.append({
                "candidate_id": candidate_id,
                "status": "failed",
                "error": str(e)
            })
    
    return {"results": results}


@celery.task(name="app.workers.scoring_worker.score_interview", bind=True)
def score_interview(self, application_id: str) -> Dict[str, Any]:
    """
    Score interview answers using Gemini.
    
    Args:
        application_id: Application ID
        
    Returns:
        Dict with scoring results
    """
    try:
        print(f"🎯 Starting interview scoring for application {application_id}...")
        logger.info(f"Interview scoring started: application_id={application_id}")
        # Initialize services
        scorer = ScorerService()
        db_service = SyncDatabaseService()  # Use sync wrapper
        notifier = NotificationService()
        audit = AuditService()
        
        # Get application data
        application = db_service.get_application(application_id)
        if not application:
            raise ValueError(f"Application {application_id} not found")
        
        questions = application.get("gemini_questions", [])
        answers = application.get("gemini_answers", [])
        
        if not questions or not answers:
            raise ValueError("No questions or answers found")
        
        # Prepare scoring context
        scoring_data = {
            "job_description": application["job"]["description"],
            "resume_text": application["resume_text"],
            "qa_pairs": [
                {
                    "question": next(q["text"] for q in questions if q["qid"] == a["qid"]),
                    "answer": a["answer_text"],
                    "expired": a.get("expired", False)
                }
                for a in answers
            ]
        }
        
        # Score using Gemini
        print("🤖 Evaluating answers with Gemini...")
        logger.info(f"Starting Gemini evaluation: application_id={application_id}, num_answers={len(scoring_data['qa_pairs'])}")
        
        prompt_hash = scorer.get_prompt_hash("interview_scoring")
        score_results = scorer.score_interview_answers(
            scoring_data,
            prompt_hash=prompt_hash
        )
        
        print(f"✅ Evaluation complete - Technical: {score_results['technical']}, Communication: {score_results['communication']}")
        logger.info(f"Scoring complete: application_id={application_id}, final_score={score_results['final_score']}")
        
        # Update application with results
        update_data = {
            "gemini_results": {
                **score_results,
                "model_version": settings.GEMINI_MODEL_VERSION,
                "prompt_hash": prompt_hash
            },
            "stage": "evaluation_done"
        }
        
        db_service.update_application(application_id, update_data)
        
        # Log scoring
        audit.log_action(
            actor_uid="system",
            action="gemini_evaluate",
            target_type="application",
            target_id=application_id,
            model_version=settings.GEMINI_MODEL_VERSION,
            prompt_hash=prompt_hash,
            input_snapshot={"num_answers": len(answers)},
            output_snapshot={
                "technical": score_results["technical"],
                "communication": score_results["communication"],
                "final_score": score_results["final_score"]
            }
        )
        
        # Notify frontend
        notifier.publish_event("interview_scored", application_id, {
            "type": "interview_result",
            "application_id": application_id,
            "gemini_results": score_results
        })
        
        return {
            "application_id": application_id,
            "status": "completed",
            "results": score_results
        }
        
    except Exception as e:
        # Log error and notify
        notifier.publish_event("interview_scored", application_id, {
            "status": "failed",
            "error": str(e)
        })
        
        # Mark for human review on repeated failures
        if self.request.retries >= 2:
            db_service.update_application(
                application_id,
                {
                    "needs_human_review": True,
                    "stage": "evaluation_done",
                    "gemini_results": {
                        "error": str(e),
                        "requires_manual_review": True
                    }
                }
            )
        
        raise self.retry(exc=e, countdown=60, max_retries=3)
