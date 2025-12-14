from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import uuid
import logging
from datetime import datetime

from app.services.db_utils import DatabaseService
from app.services.embedder import EmbedderService
from app.workers.scoring_worker import match_job_candidates, score_candidate
from app.models import JobStatus, JobCreate, JobDescriptionSchema

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/job", tags=["Job"])


@router.post("/create")
async def create_job(job: JobCreate) -> Dict[str, Any]:
    """
    Create a new job posting.
    """
    try:
        db_service = DatabaseService()
        embedder = EmbedderService()

        # Create job record
        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "type": "job_creation",
            "status": JobStatus.ACTIVE,
            "title": job.title,
            "description": job.description,
            "requirements": job.requirements,
            "skills_required": job.skills_required,
            "experience_required": job.experience_required,
            "location": job.location,
            "salary_range": job.salary_range,
            "employment_type": job.employment_type,
            "department": job.department
        }

        await db_service.create_job(job_data)

        # Create embedding for job description and upsert richer metadata to Pinecone
        try:
            # Create a vector id and upsert embedding including useful metadata
            vector_id = embedder.create_embedding(job.description)
            metadata = {
                "title": job.title,
                "requirements": job.requirements,
                "skills_required": job.skills_required,
                "experience_required": job.experience_required,
                "location": job.location,
                "salary_range": job.salary_range,
                "employment_type": job.employment_type,
                "department": job.department,
                "type": "job",
                "job_id": job_id,
                "timestamp": __import__('datetime').datetime.utcnow().isoformat()
            }
            # Upsert will include both the text and the metadata so searches can filter on these fields
            try:
                embedder.upsert_to_pinecone(vector_id, job.description, metadata)
            except Exception:
                # Best-effort: if upsert fails, still continue
                logger.warning(f"Failed to upsert richer metadata to Pinecone for job {job_id}")

            job_data["embedding_id"] = vector_id
            await db_service.update_job_status(job_id, JobStatus.ACTIVE, {"embedding_id": vector_id})
        except Exception as e:
            logger.warning(f"Failed to create embedding for job {job_id}: {str(e)}")
            await db_service.update_job_status(job_id, JobStatus.ACTIVE)

        logger.info(f"Job created successfully: {job_id}")

        return {
            "job_id": job_id,
            "status": "created",
            "message": "Job created successfully",
            "title": job.title
        }

    except Exception as e:
        logger.error(f"Failed to create job: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{job_id}/match")
