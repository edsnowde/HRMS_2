"""Synchronous wrappers around async services for Celery workers."""

import asyncio
import logging
import functools
import uuid

# Configure logging
logger = logging.getLogger(__name__)
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from .db_utils import DatabaseService
from app.config import settings
from pymongo import MongoClient
from bson.objectid import ObjectId


def _get_sync_db():
    client = MongoClient(settings.mongo_url)
    return client[settings.mongo_db_name]


def run_async(coro):
    """Helper to run coroutine in sync context."""
    # Create a fresh event loop and run the coroutine to avoid reusing/closing the global loop.
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        asyncio.set_event_loop(None)
        loop.close()


class SyncDatabaseService:
    """Sync wrapper for DatabaseService to be used in Celery tasks."""

    def __init__(self):
        # Do not create DatabaseService here; instantiate it inside the event loop for each call
        self._async_service = None

    def _call(self, method_name: str, *args, **kwargs):
        """Run a DatabaseService method inside a fresh event loop to avoid 'Event loop is closed' errors."""
        async def _inner():
            svc = DatabaseService()
            method = getattr(svc, method_name)
            return await method(*args, **kwargs)

        return run_async(_inner())

    # Job Management
    def create_job(self, job_data: Dict[str, Any]) -> str:
        """Sync wrapper for create_job."""
        return self._call('create_job', job_data)

    def update_job_status(self, job_id: str, status: str, metadata: Dict[str, Any] = None) -> bool:
        """Sync wrapper for update_job_status."""
        return self._call('update_job_status', job_id, status, metadata)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Sync wrapper for get_job."""
        return self._call('get_job', job_id)

    # Candidate Management
    def save_candidate(self, candidate_data: Dict[str, Any]) -> str:
        """Sync wrapper for save_candidate.

        Use a synchronous pymongo path to avoid AsyncIO loop issues in Celery workers.
        Will update existing candidate if email already exists.
        """
        existing = None
        try:
            db = _get_sync_db()
            email = candidate_data.get('email')

            # If email is missing or None, create a deterministic placeholder using application_id
            if not email:
                app_id = candidate_data.get('application_id') or str(uuid.uuid4())
                email = f"candidate_{app_id}@placeholder.local"
                # persist placeholder back into candidate_data so downstream code sees it
                candidate_data['email'] = email

            # Try to find existing candidate by email
            existing = db.candidates.find_one({"email": email})

            if existing:
                # Update existing candidate
                update_data = candidate_data.copy()
                update_data["updated_at"] = datetime.utcnow()

                # Don't overwrite created_at if it exists
                if "created_at" in update_data and existing.get("created_at"):
                    del update_data["created_at"]

                result = db.candidates.find_one_and_update(
                    {"_id": existing["_id"]},
                    {"$set": update_data},
                    return_document=True
                )
                return str(result["_id"])
            else:
                # Insert new candidate
                candidate_data.update({
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "stage": "Profile Created"
                })
                res = db.candidates.insert_one(candidate_data)
                return str(res.inserted_id)
        except Exception as e:
            logger.error(f"Error saving candidate: {str(e)}")
            # Return existing ID even if update fails
            if existing:
                return str(existing["_id"])
            raise

    def create_candidate_profile(self, candidate_data: Dict[str, Any], user_id: str) -> str:
        """Sync wrapper for create_candidate_profile."""
        return self._call('create_candidate_profile', candidate_data, user_id)

    def get_candidate(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        """Sync wrapper for get_candidate."""
        return self._call('get_candidate', candidate_id)

    def update_candidate_score(self, candidate_id: str, score_data: Dict[str, Any], job_id: str = None) -> bool:
        """Sync wrapper for update_candidate_score."""
        return self._call('update_candidate_score', candidate_id, score_data, job_id)

    def get_candidates_for_matching(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Sync wrapper for get_candidates_for_matching."""
        return self._call('get_candidates_for_matching', limit)

    # Interview Management
    def save_interview(self, interview_data: Dict[str, Any]) -> str:
        """Sync wrapper for save_interview."""
        return self._call('save_interview', interview_data)

    def get_interview(self, interview_id: str) -> Optional[Dict[str, Any]]:
        """Sync wrapper for get_interview."""
        return self._call('get_interview', interview_id)

    # Job Matching 
    def store_job_matches(self, job_id: str, matches: List[Dict[str, Any]]) -> bool:
        """Sync wrapper for store_job_matches."""
        return self._call('store_job_matches', job_id, matches)

    def get_job_matches(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Sync wrapper for get_job_matches."""
        return self._call('get_job_matches', job_id)

    # File Management
    def get_expired_files(self, cutoff_date: datetime) -> List[Dict[str, Any]]:
        """Sync wrapper for get_expired_files."""
        return self._call('get_expired_files', cutoff_date)

    def mark_file_deleted(self, file_id: str) -> bool:
        """Sync wrapper for mark_file_deleted."""
        return self._call('mark_file_deleted', file_id)

    # Application Management
    def create_application(self, application_data: Dict[str, Any]) -> str:
        """Sync wrapper for create_application."""
        return self._call('create_application', application_data)

    def get_application(self, application_id: str) -> Optional[Dict[str, Any]]:
        """Sync wrapper for get_application."""
        return self._call('get_application', application_id)

    def get_application_by_job_and_candidate(self, job_id: str, candidate_id: str) -> Optional[Dict[str, Any]]:
        """Sync wrapper for get_application_by_job_and_candidate."""
        return self._call('get_application_by_job_and_candidate', job_id, candidate_id)

    def update_application(self, application_id: str, update_data: Dict[str, Any]) -> bool:
        """Sync wrapper for update_application."""
        try:
            db = _get_sync_db()
            update_data["updated_at"] = datetime.utcnow()
            result = db.applications.update_one({"application_id": application_id}, {"$set": update_data})
            return result.modified_count > 0
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"Sync update_application failed: {str(e)}")
            return False

    # System Stats
    def get_system_stats(self) -> Dict[str, Any]:
        """Sync wrapper for get_system_stats."""
        return self._call('get_system_stats')

    # User Management
    def save_user(self, user_data: Dict[str, Any]) -> str:
        """Sync wrapper for save_user."""
        return self._call('save_user', user_data)

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Sync wrapper for get_user."""
        return self._call('get_user', user_id)

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Sync wrapper for get_user_by_email."""
        return self._call('get_user_by_email', email)

    def close(self):
        """Close database connection."""
        return self._call('close')