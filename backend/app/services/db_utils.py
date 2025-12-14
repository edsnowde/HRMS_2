from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for MongoDB operations."""
    
    def __init__(self):
        self.client = AsyncIOMotorClient(settings.mongo_url)
        self.db = self.client[settings.mongo_db_name]
    
    # Job Management
    async def create_job(self, job_data: Dict[str, Any]) -> str:
        """Create a new job record."""
        try:
            print(f"📝 Creating new job: {job_data.get('title', 'Untitled')}")
            job_data.update({
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "status": "PENDING"
            })
            
            result = await self.db.jobs.insert_one(job_data)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create job: {str(e)}")
            raise
    
    async def update_job_status(self, job_id: str, status: str, metadata: Dict[str, Any] = None) -> bool:
        """Update job status."""
        try:
            update_data = {
                "status": status,
                "updated_at": datetime.utcnow()
            }
            
            if metadata:
                update_data["metadata"] = metadata
            
            result = await self.db.jobs.update_one(
                {"_id": job_id},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update job status: {str(e)}")
            return False
    
    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job by ID. Tries both _id and job_id fields."""
        try:
            # First try to find by job_id (the UUID field)
            job = await self.db.jobs.find_one({"job_id": job_id})
            if not job:
                # If not found, try by _id (the MongoDB ObjectId)
                job = await self.db.jobs.find_one({"_id": job_id})
            if job and job.get("_id"):
                job["_id"] = str(job["_id"])
            return job
        except Exception as e:
            logger.error(f"Failed to get job: {str(e)}")
            return None

    async def list_jobs(self, skip: int = 0, limit: int = 10) -> Dict[str, Any]:
        """List jobs with pagination."""
        try:
            cursor = self.db.jobs.find().sort("created_at", -1).skip(int(skip)).limit(int(limit))
            jobs = []
            async for job in cursor:
                try:
                    if job.get("_id") is not None:
                        job["_id"] = str(job.get("_id"))
                except Exception:
                    pass
                jobs.append(job)

            total = await self.db.jobs.count_documents({})

            return {
                "jobs": jobs,
                "total": total,
                "skip": int(skip),
                "limit": int(limit),
            }
        except Exception as e:
            logger.error(f"Failed to list jobs: {str(e)}")
            return {"jobs": [], "total": 0, "skip": int(skip), "limit": int(limit)}
    
    # Candidate Management
    async def save_candidate(self, candidate_data: Dict[str, Any]) -> str:
        """Save candidate data."""
        try:
            print(f"👤 Creating candidate profile: {candidate_data.get('name', 'Anonymous')}")
            logger.info(f"Creating candidate with email: {candidate_data.get('email', 'no-email')}")
            
            candidate_data.update({
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "stage": "Profile Created"
            })
            
            result = await self.db.candidates.insert_one(candidate_data)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save candidate: {str(e)}")
            raise

    async def create_candidate_profile(self, candidate_data: Dict[str, Any], user_id: str) -> str:
        """Create a new candidate profile."""
        try:
            candidate_data.update({
                "user_id": user_id,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "stage": "Profile Created",
                "latest_score": None
            })
            
            result = await self.db.candidates.insert_one(candidate_data)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create candidate profile: {str(e)}")
            raise
    
    async def get_candidate(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        """Get candidate by ID."""
        try:
            # Candidates may be referenced by their MongoDB ObjectId or by string IDs stored elsewhere.
            # Try to resolve robustly: attempt ObjectId conversion first, then fall back to string lookup
            try:
                from bson import ObjectId
                if ObjectId.is_valid(candidate_id):
                    candidate = await self.db.candidates.find_one({"_id": ObjectId(candidate_id)})
                    if candidate:
                        # normalize _id to string for callers
                        try:
                            candidate["_id"] = str(candidate.get("_id"))
                        except Exception:
                            pass
                        return candidate
            except Exception:
                # If bson/ObjectId not available or conversion fails, continue to other lookups
                pass

            # Try direct string match on _id (some code stores string IDs)
            candidate = await self.db.candidates.find_one({"_id": candidate_id})
            if candidate:
                try:
                    candidate["_id"] = str(candidate.get("_id"))
                except Exception:
                    pass
                return candidate

            # As a last resort, try to find by candidate_id field (if candidate was stored under that key)
            candidate = await self.db.candidates.find_one({"candidate_id": candidate_id})
            if candidate:
                try:
                    candidate["_id"] = str(candidate.get("_id"))
                except Exception:
                    pass
            return candidate
        except Exception as e:
            logger.error(f"Failed to get candidate: {str(e)}")
            return None

    async def get_candidate_by_user_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get candidate document by associated authentication user id (user_id).

        This helps map Firebase UID (or other auth uid) to the candidate Mongo document.
        """
        try:
            candidate = await self.db.candidates.find_one({"user_id": user_id})
            if candidate and candidate.get("_id"):
                try:
                    candidate["_id"] = str(candidate.get("_id"))
                except Exception:
                    pass
            return candidate
        except Exception as e:
            logger.error(f"Failed to get candidate by user_id: {str(e)}")
            return None
    
    async def update_candidate_score(self, candidate_id: str, score_data: Dict[str, Any], job_id: str = None) -> bool:
        """Update candidate with score data."""
        try:
            update_data = {
                "updated_at": datetime.utcnow(),
                "latest_score": score_data
            }
            
            if job_id:
                update_data["latest_job_score"] = {
                    "job_id": job_id,
                    "score": score_data.get("score"),
                    "rationale": score_data.get("rationale"),
                    "timestamp": datetime.utcnow()
                }
            
            result = await self.db.candidates.update_one(
                {"_id": candidate_id},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update candidate score: {str(e)}")
            return False
    
    async def get_candidates_for_matching(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get candidates for job matching."""
        try:
            cursor = self.db.candidates.find(
                {"stage": "Profile Created"},
                limit=limit
            )
            
            candidates = []
            async for candidate in cursor:
                candidates.append(candidate)
            
            return candidates
        except Exception as e:
            logger.error(f"Failed to get candidates for matching: {str(e)}")
            return []
    
    # Interview Management
    async def save_interview(self, interview_data: Dict[str, Any]) -> str:
        """Save interview data."""
        try:
            interview_data.update({
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            
            result = await self.db.interviews.insert_one(interview_data)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save interview: {str(e)}")
            raise
    
    async def get_interview(self, interview_id: str) -> Optional[Dict[str, Any]]:
        """Get interview by ID."""
        try:
            interview = await self.db.interviews.find_one({"_id": interview_id})
            return interview
        except Exception as e:
            logger.error(f"Failed to get interview: {str(e)}")
            return None
    
    # Job Matching
    async def store_job_matches(self, job_id: str, matches: List[Dict[str, Any]]) -> bool:
        """Store job matching results."""
        try:
            print(f"🎯 Storing {len(matches)} matches for job {job_id}")
            logger.info(f"Job matching complete: job_id={job_id}, num_matches={len(matches)}")
            
            match_data = {
                "job_id": job_id,
                "matches": matches,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = await self.db.job_matches.insert_one(match_data)
            return result.inserted_id is not None
        except Exception as e:
            logger.error(f"Failed to store job matches: {str(e)}")
            return False
    
    async def get_job_matches(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job matching results."""
        try:
            matches = await self.db.job_matches.find_one({"job_id": job_id})
            return matches
        except Exception as e:
            logger.error(f"Failed to get job matches: {str(e)}")
            return None
    
    # Audit Logging
    async def save_audit_log(self, audit_data: Dict[str, Any]) -> str:
        """Save audit log entry."""
        try:
            audit_data.update({
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            
            result = await self.db.audit_logs.insert_one(audit_data)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save audit log: {str(e)}")
            raise

    async def get_audit_logs(self, filters: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
        """Get audit logs with filters."""
        try:
            cursor = self.db.audit_logs.find(filters).limit(limit).sort("timestamp", -1)
            logs = []
            async for log in cursor:
                logs.append(log)
            return logs
        except Exception as e:
            logger.error(f"Failed to get audit logs: {str(e)}")
            return []
    
    # File Management
    async def get_expired_files(self, cutoff_date: datetime) -> List[Dict[str, Any]]:
        """Get files older than cutoff date."""
        try:
            cursor = self.db.files.find({
                "created_at": {"$lt": cutoff_date},
                "deleted": {"$ne": True}
            })
            
            files = []
            async for file in cursor:
                files.append(file)
            
            return files
        except Exception as e:
            logger.error(f"Failed to get expired files: {str(e)}")
            return []
    
    async def mark_file_deleted(self, file_id: str) -> bool:
        """Mark file as deleted."""
        try:
            result = await self.db.files.update_one(
                {"_id": file_id},
                {
                    "$set": {
                        "deleted": True,
                        "deleted_at": datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to mark file as deleted: {str(e)}")
            return False
    
    # Failed Jobs Management
    async def get_failed_jobs(self, cutoff_date: datetime) -> List[Dict[str, Any]]:
        """Get failed jobs older than cutoff date."""
        try:
            cursor = self.db.jobs.find({
                "status": "FAILED",
                "updated_at": {"$lt": cutoff_date}
            })
            
            jobs = []
            async for job in cursor:
                jobs.append(job)
            
            return jobs
        except Exception as e:
            logger.error(f"Failed to get failed jobs: {str(e)}")
            return []
    
    async def archive_failed_job(self, job_id: str) -> bool:
        """Archive failed job."""
        try:
            result = await self.db.jobs.update_one(
                {"_id": job_id},
                {
                    "$set": {
                        "archived": True,
                        "archived_at": datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to archive failed job: {str(e)}")
            return False
    
    # Application Management
    async def create_application(self, application_data: Dict[str, Any]) -> str:
        """Create a new application record."""
        try:
            print(f"📝 Creating new application")
            logger.info(f"Creating application for job_id={application_data.get('job_id')}")
            
            # Add timestamps and initialize required fields
            application_data.update({
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "gemini_questions": [],
                "gemini_answers": [],
                "audit_trail": [],
                "needs_human_review": False,
                "fairness_flagged": False,
                "resume_text": None,
                "resume_vector_id": None,
                "ai_match_score": None,
                "gcs_resume_uri": None,
                "pinecone_metadata": None
            })
            
            try:
                result = await self.db.applications.insert_one(application_data)
                return str(result.inserted_id)
            except Exception as db_error:
                if "duplicate key error" in str(db_error):
                    # Try to get existing application
                    existing = await self.db.applications.find_one({
                        "job_id": application_data["job_id"],
                        "candidate_id": application_data["candidate_id"]
                    })
                    if existing:
                        return str(existing["_id"])
                raise
                
        except Exception as e:
            logger.error(f"Failed to create application: {str(e)}")
            raise
    
    async def get_applications_by_job(self, job_id: str) -> List[Dict[str, Any]]:
        """Get all applications for a specific job."""
        try:
            # Build a resilient query that attempts to match the provided job identifier
            # against several possible stored forms (string UUID, Mongo ObjectId, alternative keys)
            query_or = []

            # Direct string match against common fields
            query_or.append({"job_id": job_id})
            query_or.append({"jobId": job_id})
            query_or.append({"original_job_id": job_id})

            # Sometimes applications were created storing the MongoDB ObjectId of the job
            # as an actual ObjectId. Try converting the incoming id to ObjectId and match.
            try:
                from bson import ObjectId
                if ObjectId.is_valid(job_id):
                    obj = ObjectId(job_id)
                    # job_id may be stored as ObjectId type
                    query_or.append({"job_id": obj})
                    query_or.append({"jobId": obj})
                    query_or.append({"original_job_id": obj})
            except Exception:
                # If bson isn't available or conversion fails, ignore this part
                pass

            # Also support cases where job reference was stored under a nested 'job._id' or as _id
            query_or.append({"job._id": job_id})
            query_or.append({"job_id": {"$in": [job_id]}})

            cursor = self.db.applications.find({"$or": query_or})
            
            applications = []
            async for app in cursor:
                # Ensure all necessary fields are present
                # Build a sanitized application dict to avoid returning raw MongoDB types
                normalized_app = {
                    "_id": str(app.get("_id")) if app.get("_id") else None,
                    "application_id": app.get("application_id") or str(app.get("_id")),
                    "candidate_id": app.get("candidate_id") or app.get("candidateId"),
                    "candidate_name": app.get("candidate_name") or app.get("name") or "Unknown",
                    "resume_url": app.get("gcs_resume_uri") or app.get("gcs_path") or "",
                    "status": app.get("status") or app.get("stage") or "pending",
                    "match_score": app.get("ai_match_score") or app.get("match_score") or app.get("similarity_score"),
                    # Include a few safe metadata fields if present
                    "job_id": app.get("job_id") or app.get("jobId") or app.get("original_job_id"),
                    "created_at": app.get("created_at"),
                    "updated_at": app.get("updated_at")
                }
                applications.append(normalized_app)
                
            return applications
        except Exception as e:
            logger.error(f"Failed to get applications for job {job_id}: {str(e)}")
            return []

    async def get_application(self, application_id: str) -> Optional[Dict[str, Any]]:
        """Get application by ID."""
        try:
            # Try both the application_id field and _id field
            application = await self.db.applications.find_one({"$or": [
                {"application_id": application_id},
                {"_id": application_id}
            ]})
            if application and application.get("_id"):
                application["_id"] = str(application["_id"])
            return application
        except Exception as e:
            logger.error(f"Failed to get application: {str(e)}")
            return None
            
    async def get_application_by_job_and_candidate(
        self,
        job_id: str,
        candidate_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get application by job_id and candidate_id combination."""
        try:
            application = await self.db.applications.find_one({
                "job_id": job_id,
                "candidate_id": candidate_id
            })
            return application
        except Exception as e:
            logger.error(f"Failed to get application by job and candidate: {str(e)}")
            return None

    async def get_applications_for_candidate(self, candidate_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get applications for a specific candidate_id.

        Returns a list of application documents sorted by updated_at desc.
        """
        try:
            # Build a resilient query that attempts to match the provided candidate identifier
            # against several possible stored forms (candidate_id, candidateId, candidate_uid,
            # nested candidate._id). Many application documents already include a `candidate_uid`
            # field (the auth UID) — include that so requests authenticated by UID match directly.
            query_or = []
            query_or.append({"candidate_id": candidate_id})
            query_or.append({"candidateId": candidate_id})
            query_or.append({"candidate._id": candidate_id})
            query_or.append({"candidate_uid": candidate_id})

            # Try ObjectId match if the provided id looks like an ObjectId
            try:
                from bson import ObjectId
                if ObjectId.is_valid(candidate_id):
                    obj = ObjectId(candidate_id)
                    query_or.append({"candidate_id": obj})
                    query_or.append({"candidateId": obj})
                    query_or.append({"candidate._id": obj})
            except Exception:
                pass

            logger.info(f"get_applications_for_candidate: querying applications with $or={query_or}")
            cursor = self.db.applications.find({"$or": query_or}).sort("updated_at", -1).limit(limit)
            apps: List[Dict[str, Any]] = []
            async for app in cursor:
                # Convert ObjectId to string for safety when returning via FastAPI
                if app.get("_id") is not None:
                    try:
                        app["_id"] = str(app["_id"])
                    except Exception:
                        pass
                apps.append(app)
            # If no apps found, it's possible the caller provided a Firebase UID
            # (auth uid) instead of the application's stored candidate_id (which
            # may be the Mongo ObjectId string). Try to resolve the candidate
            # by common candidate fields (user_id or candidate_id) and re-query
            # the applications collection using the resolved candidate._id.
            if len(apps) == 0:
                try:
                    logger.info(f"No applications found for candidate_id={candidate_id}; attempting candidate resolution")
                    # Try to find a candidate/profile that maps to this UID
                    candidate_doc = await self.db.candidates.find_one({"user_id": candidate_id})
                    if not candidate_doc:
                        candidate_doc = await self.db.candidates.find_one({"candidate_id": candidate_id})

                    if candidate_doc and candidate_doc.get("_id"):
                        try:
                            resolved_id = str(candidate_doc.get("_id"))
                            logger.info(f"Resolved candidate uid {candidate_id} -> candidate._id={resolved_id}")
                            # Query applications by the resolved candidate id and also by candidate_uid
                            query_or2 = [
                                {"candidate_id": resolved_id},
                                {"candidateId": resolved_id},
                                {"candidate._id": resolved_id},
                                {"candidate_uid": candidate_id}
                            ]
                            logger.info(f"get_applications_for_candidate: retry query $or={query_or2}")
                            cursor2 = self.db.applications.find({"$or": query_or2}).sort("updated_at", -1).limit(limit)
                            async for app2 in cursor2:
                                if app2.get("_id") is not None:
                                    try:
                                        app2["_id"] = str(app2.get("_id"))
                                    except Exception:
                                        pass
                                apps.append(app2)
                            if apps:
                                logger.info(f"Found {len(apps)} applications after resolving candidate uid={candidate_id}")
                        except Exception as e:
                            logger.exception(f"Error during candidate resolution query: {e}")
                except Exception as e:
                    logger.exception(f"Candidate resolution attempt failed: {e}")

            return apps
        except Exception as e:
            logger.error(f"Failed to get applications for candidate {candidate_id}: {str(e)}")
            return []
    
    async def update_application(self, application_id: str, update_data: Dict[str, Any]) -> bool:
        """Update application data."""
        try:
            update_data["updated_at"] = datetime.utcnow()
            
            result = await self.db.applications.update_one(
                {"application_id": application_id},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update application: {str(e)}")
            return False
    
    # Analytics
    async def get_system_stats(self) -> Dict[str, Any]:
        """Get system statistics."""
        try:
            stats = {}
            
            # Count collections
            stats["total_candidates"] = await self.db.candidates.count_documents({})
            stats["total_jobs"] = await self.db.jobs.count_documents({})
            stats["total_interviews"] = await self.db.interviews.count_documents({})
            stats["active_jobs"] = await self.db.jobs.count_documents({"status": {"$in": ["PENDING", "PROCESSING", "MATCHING"]}})
            stats["completed_jobs"] = await self.db.jobs.count_documents({"status": "COMPLETED"})
            stats["failed_jobs"] = await self.db.jobs.count_documents({"status": "FAILED"})
            
            # Recent activity (last 24 hours)
            yesterday = datetime.utcnow() - timedelta(days=1)
            stats["recent_candidates"] = await self.db.candidates.count_documents({"created_at": {"$gte": yesterday}})
            stats["recent_jobs"] = await self.db.jobs.count_documents({"created_at": {"$gte": yesterday}})
            stats["recent_interviews"] = await self.db.interviews.count_documents({"created_at": {"$gte": yesterday}})
            
            return stats
        except Exception as e:
            logger.error(f"Failed to get system stats: {str(e)}")
            return {}
    
    # User Management (for HRMS features)
    async def save_user(self, user_data: Dict[str, Any]) -> str:
        """Save user data."""
        try:
            user_data.update({
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            
            result = await self.db.users.insert_one(user_data)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save user: {str(e)}")
            raise
    
    async def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        try:
            user = await self.db.users.find_one({"_id": user_id})
            return user
        except Exception as e:
            logger.error(f"Failed to get user: {str(e)}")
            return None
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email."""
        try:
            user = await self.db.users.find_one({"email": email})
            return user
        except Exception as e:
            logger.error(f"Failed to get user by email: {str(e)}")
            return None
    
    # Close connection
    async def close(self):
        """Close database connection."""
        try:
            self.client.close()
            logger.info("Database connection closed")
        except Exception as e:
            logger.error(f"Failed to close database connection: {str(e)}")
