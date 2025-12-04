from datetime import datetime, timedelta
from typing import Dict, Any
from app.workers.celery_app import celery
from app.services.db_utils import DatabaseService
from app.services.storage import StorageService
from app.services.cache import CacheService
from app.config import settings


@celery.task(name="app.workers.cleanup_worker.cleanup_expired_files", bind=True)
def cleanup_expired_files(self, days_old: int = 30) -> Dict[str, Any]:
    """
    Clean up expired files from Google Cloud Storage.
    
    Args:
        days_old: Files older than this many days will be deleted
    
    Returns:
        Dict with cleanup results
    """
    try:
        storage_service = StorageService()
        db_service = DatabaseService()
        
        # Get files older than specified days
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        expired_files = db_service.get_expired_files(cutoff_date)
        
        deleted_count = 0
        errors = []
        
        for file_record in expired_files:
            try:
                gcs_path = file_record.get('gcs_path')
                if gcs_path:
                    # Delete from GCS
                    storage_service.delete_file(gcs_path)
                    
                    # Update database record
                    db_service.mark_file_deleted(file_record['_id'])
                    deleted_count += 1
                    
            except Exception as e:
                errors.append({
                    "file_id": file_record.get('_id'),
                    "error": str(e)
                })
        
        return {
            "deleted_count": deleted_count,
            "errors": errors,
            "status": "completed"
        }
        
    except Exception as e:
        raise self.retry(exc=e, countdown=300, max_retries=3)


@celery.task(name="app.workers.cleanup_worker.cleanup_cache", bind=True)
def cleanup_cache(self) -> Dict[str, Any]:
    """
    Clean up expired cache entries from Redis.
    
    Returns:
        Dict with cleanup results
    """
    try:
        cache_service = CacheService()
        
        # Clean up expired embeddings cache
        embeddings_cleaned = cache_service.cleanup_expired_embeddings()
        
        # Clean up expired scores cache
        scores_cleaned = cache_service.cleanup_expired_scores()
        
        # Clean up expired session data
        sessions_cleaned = cache_service.cleanup_expired_sessions()
        
        return {
            "embeddings_cleaned": embeddings_cleaned,
            "scores_cleaned": scores_cleaned,
            "sessions_cleaned": sessions_cleaned,
            "status": "completed"
        }
        
    except Exception as e:
        raise self.retry(exc=e, countdown=300, max_retries=3)


@celery.task(name="app.workers.cleanup_worker.cleanup_failed_jobs", bind=True)
def cleanup_failed_jobs(self, days_old: int = 7) -> Dict[str, Any]:
    """
    Clean up old failed job records from database.
    
    Args:
        days_old: Failed jobs older than this many days will be cleaned up
    
    Returns:
        Dict with cleanup results
    """
    try:
        db_service = DatabaseService()
        
        # Get failed jobs older than specified days
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        failed_jobs = db_service.get_failed_jobs(cutoff_date)
        
        cleaned_count = 0
        errors = []
        
        for job in failed_jobs:
            try:
                # Archive or delete failed job
                db_service.archive_failed_job(job['_id'])
                cleaned_count += 1
                
            except Exception as e:
                errors.append({
                    "job_id": job.get('_id'),
                    "error": str(e)
                })
        
        return {
            "cleaned_count": cleaned_count,
            "errors": errors,
            "status": "completed"
        }
        
    except Exception as e:
        raise self.retry(exc=e, countdown=300, max_retries=3)


@celery.task(name="app.workers.cleanup_worker.optimize_index")
def optimize_index() -> Dict[str, Any]:
    """
    Optimize Pinecone index by removing stale vectors.
    
    Returns:
        Dict with optimization results
    """
    try:
        from app.services.embedder import EmbedderService

        embedder = EmbedderService()

        # Get stale vectors (application-specific logic)
        stale_vectors = embedder.find_stale_vectors()

        if stale_vectors:
            # Attempt to delete stale vectors (if supported)
            deleted_count = embedder.delete_vectors(stale_vectors)

            return {
                "stale_vectors_found": len(stale_vectors),
                "deleted_count": deleted_count,
                "status": "completed"
            }
        else:
            return {
                "stale_vectors_found": 0,
                "deleted_count": 0,
                "status": "completed"
            }
        
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed"
        }


# Periodic cleanup tasks
@celery.task(name="app.workers.cleanup_worker.daily_cleanup")
def daily_cleanup() -> Dict[str, Any]:
    """
    Run daily cleanup tasks.
    
    Returns:
        Dict with all cleanup results
    """
    results = {}
    
    try:
        # Clean up expired files (30 days old)
        results['files'] = cleanup_expired_files.delay(30).get()
    except Exception as e:
        results['files'] = {"error": str(e)}
    
    try:
        # Clean up cache
        results['cache'] = cleanup_cache.delay().get()
    except Exception as e:
        results['cache'] = {"error": str(e)}
    
    try:
        # Clean up failed jobs (7 days old)
        results['failed_jobs'] = cleanup_failed_jobs.delay(7).get()
    except Exception as e:
        results['failed_jobs'] = {"error": str(e)}
    
    try:
        # Optimize index (Vertex-aware)
        results['index'] = optimize_index.delay().get()
    except Exception as e:
        results['index'] = {"error": str(e)}
    
    return results
