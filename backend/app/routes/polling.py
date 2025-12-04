"""
Fallback polling routes for clients that can't maintain WebSocket connections.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.auth import get_current_user, get_user_role
from app.database import AsyncMongoClient
from app.config import settings
from app.services.notifier import NotificationService
from app.services.cache import CacheService
import asyncio
import logging

router = APIRouter(prefix="/api/polling", tags=["polling"])
notifier = NotificationService()
cache = CacheService()
logger = logging.getLogger(__name__)

@router.get("/updates", response_model=List[Dict[str, Any]])
async def get_updates(
    since: float,
    current_user = Depends(get_current_user),
    role = Depends(get_user_role)
) -> List[Dict[str, Any]]:
    """
    Get updates since a given timestamp using long-polling.
    
    Args:
        since: Unix timestamp of last update
        current_user: Current authenticated user
        role: User's role
        
    Returns:
        List of updates since the timestamp
    """
    try:
        # Convert timestamp to datetime
        since_dt = datetime.fromtimestamp(since)
        
        # Get updates from MongoDB
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]

            # Query updates based on role
            updates = []

            if role in ["recruiter", "hr"]:
                # Get application updates
                application_updates = await db.applications.find({
                    "updated_at": {"$gt": since_dt}
                }, {
                    "job_id": 1,
                    "candidate_id": 1,
                    "status": 1,
                    "updated_at": 1
                }).to_list(length=None)

                updates.extend([{
                    "type": "application_update",
                    "job_id": str(app["job_id"]),
                    "candidate_id": str(app["candidate_id"]),
                    "status": app["status"],
                    "timestamp": app["updated_at"].timestamp()
                } for app in application_updates])

                # Get interview updates
                interview_updates = await db.interview_sessions.find({
                    "updated_at": {"$gt": since_dt}
                }, {
                    "application_id": 1,
                    "status": 1,
                    "updated_at": 1
                }).to_list(length=None)

                updates.extend([{
                    "type": "interview_update",
                    "application_id": str(session["application_id"]),
                    "status": session["status"],
                    "timestamp": session["updated_at"].timestamp()
                } for session in interview_updates])

            else:  # candidate role
                # Get user's application updates
                application_updates = await db.applications.find({
                    "candidate_id": str(current_user.id),
                    "updated_at": {"$gt": since_dt}
                }, {
                    "job_id": 1,
                    "status": 1,
                    "updated_at": 1
                }).to_list(length=None)

                updates.extend([{
                    "type": "application_update",
                    "job_id": str(app["job_id"]),
                    "status": app["status"],
                    "timestamp": app["updated_at"].timestamp()
                } for app in application_updates])

                # Get user's interview updates
                interview_updates = await db.interview_sessions.find({
                    "candidate_id": str(current_user.id),
                    "updated_at": {"$gt": since_dt}
                }, {
                    "session_id": 1,
                    "status": 1,
                    "updated_at": 1
                }).to_list(length=None)

                updates.extend([{
                    "type": "interview_update",
                    "session_id": str(session["session_id"]),
                    "status": session["status"],
                    "timestamp": session["updated_at"].timestamp()
                } for session in interview_updates])

            # Sort updates by timestamp
            updates.sort(key=lambda x: x["timestamp"])

            return updates
            
    except Exception as e:
        logger.error(f"Failed to get updates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notifications", response_model=List[Dict[str, Any]])
async def get_notifications(
    current_user = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Get recent notifications for user with fallback polling.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        List of recent notifications
    """
    try:
        # Get notifications from cache first
        cache_key = f"notifications:{current_user.id}"
        notifications = await cache.get(cache_key) or []
        
        if not notifications:
            # Fallback to DB if cache miss
            async with AsyncMongoClient() as client:
                db = client[settings.mongo_db_name]
                
                # Get last 24 hours of notifications
                since = datetime.utcnow() - timedelta(days=1)
                notifications = await db.notifications.find({
                    "user_id": str(current_user.id),
                    "created_at": {"$gt": since}
                }).sort("created_at", -1).to_list(length=50)
                
                # Cache for 5 minutes
                if notifications:
                    await cache.set(cache_key, notifications, expire=300)
        
        return notifications
        
    except Exception as e:
        logger.error(f"Failed to get notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/acknowledge", response_model=Dict[str, Any])
async def acknowledge_notification(
    notification_id: str,
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Acknowledge a notification.
    
    Args:
        notification_id: ID of notification to acknowledge
        current_user: Current authenticated user
        
    Returns:
        Acknowledgment status
    """
    try:
        async with AsyncMongoClient() as client:
            db = client[settings.mongo_db_name]
            
            # Update notification
            result = await db.notifications.update_one(
                {
                    "_id": notification_id,
                    "user_id": str(current_user.id)
                },
                {
                    "$set": {
                        "acknowledged": True,
                        "acknowledged_at": datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count == 0:
                raise HTTPException(
                    status_code=404,
                    detail="Notification not found"
                )
            
            # Clear notifications cache
            await cache.delete(f"notifications:{current_user.id}")
            
            return {
                "notification_id": notification_id,
                "status": "acknowledged"
            }
            
    except Exception as e:
        logger.error(f"Failed to acknowledge notification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))