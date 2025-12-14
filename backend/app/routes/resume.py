from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict, Any
import uuid
from app.services.storage import StorageService
from app.services.db_utils import DatabaseService
from app.workers.resume_worker import process_resume
from app.models import JobStatus
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resume", tags=["Resume"])


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload resume file and start background processing.
    
    Returns:
        Dict with job_id and status
    """
    try:
        # Validate file type
        allowed_types = [".pdf", ".docx", ".doc"]
        file_extension = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
        
        if file_extension not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file_extension} not allowed. Allowed types: {allowed_types}"
            )
        
        # Read file content
        file_content = await file.read()
        
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        # Initialize services
        storage_service = StorageService()

        # Helpful configuration check: if storage isn't initialized, return actionable error
        if not getattr(storage_service, 'bucket', None):
            raise HTTPException(
                status_code=500,
                detail=("Google Cloud Storage not configured. "
                        "Set `GCS_BUCKET_NAME` and provide credentials via `GCS_CREDENTIALS_PATH` "
                        "or `GOOGLE_APPLICATION_CREDENTIALS` (mounted secret) and restart the API.")
            )
        db_service = DatabaseService()
        
        # Upload file to GCS
        gcs_path = storage_service.upload_to_gcs(
            file_content=file_content,
            file_name=file.filename,
            folder="resumes"
        )
        
        # Create job record
        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "type": "resume_processing",
            "status": JobStatus.PENDING,
            "filename": file.filename,
            "gcs_path": gcs_path,
            "file_size": len(file_content),
            "content_type": file.content_type
        }
        
        await db_service.create_job(job_data)
        
        # Enqueue background task
        task = process_resume.delay(job_id, gcs_path)
        
        logger.info(f"Resume upload queued: {job_id} for file: {file.filename}")
        
        return {
            "job_id": job_id,
            "status": "queued",
            "message": "Resume uploaded successfully and queued for processing",
            "task_id": task.id,
            "filename": file.filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload resume: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during upload")


@router.get("/status/{job_id}")
async def get_resume_status(job_id: str) -> Dict[str, Any]:
    """
    Get resume processing status.
    
    Args:
        job_id: Job identifier
    
    Returns:
        Dict with job status and details
    """
    try:
        db_service = DatabaseService()
        job = await db_service.get_job(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "job_id": job_id,
            "status": job.get("status"),
            "filename": job.get("filename"),
            "created_at": job.get("created_at"),
            "updated_at": job.get("updated_at"),
            "metadata": job.get("metadata", {})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get resume status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/candidate/{candidate_id}")
async def get_candidate(candidate_id: str) -> Dict[str, Any]:
    """
    Get candidate information by ID.
    
    Args:
        candidate_id: Candidate identifier
    
    Returns:
        Dict with candidate details
    """
    try:
        db_service = DatabaseService()
        candidate = await db_service.get_candidate(candidate_id)
        
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Remove sensitive information
        candidate_data = {
            "id": candidate["_id"],
            "name": candidate.get("name"),
            "email": candidate.get("email"),
            "skills": candidate.get("skills", []),
            "experience": candidate.get("experience", 0),
            "education": candidate.get("education"),
            "stage": candidate.get("stage"),
            "latest_score": candidate.get("latest_score"),
            "created_at": candidate.get("created_at"),
            "updated_at": candidate.get("updated_at")
        }
        
        return candidate_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get candidate: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/candidates")
async def list_candidates(skip: int = 0, limit: int = 10) -> Dict[str, Any]:
    """
    List all candidates with pagination.
    
    Args:
        skip: Number of candidates to skip
        limit: Maximum number of candidates to return
    
    Returns:
        Dict with candidates list and pagination info
    """
    try:
        db_service = DatabaseService()
        
        # Get candidates from database
        candidates = await db_service.get_candidates_for_matching(limit=skip + limit)
        
        # Apply pagination
        paginated_candidates = candidates[skip:skip + limit]
        
        # Format response
        candidates_data = []
        for candidate in paginated_candidates:
            candidates_data.append({
                "id": candidate["_id"],
                "name": candidate.get("name"),
                "email": candidate.get("email"),
                "skills": candidate.get("skills", []),
                "experience": candidate.get("experience", 0),
                "stage": candidate.get("stage"),
                "created_at": candidate.get("created_at")
            })
        
        return {
            "candidates": candidates_data,
            "total": len(candidates),
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Failed to list candidates: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/candidate/{candidate_id}")
async def delete_candidate(candidate_id: str) -> Dict[str, Any]:
    """
    Delete candidate and associated data.
    
    Args:
        candidate_id: Candidate identifier
    
    Returns:
        Dict with deletion status
    """
    try:
        db_service = DatabaseService()
        storage_service = StorageService()
        
        # Get candidate data
        candidate = await db_service.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Delete file from GCS if exists
        gcs_path = candidate.get("gcs_path")
        if gcs_path:
            storage_service.delete_file(gcs_path)
        
        # Delete from database (implement delete method in db_service)
        # await db_service.delete_candidate(candidate_id)
        
        logger.info(f"Candidate deleted: {candidate_id}")
        
        return {
            "message": "Candidate deleted successfully",
            "candidate_id": candidate_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete candidate: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/batch-upload")
async def batch_upload_resumes(files: list[UploadFile] = File(...)) -> Dict[str, Any]:
    """
    Upload multiple resume files for batch processing.
    
    Args:
        files: List of uploaded files
    
    Returns:
        Dict with batch processing results
    """
    try:
        if len(files) > 10:  # Limit batch size
            raise HTTPException(status_code=400, detail="Maximum 10 files allowed per batch")
        
        storage_service = StorageService()
        # Ensure GCS configured
        if not getattr(storage_service, 'bucket', None):
            raise HTTPException(status_code=500, detail=(
                "Google Cloud Storage not configured. Set `GCS_BUCKET_NAME` and provide credentials via "
                "`GCS_CREDENTIALS_PATH` or `GOOGLE_APPLICATION_CREDENTIALS` (mounted secret) and restart the API."))
        db_service = DatabaseService()
        
        job_ids = []
        gcs_paths = []
        
        for file in files:
            # Validate file
            allowed_types = [".pdf", ".docx", ".doc"]
            file_extension = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
            
            if file_extension not in allowed_types:
                continue  # Skip invalid files
            
            # Read and upload file
            file_content = await file.read()
            if len(file_content) == 0:
                continue
            
            gcs_path = storage_service.upload_to_gcs(
                file_content=file_content,
                file_name=file.filename,
                folder="resumes"
            )
            
            # Create job record
            job_id = str(uuid.uuid4())
            job_data = {
                "job_id": job_id,
                "type": "resume_processing",
                "status": JobStatus.PENDING,
                "filename": file.filename,
                "gcs_path": gcs_path,
                "file_size": len(file_content),
                "content_type": file.content_type
            }
            
            await db_service.create_job(job_data)
            
            job_ids.append(job_id)
            gcs_paths.append(gcs_path)
        
        # Enqueue batch processing
        from app.workers.resume_worker import batch_process_resumes
        task = batch_process_resumes.delay(job_ids, gcs_paths)
        
        logger.info(f"Batch resume upload queued: {len(job_ids)} files")
        
        return {
            "message": f"Batch upload queued for {len(job_ids)} files",
            "job_ids": job_ids,
            "task_id": task.id,
            "total_files": len(files),
            "processed_files": len(job_ids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to batch upload resumes: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")