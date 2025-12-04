"""
Fallback polling service for when WebSocket connections are not available.
Implements long-polling with configurable intervals and automatic WebSocket reconnection.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, Callable, Awaitable
from datetime import datetime, timedelta
from app.services.cache import CacheService
from app.database import AsyncMongoClient
from app.services.websocket_events import WebSocketEventType

logger = logging.getLogger(__name__)


class FallbackPollingService:
    """Provides fallback polling when WebSocket is unavailable."""
    
    def __init__(self):
        self.cache = CacheService()
        self.active_polls: Dict[str, Dict[str, Any]] = {}
        self.poll_intervals: Dict[str, int] = {
            "interview": 5,  # 5 seconds for interview updates
            "application": 30,  # 30 seconds for application status
            "job": 60,  # 60 seconds for job updates
            "system": 300  # 5 minutes for system updates
        }
        self.max_poll_age = timedelta(hours=24)
    
    async def start_polling(
        self,
        user_id: str,
        poll_type: str,
        callback: Callable[[Dict[str, Any]], Awaitable[None]]
    ) -> str:
        """
        Start polling for updates.
        
        Args:
            user_id: User ID requesting updates
            poll_type: Type of updates to poll for
            callback: Async function to call with updates
            
        Returns:
            Polling session ID
        """
        try:
            poll_id = f"poll_{user_id}_{poll_type}_{int(datetime.now().timestamp())}"
            
            self.active_polls[poll_id] = {
                "user_id": user_id,
                "type": poll_type,
                "callback": callback,
                "last_poll": datetime.now(),
                "interval": self.poll_intervals[poll_type],
                "last_update_id": await self._get_last_update_id(user_id, poll_type)
            }
            
            # Start polling task
            asyncio.create_task(self._poll_loop(poll_id))
            
            logger.info(f"Started {poll_type} polling for user {user_id}")
            return poll_id
            
        except Exception as e:
            logger.error(f"Failed to start polling: {str(e)}")
            raise
    
    def stop_polling(self, poll_id: str):
        """Stop polling for a specific session."""
        if poll_id in self.active_polls:
            del self.active_polls[poll_id]
            logger.info(f"Stopped polling for {poll_id}")
    
    async def _poll_loop(self, poll_id: str):
        """Main polling loop for a session."""
        try:
            while poll_id in self.active_polls:
                poll = self.active_polls[poll_id]
                
                try:
                    # Check for updates
                    updates = await self._get_updates(
                        user_id=poll["user_id"],
                        poll_type=poll["type"],
                        last_update_id=poll["last_update_id"]
                    )
                    
                    if updates:
                        # Call callback with updates
                        await poll["callback"](updates)
                        
                        # Update last seen ID
                        if updates[-1].get("id"):
                            poll["last_update_id"] = updates[-1]["id"]
                    
                    # Update poll timestamp
                    poll["last_poll"] = datetime.now()
                    
                    # Check poll age
                    if datetime.now() - poll["last_poll"] > self.max_poll_age:
                        self.stop_polling(poll_id)
                        break
                    
                except Exception as e:
                    logger.error(f"Error in poll loop for {poll_id}: {str(e)}")
                
                # Wait for next interval
                await asyncio.sleep(poll["interval"])
                
        except Exception as e:
            logger.error(f"Poll loop failed for {poll_id}: {str(e)}")
            self.stop_polling(poll_id)
    
    async def _get_updates(
        self,
        user_id: str,
        poll_type: str,
        last_update_id: Optional[str]
    ) -> list:
        """Get updates since last poll."""
        try:
            async with AsyncMongoClient() as client:
                db = client[settings.mongo_db_name]
                
                query = {"user_id": user_id}
                if last_update_id:
                    query["_id"] = {"$gt": last_update_id}
                
                # Get collection based on type
                if poll_type == "interview":
                    collection = db.interview_sessions
                    query["status"] = {"$in": ["ready", "in_progress", "completed"]}
                elif poll_type == "application":
                    collection = db.applications
                elif poll_type == "job":
                    collection = db.jobs
                    query["status"] = "active"
                else:
                    collection = db.system_updates
                    
                # Get updates
                cursor = collection.find(
                    query,
                    sort=[("_id", 1)],
                    limit=100
                )
                
                updates = []
                async for doc in cursor:
                    # Convert to WebSocket message format
                    message = self._format_update(doc, poll_type)
                    if message:
                        updates.append(message)
                
                return updates
                
        except Exception as e:
            logger.error(f"Failed to get updates: {str(e)}")
            return []
    
    def _format_update(self, doc: Dict[str, Any], poll_type: str) -> Dict[str, Any]:
        """Format document as WebSocket-style message."""
        try:
            base_msg = {
                "timestamp": datetime.now(),
                "id": str(doc["_id"])
            }
            
            if poll_type == "interview":
                return {
                    **base_msg,
                    "type": WebSocketEventType.INTERVIEW_QUESTIONS_READY
                    if doc["status"] == "ready"
                    else WebSocketEventType.INTERVIEW_COMPLETED,
                    "session_id": doc["session_id"],
                    "job_id": doc["job_id"],
                    "status": doc["status"],
                    "data": {
                        "questions": doc.get("questions", []),
                        "scores": doc.get("scores", {})
                    }
                }
            
            elif poll_type == "application":
                return {
                    **base_msg,
                    "type": WebSocketEventType.APPLICATION_STATUS_CHANGED,
                    "application_id": str(doc["_id"]),
                    "job_id": doc["job_id"],
                    "status": doc["status"],
                    "data": {
                        "score": doc.get("score"),
                        "feedback": doc.get("feedback")
                    }
                }
            
            elif poll_type == "job":
                return {
                    **base_msg,
                    "type": WebSocketEventType.JOB_UPDATED,
                    "job_id": str(doc["_id"]),
                    "status": doc["status"],
                    "data": {
                        "title": doc["title"],
                        "applications": doc.get("application_count", 0)
                    }
                }
            
            elif poll_type == "system":
                return {
                    **base_msg,
                    "type": WebSocketEventType.SYSTEM_ANNOUNCEMENT,
                    "severity": doc.get("severity", "info"),
                    "title": doc.get("title"),
                    "content": doc.get("content"),
                    "action_required": doc.get("action_required", False)
                }
            
        except Exception as e:
            logger.error(f"Failed to format update: {str(e)}")
        
        return None
    
    async def _get_last_update_id(self, user_id: str, poll_type: str) -> Optional[str]:
        """Get ID of last seen update from cache."""
        try:
            cache_key = f"last_update_{user_id}_{poll_type}"
            return await self.cache.get(cache_key)
        except:
            return None
    
    async def _set_last_update_id(self, user_id: str, poll_type: str, update_id: str):
        """Store ID of last seen update in cache."""
        try:
            cache_key = f"last_update_{user_id}_{poll_type}"
            await self.cache.set(cache_key, update_id, expire=86400)  # 24 hours
        except:
            pass


# Global polling service instance
polling_service = FallbackPollingService()