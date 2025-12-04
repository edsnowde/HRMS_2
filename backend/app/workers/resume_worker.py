import uuid
import logging
from datetime import datetime
from typing import Dict, Any
from app.workers.celery_app import celery
from app.services import (
    ResumeParser,
    EmbedderService,
    StorageService,
    SyncDatabaseService,
    NotificationService,
    CacheService
)
from app.config import settings

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@celery.task(name="app.workers.resume_worker.process_resume", bind=True)
def process_resume(self, application_id: str, gcs_path: str) -> Dict[str, Any]:
    """Background task to process resume: extract text, parse, create embeddings, upsert into a vector index
    (Vertex AI Matching Engine) and persist candidate metadata into MongoDB.

    Args:
        application_id: The ID of the job application 
        gcs_path: Path to the uploaded resume in Google Cloud Storage

    Returns:
        Dict with candidate_id, embedding_id and status.
    """
    start_time = datetime.now()
    logger.info(f"[{application_id}] Starting resume processing at {start_time}")
    try:
        # Initialize services
        logger.info(f"[{application_id}] Initializing services...")
        print(f"[{application_id}] resume_worker: initializing services")
        storage_service = StorageService()
        parser = ResumeParser()
        embedder = EmbedderService()
        db_service = SyncDatabaseService()  # Use sync wrapper
        notifier = NotificationService()
        cache = CacheService()
        
        # First get application to check current state
        app = db_service.get_application(application_id)
        if app and app.get("status") == "COMPLETED" and app.get("resume_vector_id"):
            logger.info(f"[{application_id}] Application already processed successfully")
            return {
                "status": "completed",
                "resume_vector_id": app.get("resume_vector_id"),
                "application_id": application_id,
                "message": "Already processed"
            }
        
        logger.info(f"[{application_id}] Services initialized successfully")
        print(f"[{application_id}] resume_worker: services initialized")

        # Update application status to processing
        logger.info(f"[{application_id}] Updating application status to PROCESSING")
        db_service.update_application(application_id, {
            "status": "PROCESSING",
            "stage": "resume_processing"
        })

        # Download file from GCS
        logger.info(f"[{application_id}] Downloading resume from GCS: {gcs_path}")
        print(f"[{application_id}] resume_worker: downloading from GCS {gcs_path}")
        file_content = storage_service.download_file(gcs_path)
        logger.info(f"[{application_id}] Resume file downloaded successfully")
        print(f"[{application_id}] resume_worker: download complete, {len(file_content) if file_content else 0} bytes")

        # Extract text from resume
        logger.info(f"[{application_id}] Parsing resume content...")
        print(f"[{application_id}] resume_worker: parsing resume content")
        parsed_data = parser.parse_resume_bytes(file_content)
        resume_text = parsed_data.get('text', '')
        logger.info(f"[{application_id}] Parsed resume text length: {len(resume_text) if resume_text else 0}")
        print(f"[{application_id}] resume_worker: parsed {len(resume_text or '')} characters")

        if not resume_text.strip():
            raise ValueError("Could not extract text from resume")

        # Check cache for existing embedding
        logger.info(f"[{application_id}] Checking cache for existing embedding...")
        print(f"[{application_id}] resume_worker: computing text hash and checking cache")
        text_hash = cache.hash_text(resume_text)
        cached_embedding_id = cache.get_embedding(text_hash)

        if cached_embedding_id:
            logger.info(f"[{application_id}] Found cached embedding: {cached_embedding_id}")
            print(f"[{application_id}] resume_worker: using cached embedding {cached_embedding_id}")
            embedding_id = cached_embedding_id
        else:
            # Create new embedding (this method also upserts to the configured index)
            logger.info(f"[{application_id}] Creating new embedding and upserting to Vertex AI index...")
            print(f"[{application_id}] resume_worker: creating new embedding (may be slow) ")
            embedding_id = embedder.create_embedding(resume_text)
            logger.info(f"[{application_id}] Embedding created with ID: {embedding_id}")
            print(f"[{application_id}] resume_worker: embedding created id={embedding_id}")
            cache.set_embedding(text_hash, embedding_id)
            logger.info(f"[{application_id}] Embedding cached for future use")
            print(f"[{application_id}] resume_worker: cached embedding for hash {text_hash}")

        # Extract and validate email first
        email = parsed_data.get('email')
        if not email:
            logger.warning(f"[{application_id}] No email found in resume, using placeholder")
            email = f"candidate_{application_id}@placeholder.com"

        # Prepare candidate record and save to MongoDB first so we have canonical candidate_id
        logger.info(f"[{application_id}] Preparing to save candidate data to MongoDB...")
        candidate_data = {
            "name": parsed_data.get('name') or "Unknown Candidate",
            "email": email,
            "skills": parsed_data.get('skills', []),
            "experience": parsed_data.get('total_experience', 0),
            "education": parsed_data.get('degree'),
            "resume_text": resume_text,
            "embedding_id": embedding_id,
            "gcs_path": gcs_path,
            "application_id": application_id,
            "stage": "Profile Created",
            "needs_human_review": True,  # Flag for HR to review due to missing email
        }

        logger.info(f"[{application_id}] Saving candidate data to MongoDB...")
        candidate_id = db_service.save_candidate(candidate_data)
        logger.info(f"[{application_id}] Candidate saved with ID: {candidate_id}")
        print(f"[{application_id}] resume_worker: candidate saved id={candidate_id}")

        # Prepare metadata to persist in MongoDB and Pinecone (include canonical candidate_id)
        metadata = {
            # Primary identification (use application_id as primary key)
            "application_id": application_id,
            "candidate_id": candidate_id,
            "vector_type": "resume",  # Explicit type for Pinecone filtering
            "timestamp": datetime.utcnow().isoformat(),

            # Candidate information
            "candidate_name": parsed_data.get('name', '') or "Unknown Candidate",
            "email": email,
            "skills": parsed_data.get('skills', []),
            "experience": parsed_data.get('total_experience', 0),
            "education": parsed_data.get('degree', ''),
            "text": resume_text[:1000],  # Truncate for DB
        }

        # Attempt metadata upsert to vector index (now including candidate_id)
        try:
            logger.info(f"[{application_id}] Upserting metadata to Vertex AI index...")
            print(f"[{application_id}] resume_worker: upserting metadata to vector index (id={embedding_id})")
            embedder.upsert_to_pinecone(embedding_id, resume_text, metadata)
            logger.info(f"[{application_id}] Metadata upserted successfully")
            print(f"[{application_id}] resume_worker: upsert successful for vector {embedding_id}")
        except Exception as upsert_error:
            # Non-fatal: continue even if index upsert fails; worker will retry or log
            logger.warning(f"[{application_id}] Metadata upsert warning (non-fatal): {str(upsert_error)}")
            print(f"[{application_id}] resume_worker: upsert WARNING: {str(upsert_error)}")

        # Update application status to completed
        logger.info(f"[{application_id}] Updating application status to COMPLETED...")
        print(f"[{application_id}] resume_worker: updating application DB with vector id and metadata")
        # Persist consistent field names expected by other parts of the app
        try:
            ok = db_service.update_application(application_id, {
                "status": "COMPLETED",
                "stage": "resume_processed",
                "candidate_id": candidate_id,
                "resume_vector_id": embedding_id,
                "pinecone_metadata": metadata
            })
            print(f"[{application_id}] resume_worker: DB update completed ok={ok}")
        except Exception as e:
            logger.warning(f"[{application_id}] Failed to update application with vector info: {str(e)}")
            print(f"[{application_id}] resume_worker: DB update FAILED: {str(e)}")

        # Notify frontend via WebSocket
        logger.info(f"[{application_id}] Sending WebSocket notification to frontend...")
        notifier.publish_event("resume_processed", application_id, {
            "candidate_id": candidate_id,
            "status": "completed",
            "embedding_id": embedding_id
        })

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"[{application_id}] Resume processing completed successfully in {duration:.2f} seconds")
        
        return {
            "candidate_id": candidate_id,
            "embedding_id": embedding_id,
            "status": "completed",
            "duration_seconds": duration,
            "application_id": application_id
        }

    except Exception as e:
        error_time = datetime.now()
        duration = (error_time - start_time).total_seconds()
        logger.error(f"[{application_id}] Error processing resume after {duration:.2f} seconds: {str(e)}")
        
        # Update application status to failed
        try:
            logger.info(f"[{application_id}] Updating application status to FAILED...")
            db_service.update_application(application_id, {
                "status": "FAILED",
                "stage": "resume_processing_failed",
                "error": str(e),
                "duration_seconds": duration
            })
        except Exception as status_error:
            logger.error(f"[{application_id}] Could not update application status: {str(status_error)}")

        # Notify frontend of failure
        try:
            logger.info(f"[{application_id}] Sending failure notification to frontend...")
            notifier.publish_event("resume_processed", application_id, {
                "status": "failed",
                "error": str(e),
                "duration_seconds": duration
            })
        except Exception as notify_error:
            logger.error(f"[{application_id}] Could not send failure notification: {str(notify_error)}")

        # Re-raise for Celery to handle retry logic
        logger.info(f"[{application_id}] Scheduling retry in 60 seconds...")
        raise self.retry(exc=e, countdown=60, max_retries=3)


@celery.task(name="app.workers.resume_worker.batch_process_resumes")
def batch_process_resumes(application_ids: list, gcs_paths: list) -> Dict[str, Any]:
    """
    Process multiple resumes in batch for efficiency.
    
    Args:
        application_ids: List of application IDs
        gcs_paths: List of GCS paths to uploaded resumes
    
    Returns:
        Dict with processing results
    """
    results = []
    
    for application_id, gcs_path in zip(application_ids, gcs_paths):
        try:
            result = process_resume.delay(application_id, gcs_path)
            results.append({
                "application_id": application_id,
                "task_id": result.id,
                "status": "queued"
            })
        except Exception as e:
            results.append({
                "application_id": application_id,
                "status": "failed",
                "error": str(e)
            })
    
    return {"results": results}