async def match_candidates(job_id: str, top_k: int = 10) -> Dict[str, Any]:
    """
    Match candidates against an existing job.
    
    Args:
        job_id: The job ID to match candidates against
        top_k: Maximum number of candidates to return (default 10, max 100)
    """
    try:
        print("🔍 Starting candidate matching process...")
        if top_k > 100:
            raise HTTPException(status_code=400, detail="top_k cannot exceed 100")

        db_service = DatabaseService()
        
        # Get existing job - try both _id and job_id fields
        job = await db_service.get_job(job_id)
        if not job:
            # Try searching by job_id field as fallback
            job = await db_service.db.jobs.find_one({"job_id": job_id})
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
            
        # Try all possible field names for job description
        job_desc = (job.get("description") or 
                   job.get("job_description") or 
                   job.get("requirements") or
                   "".join([
                       job.get("title", ""),
                       "\n\nRequirements:\n",
                       "\n".join(job.get("skills_required", [])),
                       "\n\nExperience Required: ",
                       str(job.get("experience_required", "")),
                       "\n\nLocation: ",
                       job.get("location", ""),
                       "\n\nEmployment Type: ",
                       job.get("employment_type", "")
                   ]))

        if not job_desc or not job_desc.strip():
            raise HTTPException(status_code=400, detail="Job has no description or requirements")
            
        # Create matching job record
        matching_id = str(uuid.uuid4())
        job_data = {
            "job_id": matching_id,
            "type": "job_matching",
            "status": JobStatus.PENDING,
            "original_job_id": job_id,  # Link to original job
            "job_description": job_desc
        }

        await db_service.create_job(job_data)

        # Enqueue matching task with user-specified top_k
        task = match_job_candidates.delay(matching_id, job_desc, top_k=top_k)

        logger.info(f"Job matching queued for job {job_id} with top_k={top_k}")

        return {
            "job_id": matching_id,  # Return ID of matching job for status tracking
            "original_job_id": job_id,
            "status": "queued", 
            "message": "Job matching started",
            "task_id": task.id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to match candidates: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/matches/{job_id}")
async def get_job_matches(job_id: str) -> Dict[str, Any]:
    """
    Get job matching results.
    """
    try:
        db_service = DatabaseService()

        job = await db_service.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        matches = await db_service.get_job_matches(job_id)
        if not matches:
            return {
                "job_id": job_id,
                "status": job.get("status"),
                "matches": [],
                "message": "No matches found yet"
            }

        formatted_matches = [
            {
                "candidate_id": match.get("candidate_id"),
                "similarity_score": match.get("similarity_score", 0),
                "task_id": match.get("task_id"),
                "status": match.get("status", "pending")
            }
            for match in matches.get("matches", [])
        ]

        return {
            "job_id": job_id,
            "status": job.get("status"),
            "total_candidates": matches.get("total_candidates", 0),
            "matches": formatted_matches,
            "created_at": matches.get("created_at")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job matches: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/list")
async def list_jobs(skip: int = 0, limit: int = 10) -> Dict[str, Any]:
    """List jobs with pagination (compatibility for frontend)."""
    try:
        db_service = DatabaseService()
        return await db_service.list_jobs(skip=skip, limit=limit)
    except Exception as e:
        logger.error(f"Failed to list jobs: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/status/{job_id}")
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """
    Get job processing status.
    """
    try:
        db_service = DatabaseService()
        job = await db_service.get_job(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return {
            "job_id": job_id,
            "status": job.get("status"),
            "type": job.get("type"),
            "created_at": job.get("created_at"),
            "updated_at": job.get("updated_at"),
            "metadata": job.get("metadata", {})
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/jobs/{job_id}/applications")
async def get_job_applications(job_id: str) -> Dict[str, Any]:
    """
    Compatibility endpoint for frontend: returns enriched application objects for a job.
    First tries to get direct applications, then falls back to matches.
    """
    try:
        db_service = DatabaseService()
        
        # First try to get direct applications for this job
        applications = await db_service.get_applications_by_job(job_id)
        if applications:
            # Format applications for frontend
            formatted_apps = [{
                "application_id": app.get("application_id") or str(app.get("_id")),
                "candidate_id": app.get("candidate_id"),
                "candidate_name": app.get("candidate_name") or "Unknown",
                "resume_url": app.get("gcs_resume_uri") or app.get("gcs_path"),
                "status": app.get("status") or "pending",
                "match_score": app.get("ai_match_score") or app.get("match_score"),
                **app
            } for app in applications]
            return {
                "job_id": job_id,
                "applications": formatted_apps
            }

        # If no direct applications, try matches
        matches_doc = await db_service.get_job_matches(job_id)
        if not matches_doc or not matches_doc.get('matches'):
            return {
                "job_id": job_id,
                "applications": [],
                "message": "No applications found"
            }

        enriched = []
        for m in matches_doc.get('matches', []):
            app_id = m.get('application_id') or m.get('applicationId')
            candidate_id = m.get('candidate_id') or m.get('candidateId')
            similarity = m.get('similarity_score') or m.get('score') or 0
            task_id = m.get('task_id') or m.get('taskId')

            # Try to fetch application document details
            app_doc = None
            if app_id:
                try:
                    app_doc = await db_service.get_application(app_id)
                except Exception:
                    app_doc = None

            # Format for frontend consistency
            enriched.append({
                "application_id": app_id or f"match-{candidate_id}",
                "candidate_id": candidate_id,
                "candidate_name": (app_doc or {}).get("candidate_name", "Unknown"),
                "resume_url": (app_doc or {}).get("gcs_resume_uri") or (app_doc or {}).get("gcs_path"),
                "status": (app_doc or {}).get("status", "pending"),
                "match_score": similarity,
                **(app_doc or {})
            })
            
        return {"job_id": job_id, "applications": enriched}

    except Exception as e:
        logger.error(f"Failed to get job applications compatibility: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/jobs/{job_id}/final-results")
async def get_job_final_results(job_id: str) -> Dict[str, Any]:
    """
    Return full application documents for a given job id to support the Final AI Results UI.
    This includes full fields such as `pinecone_metadata`, `gemini_questions`, `gemini_answers`,
    `ai_match_score`, `resume_vector_id`, and resume links.
    """
    try:
        db_service = DatabaseService()

        # Build resilient query matching patterns used elsewhere
        query_or = []
        query_or.append({"job_id": job_id})
        query_or.append({"jobId": job_id})
        query_or.append({"original_job_id": job_id})

        # Try to include possible ObjectId-stored values as well
        try:
            from bson import ObjectId
            if ObjectId.is_valid(job_id):
                obj = ObjectId(job_id)
                query_or.append({"job_id": obj})
                query_or.append({"jobId": obj})
                query_or.append({"original_job_id": obj})
        except Exception:
            pass

        query_or.append({"job._id": job_id})

        cursor = db_service.db.applications.find({"$or": query_or})

        applications = []
        async for app in cursor:
            # Normalize _id to string
            try:
                if app.get("_id") is not None:
                    app["_id"] = str(app.get("_id"))
            except Exception:
                pass

            # Helper: normalize BSON-like wrappers and datetimes recursively
            def _normalize_value(val):
                try:
                    # Handle Mongo extended JSON numeric wrappers
                    if isinstance(val, dict):
                        # Dates: {"$date": {"$numberLong": "..."}} or {"$date": 123}
                        if "$date" in val:
                            inner = val["$date"]
                            if isinstance(inner, dict) and "$numberLong" in inner:
                                try:
                                    return datetime.fromtimestamp(int(inner["$numberLong"]) / 1000).isoformat()
                                except Exception:
                                    return str(val)
                            try:
                                # Could be ISO string or epoch millis
                                if isinstance(inner, str) and inner.isdigit():
                                    return datetime.fromtimestamp(int(inner) / 1000).isoformat()
                                if isinstance(inner, (int, float)):
                                    return datetime.fromtimestamp(float(inner) / 1000).isoformat()
                                return inner
                            except Exception:
                                return str(inner)

                        # Numeric wrappers: $numberDouble, $numberInt, $numberLong
                        if "$numberDouble" in val:
                            try:
                                return float(val["$numberDouble"])
                            except Exception:
                                return val["$numberDouble"]
                        if "$numberInt" in val:
                            try:
                                return int(val["$numberInt"])
                            except Exception:
                                return val["$numberInt"]
                        if "$numberLong" in val:
                            try:
                                return int(val["$numberLong"])
                            except Exception:
                                return val["$numberLong"]

                        # Otherwise recurse into dict
                        out = {}
                        for k, v in val.items():
                            out[k] = _normalize_value(v)
                        return out

                    if isinstance(val, list):
                        return [_normalize_value(x) for x in val]

                    # datetimes -> ISO
                    if isinstance(val, datetime):
                        return val.isoformat()

                    return val
                except Exception:
                    return val

            # Convert some top-level datetime fields to ISO strings and normalize nested structures
            for dt_field in ("created_at", "updated_at", "consent_timestamp"):
                if isinstance(app.get(dt_field), datetime):
                    try:
                        app[dt_field] = app[dt_field].isoformat()
                    except Exception:
                        pass

            # Normalize nested arrays/objects that commonly contain dates or numeric wrappers
            if "gemini_questions" in app and isinstance(app["gemini_questions"], list):
                app["gemini_questions"] = [_normalize_value(q) for q in app.get("gemini_questions", [])]
            if "gemini_answers" in app and isinstance(app["gemini_answers"], list):
                app["gemini_answers"] = [_normalize_value(a) for a in app.get("gemini_answers", [])]
            if "interview_statistics" in app and isinstance(app["interview_statistics"], dict):
                app["interview_statistics"] = _normalize_value(app["interview_statistics"])

            applications.append(app)

        # Attempt to enrich applications with Pinecone similarity scores from job_matches
        try:
            # Build queries to find any job_matches documents that reference this job
            matches_query_or = [
                {"original_job_id": job_id},
                {"job_id": job_id},
                {"jobId": job_id}
            ]
            # Include ObjectId variants if applicable
            try:
                from bson import ObjectId
                if ObjectId.is_valid(job_id):
                    obj = ObjectId(job_id)
                    matches_query_or.extend([
                        {"original_job_id": obj},
                        {"job_id": obj},
                        {"jobId": obj}
                    ])
            except Exception:
                pass

            score_lookup = {}
            cursor_matches = db_service.db.job_matches.find({"$or": matches_query_or})
            async for doc in cursor_matches:
                for m in (doc.get("matches") or []):
                    # keys can vary between application_id, applicationId, candidate_id, candidateId
                    key = m.get("application_id") or m.get("applicationId") or m.get("candidate_id") or m.get("candidateId")
                    raw_score = m.get("similarity_score") or m.get("score") or m.get("similarity")

                    def _to_num(v):
                        try:
                            # Handle BSON numeric wrappers like {"$numberDouble": "0.27"}
                            if isinstance(v, dict) and "$numberDouble" in v:
                                return float(v.get("$numberDouble"))
                            if isinstance(v, dict) and "$numberLong" in v:
                                return float(v.get("$numberLong"))
                            if isinstance(v, str):
                                return float(v)
                            if isinstance(v, (int, float)):
                                return float(v)
                        except Exception:
                            return None
                        return None

                    num = _to_num(raw_score)
                    if key:
                        score_lookup[str(key)] = num

            # Merge scores into application docs where possible
            for app in applications:
                # check multiple possible keys on the application
                app_keys = [
                    app.get("application_id") or app.get("_id"),
                    app.get("applicationId"),
                    app.get("candidate_id"),
                    app.get("candidateId")
                ]
                found = None
                for k in app_keys:
                    if k is None:
                        continue
                    if str(k) in score_lookup:
                        found = score_lookup.get(str(k))
                        break

                # attach normalized numeric field if we found a score
                if found is not None:
                    try:
                        app["pinecone_similarity_score"] = float(found) if found is not None else None
                        # also keep legacy key used elsewhere
                        app["match_score"] = app.get("match_score") or app.get("ai_match_score") or app.get("pinecone_similarity_score")
                    except Exception:
                        app["pinecone_similarity_score"] = None
        except Exception:
            # Best-effort enrichment; do not fail the endpoint if match merging fails
            logger.exception("Failed to enrich applications with similarity scores")

        return {"job_id": job_id, "applications": applications}

    except Exception as e:
        logger.error(f"Failed to get final results for job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/score/{candidate_id}")
async def score_candidate_for_job(candidate_id: str, job: JobDescriptionSchema) -> Dict[str, Any]:
    """
    Score a specific candidate against a job description.
    """
    try:
        db_service = DatabaseService()

        candidate = await db_service.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "type": "candidate_scoring",
            "status": JobStatus.PENDING,
            "candidate_id": candidate_id,
            "job_description": job.job_desc
        }

        await db_service.create_job(job_data)

        task = score_candidate.delay(candidate_id, job.job_desc, job_id)

        logger.info(f"Candidate scoring queued: {candidate_id} for job {job_id}")

        return {
            "job_id": job_id,
            "candidate_id": candidate_id,
            "status": "queued",
            "message": "Candidate scoring started",
            "task_id": task.id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to score candidate: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/list")
async def list_jobs(skip: int = 0, limit: int = 10) -> Dict[str, Any]:
    """
    List all jobs with pagination.
    """
    try:
        db_service = DatabaseService()

        # Find all jobs including those created via job_creation or match
        cursor = db_service.db.jobs.find(
            {
                "$or": [
                    {"type": "job_creation"},
                    {"type": {"$exists": False}}  # Include jobs without type for backward compatibility
                ]
            },
            skip=skip,
            limit=limit
        ).sort("created_at", -1)  # Sort by newest first
        
        jobs = []
        async for job in cursor:
            # Convert ObjectId to string and ensure job_id is present
            job_id = str(job.get("_id"))
            normalized_job = {
                "_id": job_id,
                "job_id": job.get("job_id") or job_id,
                "title": job.get("title", "Untitled Job"),
                "description": job.get("description", ""),
                "requirements": job.get("requirements", []),
                "skills_required": job.get("skills_required", []),
                "experience_required": job.get("experience_required"),
                "location": job.get("location", "Remote"),
                "salary_range": job.get("salary_range"),
                "employment_type": job.get("employment_type", "full-time"),
                "department": job.get("department"),
                "status": job.get("status", "active"),
                "created_at": job.get("created_at", None),
                "updated_at": job.get("updated_at", None)
            }
            
            # Ensure lists for skills and requirements
            if isinstance(normalized_job["skills_required"], str):
                normalized_job["skills_required"] = normalized_job["skills_required"].split(",")
            elif not isinstance(normalized_job["skills_required"], list):
                normalized_job["skills_required"] = []
                
            if isinstance(normalized_job["requirements"], str):
                normalized_job["requirements"] = normalized_job["requirements"].split(",")
            elif not isinstance(normalized_job["requirements"], list):
                normalized_job["requirements"] = []
            
            # Clean empty/None values
            normalized_job = {k: v for k, v in normalized_job.items() if v is not None}
            
            jobs.append(normalized_job)

        total = await db_service.db.jobs.count_documents({"type": "job_creation"})

        return {
            "jobs": jobs,
            "total": total,
            "skip": skip,
            "limit": limit
        }

    except Exception as e:
        logger.error(f"Failed to list jobs: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/analytics")
async def get_job_analytics() -> Dict[str, Any]:
    """
    Get job-related analytics and statistics.
    """
    try:
        db_service = DatabaseService()
        stats = await db_service.get_system_stats()

        return {
            "total_jobs": stats.get("total_jobs", 0),
            "active_jobs": stats.get("active_jobs", 0),
            "completed_jobs": stats.get("completed_jobs", 0),
            "failed_jobs": stats.get("failed_jobs", 0),
            "recent_jobs": stats.get("recent_jobs", 0),
            "total_candidates": stats.get("total_candidates", 0),
            "total_interviews": stats.get("total_interviews", 0)
        }

    except Exception as e:
        logger.error(f"Failed to get job analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{job_id}")
async def get_job(job_id: str) -> Dict[str, Any]:
    """
    Get full job record by id. Tries _id first, then job_id field for compatibility.
    """
    try:
        db_service = DatabaseService()

        job = await db_service.get_job(job_id)
        # If no job by _id, try searching by job_id field (UUID stored in document)
        if not job:
            job = await db_service.db.jobs.find_one({"job_id": job_id})

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Normalize _id to string
        job["_id"] = str(job.get("_id"))
        return job

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/reindex")
async def reindex_jobs() -> Dict[str, Any]:
    """
    Re-index all jobs into Pinecone with richer metadata. Useful to backfill existing vectors.
    """
    try:
        db_service = DatabaseService()
        embedder = EmbedderService()

        cursor = db_service.db.jobs.find({})
        count = 0
        async for job in cursor:
            try:
                text = job.get("description") or job.get("job_description") or ""
                vector_id = job.get("embedding_id") or str(job.get("_id"))
                metadata = {
                    "title": job.get("title"),
                    "requirements": job.get("requirements"),
                    "skills_required": job.get("skills_required"),
                    "experience_required": job.get("experience_required"),
                    "location": job.get("location"),
                    "salary_range": job.get("salary_range"),
                    "employment_type": job.get("employment_type"),
                    "department": job.get("department"),
                    "type": "job",
                    "job_id": str(job.get("_id") or job.get("job_id")),
                    "timestamp": __import__('datetime').datetime.utcnow().isoformat()
                }
                embedder.upsert_to_pinecone(vector_id, text, metadata)
                count += 1
            except Exception as e:
                logger.warning(f"Failed to upsert job {job.get('_id')}: {str(e)}")

        return {"reindexed": count}

    except Exception as e:
        logger.error(f"Failed to reindex jobs: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# @router.post("/reindex/resumes")
# async def reindex_resumes() -> Dict[str, Any]:
#     """
#     Re-index all application/resume vectors into Pinecone with richer metadata.
#     This will attempt to backfill missing resume_vector_id and pinecone_metadata
#     for application documents by using existing resume text (or candidate resume)
#     and upserting to the configured Pinecone index.
#     """
#     try:
#         db_service = DatabaseService()
#         embedder = EmbedderService()

#         cursor = db_service.db.applications.find({})
#         reindexed = 0
#         skipped = 0
#         failures = 0

#         async for app in cursor:
#             try:
#                 app_id = app.get("application_id") or str(app.get("_id"))
#                 candidate_id = app.get("candidate_id")

#                 # Build canonical metadata
#                 metadata = {
#                     "application_id": app_id,
#                     "candidate_id": candidate_id or "",
#                     "vector_type": "resume",
#                     "timestamp": __import__('datetime').datetime.utcnow().isoformat(),
#                     "candidate_name": app.get("candidate_name", "") or "",
#                     "email": (app.get("email") or "")
#                 }

#                 vector_id = app.get("resume_vector_id")

#                 # If a vector exists, fetch it and ensure metadata is present/complete
#                 if vector_id:
#                     try:
#                         vec = embedder.get_vector(vector_id)
#                         # If vector exists but metadata is missing or incomplete, upsert enriched metadata
#                         existing_meta = (vec or {}).get("metadata") or {}
#                         needs_upsert = False
#                         if not existing_meta.get("application_id") or not existing_meta.get("candidate_id"):
#                             needs_upsert = True

#                         if needs_upsert:
#                             text = app.get("resume_text") or ""
#                             # If text not present in application, try candidate record
#                             if not text and candidate_id:
#                                 try:
#                                     cand = await db_service.get_candidate(candidate_id)
#                                     text = cand.get("resume_text") if cand else ""
#                                 except Exception:
#                                     text = ""

#                             # Use a short text if missing to avoid failing encode
#                             if not text:
#                                 # Nothing to reindex for this vector; skip
#                                 skipped += 1
#                                 continue

#                             embedder.upsert_to_pinecone(vector_id, text, metadata)
#                             # Persist updated metadata to application
#                             await db_service.update_application(app_id, {"pinecone_metadata": metadata})
#                             reindexed += 1
#                         else:
#                             skipped += 1

#                     except Exception as ve:
#                         logger.warning(f"Failed to refresh vector {vector_id} metadata: {str(ve)}")
#                         failures += 1
#                         continue
#                 else:
#                     # No vector id: attempt to create one from available text
#                     text = app.get("resume_text") or ""
#                     if not text and candidate_id:
#                         try:
#                             cand = await db_service.get_candidate(candidate_id)
#                             text = cand.get("resume_text") if cand else ""
#                         except Exception:
#                             text = ""

#                     if not text or not text.strip():
#                         skipped += 1
#                         continue

#                     # Create embedding and upsert with metadata
#                     try:
#                         new_vector_id = embedder.create_embedding(text)
#                         embedder.upsert_to_pinecone(new_vector_id, text, metadata)
#                         # Persist vector id and metadata back to application
#                         await db_service.update_application(app_id, {
#                             "resume_vector_id": new_vector_id,
#                             "pinecone_metadata": metadata
#                         })
#                         reindexed += 1
#                     except Exception as ce:
#                         logger.warning(f"Failed to create/upsert embedding for app {app_id}: {str(ce)}")
#                         failures += 1
#                         continue

#         return {"reindexed": reindexed, "skipped": skipped, "failures": failures}

#     except Exception as e:
#         logger.error(f"Failed to reindex resumes: {str(e)}")
#         raise HTTPException(status_code=500, detail="Internal server error")
