from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from typing import Dict, Any, Optional
import uuid
import logging
from datetime import datetime, timedelta

from app.models import (
    Application, ApplicationCreate, ApplicationResponse, ApplicationStatus,
    ApplicationStage, MatchJobRequest, MatchJobResponse, StartInterviewRequest,
    InterviewQuestion, InterviewAnswerSubmit, ApplicationStatusUpdate
)

logger = logging.getLogger(__name__)
from app.services.storage import StorageService
from app.services.db_utils import DatabaseService
from app.services.embedder import EmbedderService
from app.services.scorer import ScorerService
from app.services.audit import AuditLogger
from app.workers.resume_worker import process_resume
from app.workers.scoring_worker import score_interview
from app.workers.interview_worker import generate_interview_questions
from app.websocket_manager import websocket_manager
from app.auth import get_current_user

router = APIRouter(prefix="/application", tags=["Application"])

@router.post("/create", response_model=ApplicationResponse)
async def create_application(application: ApplicationCreate, current_user = Depends(get_current_user)):
    """Create a new application record."""
    try:
        print("🔄 Creating new application record...")
        logger.info(f"Starting application creation for job_id={application.job_id}")

        # Initialize services
        print("⚙️ Initializing services...")
        db_service = DatabaseService()
        audit = AuditLogger()

        # Check if application already exists
        existing_application = await db_service.get_application_by_job_and_candidate(
            job_id=application.job_id,
            candidate_id=application.candidate_id
        )

        if existing_application:
            logger.info(f"Found existing application {existing_application['application_id']} for job {application.job_id}")
            return {
                "application_id": existing_application["application_id"],
                "job_id": application.job_id,
                "status": "existing",
                "message": "Application already exists"
            }

        # Generate application_id for new application
        application_id = f"APL-{uuid.uuid4().hex[:8].upper()}"
        # Resolve candidate UID from authenticated user and persist it on the application
        candidate_uid = None
        try:
            candidate_uid = current_user.get("uid")
            logger.info(f"create_application called by uid={candidate_uid}")
        except Exception:
            candidate_uid = None
        print(f"📝 Generated application ID: {application_id}")

        # Create application record
        app_data = {
            "application_id": application_id,
            **application.dict(),
            "stage": ApplicationStage.RESUME_PROCESSING,
            "status": ApplicationStatus.PENDING,
            # Store the auth UID (candidate_uid) to make future lookups straightforward
            "candidate_uid": candidate_uid
        }

        # If the client didn't supply a candidate_id (or supplied a UID), try to resolve
        # a canonical candidate_id (Mongo _id string) from the candidates collection.
        try:
            if not app_data.get("candidate_id") and candidate_uid:
                cand = await db_service.get_candidate_by_user_id(candidate_uid)
                if cand and cand.get("_id"):
                    app_data["candidate_id"] = str(cand.get("_id"))
                    logger.info(f"Resolved candidate_id for uid={candidate_uid} -> {app_data['candidate_id']}")
        except Exception as e:
            logger.exception(f"Failed to resolve candidate_id from uid when creating application: {e}")

        await db_service.create_application(app_data)

        try:
            # Log creation
            await audit.log_action(
                actor_uid="system",
                action="application_created",
                target_type="application",
                target_id=application_id
            )
        except Exception as e:
            logger.error(f"Audit logging failed but continuing: {str(e)}")

        try:
            # Notify via WebSocket (non-critical) - send to candidate and recruiters
            await websocket_manager.handle_application_update(
                application.job_id,
                application.candidate_id,
                ApplicationStatus.PENDING,
                {
                    "application_id": application_id,
                    "stage": ApplicationStage.RESUME_PROCESSING,
                    "status": ApplicationStatus.PENDING,
                    "message": "Application created"
                }
            )
        except Exception as e:
            logger.error(f"WebSocket notify failed (non-critical): {str(e)}")

        return {
            "application_id": application_id,
            "job_id": application.job_id,
            "status": "created",
            "message": "Application created successfully"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{application_id}/resume")
async def upload_resume(
    application_id: str,
    file: UploadFile = File(...),
    consent: bool = True
):
    """Upload resume for an application."""
    try:
        print(f"📄 Processing resume upload for application {application_id}...")
        logger.info(f"Resume upload started: application_id={application_id}, filename={file.filename}")
        
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            print("❌ Invalid file type - PDF required")
            logger.warning(f"Invalid file type: {file.filename}")
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are accepted"
            )
        
        # Initialize services
        storage = StorageService()

        # Ensure GCS configured and give actionable error
        if not getattr(storage, 'bucket', None):
            raise HTTPException(status_code=500, detail=(
                "Google Cloud Storage not configured. Set `GCS_BUCKET_NAME` and provide credentials via "
                "`GCS_CREDENTIALS_PATH` or `GOOGLE_APPLICATION_CREDENTIALS` (mounted secret) and restart the API."))

        db = DatabaseService()
        audit = AuditLogger()
        
        # Get application
        application = await db.get_application(application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Read and upload file
        print("📤 Uploading file to Google Cloud Storage...")
        content = await file.read()
        # Use the StorageService API: (file_content, file_name, folder)
        gcs_path = storage.upload_to_gcs(
            content,
            file.filename,
            folder=f"resumes/{application_id}"
        )
        print(f"✅ File uploaded successfully to GCS: {gcs_path}")
        logger.info(f"Resume uploaded to GCS: application_id={application_id}, path={gcs_path}")
        
        # Update application with GCS path
        await db.update_application(
            application_id,
            {
                "gcs_resume_uri": gcs_path,
                "consent_given": consent,
                "consent_timestamp": datetime.utcnow()
            }
        )
        
        # Enqueue processing
        task = process_resume.delay(application_id, gcs_path)
        
        # Log upload
        await audit.log_action(
            actor_uid=application.get("candidate_id"),
            action="resume_uploaded",
            target_type="application",
            target_id=application_id,
            metadata={"gcs_path": gcs_path}
        )

        # Notify via WebSocket (non-critical) - send to candidate and recruiters
        try:
            await websocket_manager.handle_application_update(
                application.get("job_id"),
                application.get("candidate_id"),
                "processing",
                {
                    "application_id": application_id,
                    "stage": ApplicationStage.RESUME_PROCESSING,
                    "status": "processing",
                    "message": "Resume uploaded and queued for processing"
                }
            )
        except Exception as e:
            logger.error(f"WebSocket notify failed (non-critical): {str(e)}")
        
        return {
            "application_id": application_id,
            "status": "resume_uploaded",
            "message": "Resume uploaded successfully and queued for processing",
            "task_id": task.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_my_applications(current_user = Depends(get_current_user)):
    """Return applications for the current authenticated candidate."""
    try:
        db = DatabaseService()
        candidate_id = current_user.get("uid")
        logger.info(f"get_my_applications called for candidate_uid={candidate_id}")
        if not candidate_id:
            raise HTTPException(status_code=400, detail="Invalid user token")

        apps = await db.get_applications_for_candidate(candidate_id)
        try:
            logger.info(f"get_my_applications: found {len(apps)} applications for candidate_uid={candidate_id}")
        except Exception:
            logger.info("get_my_applications: found applications (unable to compute length)")

        # Map applications to a lightweight shape expected by frontend
        mapped = []
        for a in apps:
            mapped.append({
                "_id": a.get("_id"),
                "application_id": a.get("application_id"),
                "job_id": a.get("job_id"),
                "candidate_id": a.get("candidate_id"),
                "candidate_name": a.get("candidate_name") or (a.get("candidate") or {}).get("name"),
                "candidate_email": a.get("candidate_email") or (a.get("candidate") or {}).get("email"),
                "stage": a.get("stage"),
                "status": a.get("status"),
                "created_at": a.get("created_at"),
                "updated_at": a.get("updated_at"),
                "gcs_resume_uri": a.get("gcs_resume_uri"),
                "consent_given": a.get("consent_given"),
                "consent_timestamp": a.get("consent_timestamp"),
                # job metadata for UI
                "job_title": (a.get("job") or {}).get("title") or a.get("job_title"),
                "company": (a.get("job") or {}).get("company") or a.get("company")
            })

        return mapped

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{application_id}")
async def get_application(application_id: str):
    """Get application details."""
    try:
        db = DatabaseService()
        application = await db.get_application(application_id)
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Remove sensitive fields
        application.pop("resume_text", None)
        application.pop("audit_trail", None)
        
        return application
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{application_id}/interview/start")
async def start_interview(
    application_id: str,
    request: StartInterviewRequest
):
    """Start text interview for an application."""
    try:
        print(f"🎯 Starting interview process for application {application_id}...")
        logger.info(f"Interview start requested: application_id={application_id}, num_questions={request.num_questions}")
        
        db = DatabaseService()
        audit = AuditLogger()

        # Get application
        application = await db.get_application(application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        # Resolve job id robustly
        job_id = application.get("job_id") or (application.get("job") or {}).get("job_id") or (application.get("job") or {}).get("_id")
        if not job_id:
            raise HTTPException(status_code=400, detail="Job id not found on application")

        # Enqueue question generation as a Celery task (worker will persist questions)
        try:
            # `StartInterviewRequest` defines `time_per_question_seconds`
            task = generate_interview_questions.delay(
                application_id,
                job_id,
                "technical",
                request.time_per_question_seconds
            )
        except Exception as e:
            logger.error(f"Failed to enqueue interview question generation: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to enqueue interview generation")

        # Mark application as interview scheduled (task running)
        await db.update_application(
            application_id,
            {
                "stage": ApplicationStage.INTERVIEW,
                "status": "interview_scheduled",
                "interview_task_id": task.id,
                "updated_at": datetime.utcnow()
            }
        )

        await audit.log_action(
            actor_uid="system",
            action="interview_queued",
            target_type="application",
            target_id=application_id,
            metadata={
                "task_id": task.id,
                "num_questions": request.num_questions,
                "time_per_question_seconds": request.time_per_question_seconds
            }
        )

        # Non-blocking notify via websocket (best-effort)
        try:
            await websocket_manager.handle_application_update(
                application.get("job_id"),
                application.get("candidate_id"),
                "interview_queued",
                {
                    "application_id": application_id,
                    "status": "interview_queued",
                    "task_id": task.id
                }
            )
        except Exception:
            logger.exception("WebSocket notify failed (non-critical)")

        return {
            "application_id": application_id,
            "status": "interview_queued",
            "task_id": task.id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{application_id}/interview/answer")
async def submit_answer(
    application_id: str,
    answer: InterviewAnswerSubmit
):
    """Submit an answer for a interview question."""
    try:
        db = DatabaseService()
        audit = AuditLogger()
        
        # Get application
        application = await db.get_application(application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Find question
        question = next(
            (q for q in application["gemini_questions"] if q["qid"] == answer.qid),
            None
        )
        if not question:
            raise HTTPException(
                status_code=400,
                detail=f"Question {answer.qid} not found"
            )
        
        # Validate submission time
        if datetime.fromisoformat(answer.submitted_at.isoformat()) > question["expires_at"]:
            # Accept but mark as expired
            answer_record = {
                "qid": answer.qid,
                "answer_text": answer.answer_text,
                "submitted_at": answer.submitted_at,
                "expired": True
            }
            needs_review = True
        else:
            answer_record = {
                "qid": answer.qid,
                "answer_text": answer.answer_text,
                "submitted_at": answer.submitted_at,
                "expired": False
            }
            needs_review = False
        
        # Update application with answer
        gemini_answers = application.get("gemini_answers", [])
        gemini_answers.append(answer_record)
        
        update_data = {
            "gemini_answers": gemini_answers,
            "needs_human_review": needs_review or application.get("needs_human_review", False)
        }
        
        # If all questions answered, trigger scoring
        all_questions = set(q["qid"] for q in application["gemini_questions"])
        answered_questions = set(a["qid"] for a in gemini_answers)
        
        if all_questions == answered_questions:
            task = score_interview.delay(application_id)
            update_data["scoring_task_id"] = task.id
        
        await db.update_application(application_id, update_data)
        
        # Log answer submission
        await audit.log_action(
            actor_uid=application["candidate_id"],
            action="answer_submitted",
            target_type="application",
            target_id=application_id,
            metadata={
                "qid": answer.qid,
                "expired": answer_record["expired"]
            }
        )
        
        return {"ok": True, "message": "Answer received"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{application_id}/interview/result")
async def get_interview_result(application_id: str):
    """Get interview results and Gemini evaluation."""
    try:
        db = DatabaseService()
        application = await db.get_application(application_id)
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
            
        return {
            "application_id": application_id,
            "gemini_results": application.get("gemini_results"),
            "stage": application["stage"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{application_id}/status")
async def update_status(
    application_id: str,
    update: ApplicationStatusUpdate
):
    """Update application status (recruiter only)."""
    try:
        db = DatabaseService()
        audit = AuditLogger()
        
        # Get current application
        application = await db.get_application(application_id)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        old_status = application["status"]
        
        # Update status
        await db.update_application(
            application_id,
            {
                "status": update.status,
                "last_updated_by": update.actor_uid,
                "notes": update.comment
            }
        )
        
        # Log status change
        await audit.log_action(
            actor_uid=update.actor_uid,
            action="application_status_change",
            target_type="application",
            target_id=application_id,
            old_status=old_status,
            new_status=update.status,
            reason=update.comment
        )
        
        # Notify via WebSocket (non-critical)
        try:
            # Notify via WebSocket (non-critical) - status change
            await websocket_manager.handle_application_update(
                application.get("job_id") or application_id,
                application.get("candidate_id") or application_id,
                update.status,
                {
                    "application_id": application_id,
                    "status": update.status,
                    "message": update.comment
                }
            )
        except Exception as e:
            logger.error(f"WebSocket notify failed (non-critical): {str(e)}")
        
        return {"ok": True}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))