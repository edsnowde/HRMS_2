import json
import redis
import asyncio
import time
from typing import Dict, Any, List
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for WebSocket notifications and pub/sub messaging."""
    
    def __init__(self):
        self.redis_client = None
        self.pubsub = None
        if settings.environment == "development":
            try:
                self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
                self.pubsub = self.redis_client.pubsub()
                logger.info("✅ Connected to Redis")
            except:
                logger.warning("⚠️ Redis not available - running in development mode without notifications")
        else:
            # In production, Redis is required
            self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
            self.pubsub = self.redis_client.pubsub()
    
    def publish_event(self, event_type: str, job_id: str, payload: Dict[str, Any]) -> bool:
        """
        Publish an event to Redis pub/sub.
        
        Args:
            event_type: Type of event (e.g., "resume_processed", "job_matching_completed")
            job_id: Job identifier
            payload: Event data
        
        Returns:
            True if successful, False otherwise
        """
        try:
            try:
                loop = asyncio.get_running_loop()
                ts = loop.time()
            except RuntimeError:
                ts = time.time()

            message = {
                "event_type": event_type,
                "job_id": job_id,
                "payload": payload,
                "timestamp": str(ts)
            }
            
            # In development mode without Redis, just log the event
            if not self.redis_client:
                if settings.environment == "development":
                    logger.info(f"Development mode: Event {event_type} for job {job_id}")
                    return True
                return False
            
            # Publish to Redis channel
            result = self.redis_client.publish("events", json.dumps(message))
            
            logger.info(f"Published event {event_type} for job {job_id}")
            return result > 0
            
        except Exception as e:
            logger.error(f"Failed to publish event: {str(e)}")
            return False
    
    def publish_user_notification(self, user_id: str, notification: Dict[str, Any]) -> bool:
        """
        Publish a user-specific notification.
        
        Args:
            user_id: User identifier
            notification: Notification data
        
        Returns:
            True if successful, False otherwise
        """
        try:
            try:
                loop = asyncio.get_running_loop()
                ts = loop.time()
            except RuntimeError:
                ts = time.time()

            message = {
                "user_id": user_id,
                "notification": notification,
                "timestamp": str(ts)
            }
            
            channel = f"user_notifications:{user_id}"
            result = self.redis_client.publish(channel, json.dumps(message))
            
            logger.info(f"Published notification for user {user_id}")
            return result > 0
            
        except Exception as e:
            logger.error(f"Failed to publish user notification: {str(e)}")
            return False
    
    def publish_broadcast_notification(self, notification: Dict[str, Any], target_roles: List[str] = None) -> bool:
        """
        Publish a broadcast notification to all users or specific roles.
        
        Args:
            notification: Notification data
            target_roles: List of roles to target (None for all users)
        
        Returns:
            True if successful, False otherwise
        """
        try:
            try:
                loop = asyncio.get_running_loop()
                ts = loop.time()
            except RuntimeError:
                ts = time.time()

            message = {
                "notification": notification,
                "target_roles": target_roles,
                "timestamp": str(ts)
            }
            
            channel = "broadcast_notifications"
            result = self.redis_client.publish(channel, json.dumps(message))
            
            logger.info(f"Published broadcast notification")
            return result > 0
            
        except Exception as e:
            logger.error(f"Failed to publish broadcast notification: {str(e)}")
            return False
    
    def subscribe_to_events(self, callback):
        """
        Subscribe to all events and call callback function.
        
        Args:
            callback: Function to call when events are received
        """
        try:
            self.pubsub.subscribe("events")

            for message in self.pubsub.listen():
                if message.get('type') == 'message':
                    try:
                        event_data = json.loads(message['data'])
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse event data: {str(e)}")
                        continue

                    # Invoke callback but guard against exceptions so the listener loop continues
                    try:
                        callback(event_data)
                    except Exception as cb_err:
                        logger.error(f"Event callback raised an exception: {cb_err}")

        except Exception as e:
            logger.error(f"Failed to subscribe to events: {str(e)}")
    
    def subscribe_to_user_notifications(self, user_id: str, callback):
        """
        Subscribe to user-specific notifications.
        
        Args:
            user_id: User identifier
            callback: Function to call when notifications are received
        """
        try:
            channel = f"user_notifications:{user_id}"
            self.pubsub.subscribe(channel)
            
            for message in self.pubsub.listen():
                if message['type'] == 'message':
                    try:
                        notification_data = json.loads(message['data'])
                        callback(notification_data)
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse notification data: {str(e)}")
                        
        except Exception as e:
            logger.error(f"Failed to subscribe to user notifications: {str(e)}")
    
    def subscribe_to_broadcast_notifications(self, callback):
        """
        Subscribe to broadcast notifications.
        
        Args:
            callback: Function to call when notifications are received
        """
        try:
            self.pubsub.subscribe("broadcast_notifications")
            
            for message in self.pubsub.listen():
                if message['type'] == 'message':
                    try:
                        notification_data = json.loads(message['data'])
                        callback(notification_data)
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse broadcast notification data: {str(e)}")
                        
        except Exception as e:
            logger.error(f"Failed to subscribe to broadcast notifications: {str(e)}")
    
    def unsubscribe_all(self):
        """Unsubscribe from all channels."""
        try:
            self.pubsub.unsubscribe()
            logger.info("Unsubscribed from all channels")
        except Exception as e:
            logger.error(f"Failed to unsubscribe: {str(e)}")
    
    def get_active_subscribers(self) -> Dict[str, int]:
        """
        Get count of active subscribers for each channel.
        
        Returns:
            Dict with channel names and subscriber counts
        """
        try:
            # Get pub/sub info
            info = self.redis_client.pubsub_numsub("events", "broadcast_notifications")
            
            # Count user notification channels
            user_channels = self.redis_client.keys("user_notifications:*")
            
            return {
                "events": info.get("events", 0),
                "broadcast_notifications": info.get("broadcast_notifications", 0),
                "user_notifications": len(user_channels)
            }
        except Exception as e:
            logger.error(f"Failed to get subscriber counts: {str(e)}")
            return {}
    
    def send_websocket_message(self, websocket, message: Dict[str, Any]):
        """
        Send message via WebSocket (for use in WebSocket endpoints).
        
        Args:
            websocket: WebSocket connection
            message: Message to send
        """
        try:
            if websocket and not websocket.closed:
                websocket.send_text(json.dumps(message))
                logger.info(f"Sent WebSocket message: {message.get('event_type', 'unknown')}")
        except Exception as e:
            logger.error(f"Failed to send WebSocket message: {str(e)}")
    
    def create_notification(self, title: str, message: str, notification_type: str = "info", 
                          user_id: str = None, job_id: str = None) -> Dict[str, Any]:
        """
        Create a standardized notification object.
        
        Args:
            title: Notification title
            message: Notification message
            notification_type: Type of notification (info, success, warning, error)
            user_id: Target user ID
            job_id: Related job ID
        
        Returns:
            Dict with notification data
        """
        try:
            loop = asyncio.get_running_loop()
            ts = loop.time()
        except RuntimeError:
            ts = time.time()

        return {
            "id": str(ts),
            "title": title,
            "message": message,
            "type": notification_type,
            "user_id": user_id,
            "job_id": job_id,
            "timestamp": str(ts),
            "read": False
        }
