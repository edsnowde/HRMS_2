from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict, Any, List
import json
import uuid
from app.websocket_manager import websocket_manager
from app.services.db_utils import DatabaseService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Job Status & WebSocket"])


@router.get("/status")
async def get_all_jobs_status() -> Dict[str, Any]:
    """
    Get status of all jobs in the system.
    
    Returns:
        Dict with all jobs status
    """
    try:
        db_service = DatabaseService()
        
        # Get system statistics
        stats = await db_service.get_system_stats()
        
        return {
            "total_jobs": stats.get("total_jobs", 0),
            "active_jobs": stats.get("active_jobs", 0),
            "completed_jobs": stats.get("completed_jobs", 0),
            "failed_jobs": stats.get("failed_jobs", 0),
            "recent_jobs": stats.get("recent_jobs", 0),
            "system_status": "operational"
        }
        
    except Exception as e:
        logger.error(f"Failed to get jobs status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/status/{job_id}")
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """
    Get detailed status of a specific job.
    
    Args:
        job_id: Job identifier
    
    Returns:
        Dict with job status details
    """
    try:
        db_service = DatabaseService()
        job = await db_service.get_job(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "job_id": job_id,
            "type": job.get("type"),
            "status": job.get("status"),
            "created_at": job.get("created_at"),
            "updated_at": job.get("updated_at"),
            "metadata": job.get("metadata", {}),
            "progress": _calculate_progress(job)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/queue")
async def get_queue_status() -> Dict[str, Any]:
    """
    Get current queue status for background jobs.
    
    Returns:
        Dict with queue information
    """
    try:
        # This would integrate with Celery to get queue status
        # For now, return placeholder data
        
        return {
            "queues": {
                "resume": {
                    "pending": 0,
                    "processing": 0,
                    "completed": 0,
                    "failed": 0
                },
                "scoring": {
                    "pending": 0,
                    "processing": 0,
                    "completed": 0,
                    "failed": 0
                },
                # voice queue removed (deprecated in text-only ATS)
            },
            "total_pending": 0,
            "total_processing": 0,
            "message": "Queue status not yet implemented"
        }
        
    except Exception as e:
        logger.error(f"Failed to get queue status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/retry/{job_id}")
async def retry_job(job_id: str) -> Dict[str, Any]:
    """
    Retry a failed job.
    
    Args:
        job_id: Job identifier
    
    Returns:
        Dict with retry status
    """
    try:
        db_service = DatabaseService()
        job = await db_service.get_job(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.get("status") != "FAILED":
            raise HTTPException(status_code=400, detail="Only failed jobs can be retried")
        
        # Update job status to pending
        await db_service.update_job_status(job_id, "PENDING")
        
        # Re-queue the job based on type
        job_type = job.get("type")
        
        if job_type == "resume_processing":
            from app.workers.resume_worker import process_resume
            gcs_path = job.get("gcs_path")
            if gcs_path:
                task = process_resume.delay(job_id, gcs_path)
        else:
            # Video/audio processing removed. Only resume processing supported for retry.
            raise HTTPException(status_code=400, detail=f"Unsupported or unknown job type for retry: {job_type}")
        
        logger.info(f"Job retried: {job_id}")
        
        return {
            "job_id": job_id,
            "status": "retried",
            "message": "Job has been queued for retry",
            "task_id": task.id if 'task' in locals() else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retry job: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, user_id: str = None):
    """
    WebSocket endpoint for real-time job status updates.
    
    Args:
        websocket: WebSocket connection
        user_id: Optional user identifier for user-specific updates
    """
    connection_id = str(uuid.uuid4())
    
    try:
        # Connect to WebSocket manager
        await websocket_manager.connect(websocket, connection_id, user_id)
        
        # Send initial connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connected",
            "connection_id": connection_id,
            "user_id": user_id,
            "message": "Connected to real-time updates"
        }))
        
        # Keep connection alive and listen for messages
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": str(uuid.uuid4().time)
                    }))
                    
                elif message.get("type") == "subscribe_job":
                    job_id = message.get("job_id")
                    if job_id:
                        await websocket.send_text(json.dumps({
                            "type": "subscription_confirmed",
                            "job_id": job_id,
                            "message": f"Subscribed to updates for job {job_id}"
                        }))
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Internal server error"
                }))
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket connection error: {str(e)}")
    finally:
        # Disconnect from WebSocket manager
        websocket_manager.disconnect(connection_id, user_id)


@router.get("/metrics")
async def get_system_metrics() -> Dict[str, Any]:
    """
    Get system performance metrics.
    
    Returns:
        Dict with system metrics
    """
    try:
        # Get WebSocket connection stats
        ws_stats = websocket_manager.get_connection_stats()
        
        # Get database stats
        db_service = DatabaseService()
        db_stats = await db_service.get_system_stats()
        
        # Get cache stats (implement in cache service)
        # cache_stats = cache_service.get_cache_stats()
        
        return {
            "websocket_connections": ws_stats,
            "database_stats": db_stats,
            "cache_stats": {},  # Placeholder
            "system_health": "healthy",
            "uptime": "N/A",  # Would need to implement uptime tracking
            "memory_usage": "N/A",
            "cpu_usage": "N/A"
        }
        
    except Exception as e:
        logger.error(f"Failed to get system metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/cleanup")
async def cleanup_completed_jobs() -> Dict[str, Any]:
    """
    Clean up old completed and failed jobs.
    
    Returns:
        Dict with cleanup results
    """
    try:
        # This would implement cleanup logic
        # For now, return placeholder response
        
        return {
            "message": "Cleanup completed",
            "jobs_cleaned": 0,
            "files_deleted": 0,
            "status": "placeholder"
        }
        
    except Exception as e:
        logger.error(f"Failed to cleanup jobs: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


def _calculate_progress(job: Dict[str, Any]) -> int:
    """Calculate job progress percentage based on status."""
    status = job.get("status", "")
    
    progress_map = {
        "PENDING": 0,
        "PROCESSING": 50,
        "MATCHING": 75,
        "MATCHING_COMPLETED": 90,
        "COMPLETED": 100,
        "FAILED": 0
    }
    
    return progress_map.get(status, 0)
