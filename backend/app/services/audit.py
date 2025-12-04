from typing import Dict, Any, Optional
from datetime import datetime
from app.services.db_utils import DatabaseService
from app.models import AuditLog
import logging
import hashlib
from app.config import settings
from pymongo import MongoClient

logger = logging.getLogger(__name__)


class AuditService:
    """Service for comprehensive audit logging and compliance."""
    
    def __init__(self):
        self.db_service = DatabaseService()
    
    async def log_action(
        self,
        actor_uid: str,
        action: str,
        target_type: str,
        target_id: str,
        metadata: Optional[Dict[str, Any]] = None,
        old_status: Optional[str] = None,
        new_status: Optional[str] = None,
        reason: Optional[str] = None
    ) -> str:
        """
        Generic action logger for all types of actions.
        
        Args:
            actor_uid: ID of the actor (user/system) performing the action
            action: Type of action being performed
            target_type: Type of entity being acted upon
            target_id: ID of the entity being acted upon
            metadata: Additional context about the action
            old_status: Previous status (for status changes)
            new_status: New status (for status changes)
            reason: Human-readable reason for the action
            
        Returns:
            str: Audit log entry ID
        """
        try:
            audit_data = {
                "actor_uid": actor_uid,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "metadata": metadata or {},
                "old_status": old_status,
                "new_status": new_status,
                "reason": reason,
                "timestamp": datetime.utcnow(),
                "requires_human_review": self._requires_human_review(action, metadata)
            }
            
            audit_id = await self.db_service.save_audit_log(audit_data)
            logger.info(f"Action logged: {action} on {target_type}={target_id} by {actor_uid}")
            return audit_id
            
        except Exception as e:
            logger.error(f"Failed to log action: {str(e)}")
            raise
    
    async def log_ai_decision(
        self,
        actor_uid: str,
        action: str,
        target_type: str,
        target_id: str,
        ai_snapshot: Dict[str, Any],
        reason: Optional[str] = None,
        model_version: Optional[str] = None,
        prompt_hash: Optional[str] = None
    ) -> str:
        """
        Log AI decision with full audit trail.
        
        Args:
            actor_uid: User who triggered the action
            action: Action performed (e.g., "candidate_scored", "auto_rejected")
            target_type: Type of target (candidate, job, etc.)
            target_id: ID of the target
            ai_snapshot: AI decision details (score, rationale, etc.)
            reason: Human reason for action
            model_version: AI model version used
            prompt_hash: Hash of prompt used
        
        Returns:
            Audit log ID
        """
        try:
            audit_data = {
                "actor_uid": actor_uid,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "ai_snapshot": ai_snapshot,
                "reason": reason,
                "model_version": model_version,
                "prompt_hash": prompt_hash,
                "timestamp": datetime.utcnow(),
                "requires_human_review": self._requires_human_review(action, ai_snapshot)
            }
            
            audit_id = await self.db_service.save_audit_log(audit_data)
            logger.info(f"AI decision logged: {action} by {actor_uid}")
            
            return audit_id
            
        except Exception as e:
            logger.error(f"Failed to log AI decision: {str(e)}")
            raise
    
    async def log_stage_transition(
        self,
        actor_uid: str,
        candidate_id: str,
        from_stage: str,
        to_stage: str,
        reason: str,
        ai_snapshot: Optional[Dict[str, Any]] = None
    ) -> str:
        """Log candidate stage transition."""
        try:
            audit_data = {
                "actor_uid": actor_uid,
                "action": "stage_transition",
                "target_type": "candidate",
                "target_id": candidate_id,
                "ai_snapshot": ai_snapshot,
                "reason": f"Transition from {from_stage} to {to_stage}: {reason}",
                "metadata": {
                    "from_stage": from_stage,
                    "to_stage": to_stage
                },
                "timestamp": datetime.utcnow(),
                "requires_human_review": self._requires_human_review("stage_transition", ai_snapshot)
            }
            
            audit_id = await self.db_service.save_audit_log(audit_data)
            return audit_id
            
        except Exception as e:
            logger.error(f"Failed to log stage transition: {str(e)}")
            raise
    
    async def log_file_operation(
        self,
        actor_uid: str,
        action: str,
        file_id: str,
        file_type: str,
        reason: Optional[str] = None
    ) -> str:
        """Log file operations (upload, delete, etc.)."""
        try:
            audit_data = {
                "actor_uid": actor_uid,
                "action": action,
                "target_type": "file",
                "target_id": file_id,
                "reason": reason,
                "metadata": {
                    "file_type": file_type
                },
                "timestamp": datetime.utcnow(),
                "requires_human_review": False
            }
            
            audit_id = await self.db_service.save_audit_log(audit_data)
            return audit_id
            
        except Exception as e:
            logger.error(f"Failed to log file operation: {str(e)}")
            raise
    
    async def log_system_action(
        self,
        action: str,
        details: Dict[str, Any],
        reason: Optional[str] = None
    ) -> str:
        """Log system-level actions."""
        try:
            audit_data = {
                "actor_uid": "system",
                "action": action,
                "target_type": "system",
                "target_id": "system",
                "reason": reason,
                "metadata": details,
                "timestamp": datetime.utcnow(),
                "requires_human_review": False
            }
            
            audit_id = await self.db_service.save_audit_log(audit_data)
            return audit_id
            
        except Exception as e:
            # If saving via the async DB client fails (for example when called from a
            # synchronous context where the event loop may be closed), fall back to
            # the synchronous pymongo insertion helper so we don't raise further
            # and cause retries in sync workers (Celery).
            logger.error(f"Failed to log system action via async DB: {str(e)} - falling back to sync log_error")
            try:
                # Best-effort synchronous fallback; do not re-raise to avoid cascading failures
                self.log_error(operation=action, entity_id="system", error=str(e))
            except Exception as fallback_err:
                logger.error(f"Failed to write system action fallback log: {fallback_err}")
            # Return empty id to callers instead of re-raising
            return ""
    
    async def get_audit_trail(
        self,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        actor_uid: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> list:
        """Retrieve audit trail with filtering."""
        try:
            filters = {}
            
            if target_type:
                filters["target_type"] = target_type
            if target_id:
                filters["target_id"] = target_id
            if actor_uid:
                filters["actor_uid"] = actor_uid
            if start_date:
                filters["timestamp"] = {"$gte": start_date}
            if end_date:
                if "timestamp" in filters:
                    filters["timestamp"]["$lte"] = end_date
                else:
                    filters["timestamp"] = {"$lte": end_date}
            
            audit_logs = await self.db_service.get_audit_logs(filters, limit)
            return audit_logs
            
        except Exception as e:
            logger.error(f"Failed to get audit trail: {str(e)}")
            return []
    
    async def export_audit_data(
        self,
        job_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Export audit data for compliance."""
        try:
            filters = {}
            
            if job_id:
                filters["target_id"] = job_id
            if start_date:
                filters["timestamp"] = {"$gte": start_date}
            if end_date:
                if "timestamp" in filters:
                    filters["timestamp"]["$lte"] = end_date
                else:
                    filters["timestamp"] = {"$lte": end_date}
            
            audit_logs = await self.db_service.get_audit_logs(filters, 1000)
            
            return {
                "export_timestamp": datetime.utcnow(),
                "total_records": len(audit_logs),
                "filters_applied": filters,
                "audit_logs": audit_logs
            }
            
        except Exception as e:
            logger.error(f"Failed to export audit data: {str(e)}")
            return {}

    def log_error(self, *, operation: str = "error", entity_id: Optional[str] = None, error: str = "") -> None:
        """
        Synchronous helper to log errors from synchronous contexts (e.g., Celery tasks).

        This method will synchronously run the async DB save operation. It's intended
        for use where `await` is not available. It intentionally swallows failures
        to avoid cascading exceptions in error-handling paths.
        """
        try:
            audit_data = {
                "actor_uid": "system",
                "action": operation,
                "target_type": "system",
                "target_id": entity_id or "unknown",
                "metadata": {"error": str(error)},
                "timestamp": datetime.utcnow(),
                "requires_human_review": False,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

            # Perform a synchronous insert using pymongo to avoid asyncio issues
            try:
                client = MongoClient(self.db_service.client._client.uri if hasattr(self.db_service, 'client') and getattr(self.db_service.client, '_client', None) else None) if False else None
            except Exception:
                client = None

            try:
                # Best-effort: try using DatabaseService internals if available
                if hasattr(self.db_service, 'client') and getattr(self.db_service.client, 'address', None) is not None:
                    # DatabaseService uses motor; construct a pymongo client from settings
                    client = MongoClient(self.db_service.client._get_client().address if hasattr(self.db_service.client, '_get_client') else settings.mongo_url)
                if not client:
                    client = MongoClient(settings.mongo_url)
                db = client[settings.mongo_db_name]
                db.audit_logs.insert_one(audit_data)
            except Exception as e:
                logger.error(f"Failed to save audit error entry (pymongo fallback): {e}")

        except Exception as e:
            logger.error(f"Unexpected error in log_error helper: {e}")
    
    def _requires_human_review(self, action: str, ai_snapshot: Optional[Dict[str, Any]]) -> bool:
        """Determine if action requires human review."""
        # Actions that always require human review
        auto_reject_actions = ["auto_reject", "auto_disqualify"]
        
        if action in auto_reject_actions:
            return True
        
        # AI decisions with low confidence scores
        if ai_snapshot:
            score = ai_snapshot.get("score", 0)
            if isinstance(score, (int, float)) and score < 30:
                return True
            
            # Check for fairness flags
            if ai_snapshot.get("fairness_flagged", False):
                return True
        
        return False
    
    def generate_prompt_hash(self, prompt: str, model_config: Dict[str, Any]) -> str:
        """Generate hash for prompt and model configuration."""
        try:
            combined = f"{prompt}:{model_config}"
            return hashlib.sha256(combined.encode()).hexdigest()
        except Exception as e:
            logger.error(f"Failed to generate prompt hash: {str(e)}")
            return "unknown"
    
    async def check_fairness_compliance(self, job_id: str) -> Dict[str, Any]:
        """Check fairness compliance for a job."""
        try:
            # Get all candidates for this job
            candidates = await self.db_service.get_candidates_for_job(job_id)
            
            # Basic fairness metrics (placeholder - would need demographic data)
            total_candidates = len(candidates)
            
            if total_candidates == 0:
                return {"status": "no_data", "message": "No candidates found"}
            
            # Calculate selection rates by various criteria
            fairness_metrics = {
                "total_candidates": total_candidates,
                "selection_rate": 0.0,
                "disparate_impact_ratio": 1.0,
                "flagged_decisions": 0,
                "human_review_required": 0
            }
            
            # Count flagged decisions
            flagged_count = sum(1 for c in candidates if c.get("fairness_flagged", False))
            human_review_count = sum(1 for c in candidates if c.get("needs_human_review", False))
            
            fairness_metrics["flagged_decisions"] = flagged_count
            fairness_metrics["human_review_required"] = human_review_count
            
            return fairness_metrics
            
        except Exception as e:
            logger.error(f"Failed to check fairness compliance: {str(e)}")
            return {"error": str(e)}


# Backwards compatibility alias
class AuditLogger(AuditService):
    """Alias for AuditService retained for older imports."""
    pass
