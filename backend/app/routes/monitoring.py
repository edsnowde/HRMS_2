"""
Routes for monitoring dashboard and audit data access.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from app.auth import get_current_user, require_role
from app.services.metrics import metrics_service
from app.services.audit import AuditService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/monitoring",
    tags=["Monitoring & Audit"]
)

audit_service = AuditService()


@router.get("/metrics/system")
async def get_system_metrics(
    current_user = Depends(require_role(["admin", "system"]))
) -> Dict[str, Any]:
    """Get system-wide metrics dashboard data."""
    try:
        return await metrics_service.get_system_metrics()
    except Exception as e:
        logger.error(f"Failed to get system metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve metrics")


@router.get("/metrics/ai")
async def get_ai_metrics(
    operation_type: Optional[str] = None,
    timeframe: str = "24h",
    current_user = Depends(require_role(["admin", "system"]))
) -> Dict[str, Any]:
    """Get AI operation metrics."""
    try:
        metrics = await metrics_service.get_ai_metrics()
        
        if operation_type:
            metrics = {k: v for k, v in metrics.items() if operation_type in k}
            
        return metrics
    except Exception as e:
        logger.error(f"Failed to get AI metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve AI metrics")


@router.get("/metrics/performance")
async def get_performance_metrics(
    component: Optional[str] = None,
    current_user = Depends(require_role(["admin", "system"]))
) -> Dict[str, Any]:
    """Get system performance metrics."""
    try:
        api_metrics = await metrics_service.get_api_metrics()
        websocket_metrics = await metrics_service.get_websocket_metrics()
        
        if component == "api":
            return api_metrics
        elif component == "websocket":
            return websocket_metrics
            
        return {
            "api": api_metrics,
            "websocket": websocket_metrics
        }
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve performance metrics")


@router.get("/metrics/errors")
async def get_error_metrics(
    severity: Optional[str] = None,
    timeframe: str = "24h",
    current_user = Depends(require_role(["admin", "system"]))
) -> Dict[str, Any]:
    """Get error tracking metrics."""
    try:
        error_metrics = await metrics_service.get_error_metrics()
        
        if severity:
            error_metrics["recent_errors"] = [
                e for e in error_metrics["recent_errors"]
                if e.get("severity") == severity
            ]
            
        return error_metrics
    except Exception as e:
        logger.error(f"Failed to get error metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve error metrics")


@router.get("/metrics/health")
async def get_health_metrics(
    components: Optional[List[str]] = Query(None),
    current_user = Depends(require_role(["admin", "system"]))
) -> Dict[str, Any]:
    """Get system health metrics."""
    try:
        health_metrics = await metrics_service.get_health_metrics()
        
        if components:
            health_metrics = {
                k: v for k, v in health_metrics.items()
                if k in components
            }
            
        return health_metrics
    except Exception as e:
        logger.error(f"Failed to get health metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve health metrics")


@router.get("/audit/logs")
async def get_audit_logs(
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    actor_uid: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    current_user = Depends(require_role(["admin", "auditor"]))
) -> List[Dict[str, Any]]:
    """Get filtered audit logs."""
    try:
        return await audit_service.get_audit_trail(
            target_type=target_type,
            target_id=target_id,
            actor_uid=actor_uid,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
    except Exception as e:
        logger.error(f"Failed to get audit logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve audit logs")


@router.get("/audit/export")
async def export_audit_data(
    job_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user = Depends(require_role(["admin", "auditor"]))
) -> Dict[str, Any]:
    """Export audit data for compliance."""
    try:
        return await audit_service.export_audit_data(
            job_id=job_id,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        logger.error(f"Failed to export audit data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export audit data")


@router.get("/audit/fairness/{job_id}")
async def check_fairness_compliance(
    job_id: str,
    current_user = Depends(require_role(["admin", "auditor"]))
) -> Dict[str, Any]:
    """Check fairness compliance for a job."""
    try:
        return await audit_service.check_fairness_compliance(job_id)
    except Exception as e:
        logger.error(f"Failed to check fairness compliance: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check fairness compliance")


@router.get("/audit/ai-decisions")
async def get_ai_decisions(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    requires_review: Optional[bool] = None,
    current_user = Depends(require_role(["admin", "auditor"]))
) -> List[Dict[str, Any]]:
    """Get AI decisions for review."""
    try:
        filters = {}
        
        if requires_review is not None:
            filters["requires_human_review"] = requires_review
            
        if start_date:
            filters["timestamp"] = {"$gte": start_date}
        if end_date:
            if "timestamp" in filters:
                filters["timestamp"]["$lte"] = end_date
            else:
                filters["timestamp"] = {"$lte": end_date}
        
        audit_logs = await audit_service.get_audit_trail(
            target_type="ai_decision",
            start_date=start_date,
            end_date=end_date,
            limit=1000
        )
        
        return [
            log for log in audit_logs
            if all(log.get(k) == v for k, v in filters.items())
        ]
    except Exception as e:
        logger.error(f"Failed to get AI decisions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve AI decisions")