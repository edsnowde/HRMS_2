import json
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
from app.services.notifier import NotificationService
from app.services.websocket_events import (
    WebSocketEventType,
    WSMessage,
    InterviewMessage,
    ApplicationMessage,
    SystemMessage,
    ConnectionMessage
)
from app.services.fallback_polling import polling_service
import logging

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manager for WebSocket connections and real-time notifications."""
    
    def __init__(self):
        # Connection management
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, Set[str]] = {}  # user_id -> set of connection_ids
        self.connection_roles: Dict[str, str] = {}  # connection_id -> role
        self.connection_health: Dict[str, Dict[str, Any]] = {}  # connection_id -> health data
        
        # Message handling
        self.message_queue: Dict[str, List[Dict[str, Any]]] = {}  # user_id -> queued messages
        self.message_history: Dict[str, List[Dict[str, Any]]] = {}  # connection_id -> recent messages
        self.history_limit = 100  # Keep last 100 messages per connection
        
        # Connection recovery
        self.reconnect_tokens: Dict[str, str] = {}  # user_id -> token
        self.session_state: Dict[str, Dict[str, Any]] = {}  # connection_id -> session state
        self.reconnect_window = timedelta(hours=24)  # Time window for reconnection
        
        # Rate limiting
        self.rate_limits: Dict[str, Dict[str, Any]] = {}  # connection_id -> rate limit data
        self.max_messages_per_minute = 120
        
        # Services
        self.notifier = NotificationService()
    
    async def connect(self, websocket: WebSocket, connection_id: str, user_id: str = None, role: str = None):
        """Accept WebSocket connection and register it."""
        try:
            await websocket.accept()
            self.active_connections[connection_id] = websocket
            
            if user_id:
                if user_id not in self.user_connections:
                    self.user_connections[user_id] = set()
                self.user_connections[user_id].add(connection_id)
                
                # Restore queued messages
                if user_id in self.message_queue:
                    queued_messages = self.message_queue[user_id]
                    del self.message_queue[user_id]
                    for msg in queued_messages:
                        await self.send_personal_message(msg, connection_id)
            
            # Store role for targeted broadcasts
            if role:
                self.connection_roles[connection_id] = role
            
            # Initialize health monitoring
            self.connection_health[connection_id] = {
                "connected_at": asyncio.get_event_loop().time(),
                "last_ping": None,
                "ping_count": 0,
                "latency_ms": []
            }
            
            # Generate reconnect token
            if user_id:
                import secrets
                self.reconnect_tokens[user_id] = secrets.token_urlsafe(32)
            
            logger.info(f"WebSocket connected: {connection_id} for user: {user_id} role: {role}")
            
            # Send welcome message with reconnect token
            await self.send_personal_message({
                "type": "connection_established",
                "connection_id": connection_id,
                "reconnect_token": self.reconnect_tokens.get(user_id),
                "message": "Connected to real-time updates"
            }, connection_id)
            
            # Start heartbeat for this connection
            asyncio.create_task(self._connection_heartbeat(connection_id))
            
        except Exception as e:
            logger.error(f"Failed to connect WebSocket: {str(e)}")
            raise
    
    def disconnect(self, connection_id: str, user_id: str = None):
        """Remove WebSocket connection."""
        try:
            if connection_id in self.active_connections:
                del self.active_connections[connection_id]
            
            if user_id and user_id in self.user_connections:
                self.user_connections[user_id].discard(connection_id)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
            
            logger.info(f"WebSocket disconnected: {connection_id}")
            
        except Exception as e:
            logger.error(f"Failed to disconnect WebSocket: {str(e)}")
    
    async def send_personal_message(
        self,
        message: Dict[str, Any],
        connection_id: str,
        retry_fallback: bool = True
    ):
        """
        Send message to specific connection with retry and fallback.
        
        Args:
            message: Message to send
            connection_id: Target connection ID
            retry_fallback: Whether to attempt fallback on failure
        """
        try:
            # Check rate limits
            if not self._check_rate_limit(connection_id):
                logger.warning(f"Rate limit exceeded for {connection_id}")
                return
                
            if connection_id in self.active_connections:
                try:
                    websocket = self.active_connections[connection_id]
                    
                    # Add message ID and timestamp if not present
                    if "message_id" not in message:
                        message["message_id"] = str(uuid.uuid4())
                    if "timestamp" not in message:
                        message["timestamp"] = datetime.now().isoformat()
                    
                    # Send message
                    await websocket.send_text(json.dumps(message))
                    
                    # Store in history
                    if connection_id not in self.message_history:
                        self.message_history[connection_id] = []
                    self.message_history[connection_id].append(message)
                    
                    # Trim history if needed
                    if len(self.message_history[connection_id]) > self.history_limit:
                        self.message_history[connection_id] = \
                            self.message_history[connection_id][-self.history_limit:]
                    
                    logger.debug(f"Sent message to {connection_id}: {message.get('type', 'unknown')}")
                    
                except WebSocketDisconnect:
                    if retry_fallback:
                        await self._handle_disconnect_with_fallback(connection_id, message)
                        
                except Exception as e:
                    logger.error(f"Failed to send message to {connection_id}: {str(e)}")
                    if retry_fallback:
                        await self._handle_disconnect_with_fallback(connection_id, message)
            
            else:
                logger.warning(f"Connection {connection_id} not found")
                if retry_fallback:
                    await self._handle_disconnect_with_fallback(connection_id, message)
                    
        except Exception as e:
            logger.error(f"Error in send_personal_message: {str(e)}")
            if retry_fallback:
                await self._handle_disconnect_with_fallback(connection_id, message)
    
    async def send_to_user(self, message: Dict[str, Any], user_id: str):
        """Send message to all connections of a specific user."""
        try:
            if user_id in self.user_connections:
                connection_ids = list(self.user_connections[user_id])
                for connection_id in connection_ids:
                    await self.send_personal_message(message, connection_id)
                
                logger.info(f"Sent message to user {user_id} via {len(connection_ids)} connections")
            else:
                logger.warning(f"No connections found for user {user_id}")
                
        except Exception as e:
            logger.error(f"Failed to send message to user: {str(e)}")
    
    async def broadcast(self, message: Dict[str, Any], exclude_connections: List[str] = None):
        """Broadcast message to all active connections."""
        try:
            exclude_connections = exclude_connections or []
            sent_count = 0
            
            for connection_id, websocket in self.active_connections.items():
                if connection_id not in exclude_connections:
                    try:
                        await websocket.send_text(json.dumps(message))
                        sent_count += 1
                    except WebSocketDisconnect:
                        self.disconnect(connection_id)
                    except Exception as e:
                        logger.error(f"Failed to broadcast to {connection_id}: {str(e)}")
                        self.disconnect(connection_id)
            
            logger.info(f"Broadcasted message to {sent_count} connections")
            
        except Exception as e:
            logger.error(f"Failed to broadcast message: {str(e)}")
    
    async def handle_job_update(self, job_id: str, status: str, data: Dict[str, Any]):
        """Handle job status updates."""
        try:
            message = {
                "type": "job_update",
                "job_id": job_id,
                "status": status,
                "data": data,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            # Broadcast to all connections
            await self.broadcast(message)
            
            logger.info(f"Broadcasted job update: {job_id} - {status}")
            
        except Exception as e:
            logger.error(f"Failed to handle job update: {str(e)}")
    
    async def handle_user_notification(self, user_id: str, notification: Dict[str, Any]):
        """Handle user-specific notifications."""
        try:
            message = {
                "type": "notification",
                "notification": notification,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            await self.send_to_user(message, user_id)
            
        except Exception as e:
            logger.error(f"Failed to handle user notification: {str(e)}")
    
    async def handle_system_announcement(self, announcement: Dict[str, Any]):
        """Handle system-wide announcements."""
        try:
            message = {
                "type": "system_announcement",
                "announcement": announcement,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            await self.broadcast(message)
            
        except Exception as e:
            logger.error(f"Failed to handle system announcement: {str(e)}")
    
    def get_connection_count(self) -> int:
        """Get total number of active connections."""
        return len(self.active_connections)
    
    def get_user_connection_count(self, user_id: str) -> int:
        """Get number of connections for a specific user."""
        return len(self.user_connections.get(user_id, set()))
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            "total_connections": len(self.active_connections),
            "unique_users": len(self.user_connections),
            "user_connections": {user_id: len(conns) for user_id, conns in self.user_connections.items()}
        }
    
    async def start_event_listener(self):
        """Start listening to Redis pub/sub events."""
        try:
            # Capture the main event loop so subscriber thread can schedule coroutines
            main_loop = asyncio.get_event_loop()

            def event_callback(event_data):
                try:
                    # Schedule the coroutine safely from a different thread
                    asyncio.run_coroutine_threadsafe(self._handle_redis_event(event_data), main_loop)
                except Exception as e:
                    logger.error(f"Failed to schedule redis event on main loop: {e}")
            
            # Subscribe to events in a separate thread
            import threading
            
            def run_subscriber():
                try:
                    self.notifier.subscribe_to_events(event_callback)
                except Exception as e:
                    logger.error(f"Redis subscriber error: {str(e)}")
            
            subscriber_thread = threading.Thread(target=run_subscriber, daemon=True)
            subscriber_thread.start()
            
            logger.info("Started Redis event listener")
            
        except Exception as e:
            logger.error(f"Failed to start event listener: {str(e)}")
    
    async def _handle_redis_event(self, event_data: Dict[str, Any]):
        """Handle events from Redis pub/sub with message queuing."""
        try:
            event_type = event_data.get("event_type")
            job_id = event_data.get("job_id")
            target_user = event_data.get("user_id")
            target_role = event_data.get("target_role")
            payload = event_data.get("payload", {})
            
            message = {
                "type": "event",
                "event_type": event_type,
                "job_id": job_id,
                "data": payload,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            # Interview events
            if event_type.startswith("interview_"):
                if event_type == "interview_questions_ready":
                    await self.handle_interview_update(
                        job_id, 
                        target_user,
                        "questions_ready",
                        payload
                    )
                elif event_type == "interview_response_evaluated":
                    await self.handle_interview_update(
                        job_id,
                        target_user,
                        "response_evaluated",
                        payload
                    )
                elif event_type == "interview_completed":
                    await self.handle_interview_update(
                        job_id,
                        target_user,
                        "completed",
                        payload
                    )
                    
            # Job application events
            elif event_type.startswith("application_"):
                if event_type == "application_status_changed":
                    await self.handle_application_update(
                        job_id,
                        target_user,
                        payload.get("status"),
                        payload
                    )
                    
            # Async task events
            elif event_type.endswith("_completed"):
                if event_type == "resume_processed":
                    await self.handle_job_update(job_id, "resume_processed", payload)
                elif event_type == "video_processed":
                    await self.handle_job_update(job_id, "video_processed", payload)
                elif event_type == "job_matching_completed":
                    await self.handle_job_update(job_id, "matching_completed", payload)
                elif event_type == "candidate_scored":
                    await self.handle_job_update(job_id, "scoring_completed", payload)
                    
            # Role-specific broadcasts
            if target_role:
                await self.broadcast_to_role(message, target_role)
                
            # User-specific messages
            elif target_user:
                if target_user in self.user_connections:
                    await self.send_to_user(message, target_user)
                else:
                    # Queue message for offline user
                    if target_user not in self.message_queue:
                        self.message_queue[target_user] = []
                    self.message_queue[target_user].append(message)
                    
            # Global broadcasts
            else:
                await self.broadcast(message)
                
            # Cleanup old queued messages
            await self._cleanup_message_queue()
                
        except Exception as e:
            logger.error(f"Failed to handle Redis event: {str(e)}")
            
    async def _connection_heartbeat(self, connection_id: str):
        """Maintain connection health with periodic pings."""
        try:
            while connection_id in self.active_connections:
                await asyncio.sleep(30)  # Heartbeat every 30 seconds
                
                try:
                    # Send ping and measure latency
                    start_time = asyncio.get_event_loop().time()
                    await self.send_personal_message({
                        "type": "ping",
                        "timestamp": start_time
                    }, connection_id)
                    
                    # Update health metrics
                    health = self.connection_health[connection_id]
                    health["last_ping"] = start_time
                    health["ping_count"] += 1
                    
                except Exception:
                    # Connection likely dead
                    logger.warning(f"Heartbeat failed for {connection_id}")
                    self.disconnect(connection_id)
                    break
                    
        except Exception as e:
            logger.error(f"Heartbeat error for {connection_id}: {str(e)}")
            
    async def handle_pong(self, connection_id: str, ping_timestamp: float):
        """Handle pong response to calculate latency."""
        try:
            if connection_id in self.connection_health:
                latency = (asyncio.get_event_loop().time() - ping_timestamp) * 1000
                self.connection_health[connection_id]["latency_ms"].append(round(latency, 2))
                
                # Keep only last 10 latency measurements
                self.connection_health[connection_id]["latency_ms"] = \
                    self.connection_health[connection_id]["latency_ms"][-10:]
                    
        except Exception as e:
            logger.error(f"Failed to handle pong: {str(e)}")
            
    async def _cleanup_message_queue(self):
        """Clean up old queued messages (older than 24 hours)."""
        try:
            current_time = asyncio.get_event_loop().time()
            expiry_time = current_time - (24 * 60 * 60)  # 24 hours
            
            for user_id in list(self.message_queue.keys()):
                self.message_queue[user_id] = [
                    msg for msg in self.message_queue[user_id]
                    if msg.get("timestamp", current_time) > expiry_time
                ]
                
                if not self.message_queue[user_id]:
                    del self.message_queue[user_id]
                    
        except Exception as e:
            logger.error(f"Failed to cleanup message queue: {str(e)}")
            
    def _check_rate_limit(self, connection_id: str) -> bool:
        """
        Check if connection has exceeded rate limits.
        Implements token bucket algorithm.
        """
        try:
            now = datetime.now()
            
            if connection_id not in self.rate_limits:
                self.rate_limits[connection_id] = {
                    "tokens": self.max_messages_per_minute,
                    "last_update": now,
                    "warnings": 0
                }
                return True
                
            rate_data = self.rate_limits[connection_id]
            
            # Calculate token refill
            time_passed = (now - rate_data["last_update"]).total_seconds()
            tokens_to_add = int(time_passed * (self.max_messages_per_minute / 60))
            
            # Update tokens
            rate_data["tokens"] = min(
                self.max_messages_per_minute,
                rate_data["tokens"] + tokens_to_add
            )
            rate_data["last_update"] = now
            
            # Check if we have tokens
            if rate_data["tokens"] > 0:
                rate_data["tokens"] -= 1
                return True
                
            # Increment warnings
            rate_data["warnings"] += 1
            
            # Disconnect if too many warnings
            if rate_data["warnings"] > 3:
                logger.warning(f"Disconnecting {connection_id} due to rate limiting")
                self.disconnect(connection_id)
                
            return False
            
        except Exception as e:
            logger.error(f"Rate limit check error: {str(e)}")
            return True
            
    async def _handle_disconnect_with_fallback(
        self,
        connection_id: str,
        message: Dict[str, Any]
    ):
        """Handle disconnection with fallback to polling."""
        try:
            # Get user ID and role
            user_id = next(
                (uid for uid, conns in self.user_connections.items()
                if connection_id in conns),
                None
            )
            
            if not user_id:
                return
                
            # Store session state
            self.session_state[connection_id] = {
                "last_message": message,
                "disconnected_at": datetime.now(),
                "user_id": user_id,
                "role": self.connection_roles.get(connection_id)
            }
            
            # Start fallback polling
            poll_type = self._get_poll_type(message)
            if poll_type:
                await polling_service.start_polling(
                    user_id=user_id,
                    poll_type=poll_type,
                    callback=self._handle_poll_update
                )
            
            # Clean up connection
            self.disconnect(connection_id)
            
            logger.info(f"Started fallback polling for {user_id}")
            
        except Exception as e:
            logger.error(f"Fallback handling error: {str(e)}")
            
    def _get_poll_type(self, message: Dict[str, Any]) -> Optional[str]:
        """Determine polling type from message."""
        try:
            msg_type = message.get("type", "")
            
            if "interview" in msg_type:
                return "interview"
            elif "application" in msg_type:
                return "application"
            elif "job" in msg_type:
                return "job"
            elif "system" in msg_type:
                return "system"
                
        except:
            pass
            
        return None
        
    async def _handle_poll_update(self, updates: List[Dict[str, Any]]):
        """Handle updates from fallback polling."""
        try:
            for update in updates:
                event_type = update.get("type")
                
                if event_type.startswith("interview"):
                    await self.handle_interview_update(
                        update.get("job_id"),
                        update.get("user_id"),
                        update.get("status"),
                        update.get("data", {})
                    )
                    
                elif event_type.startswith("application"):
                    await self.handle_application_update(
                        update.get("job_id"),
                        update.get("user_id"),
                        update.get("status"),
                        update.get("data", {})
                    )
                    
                elif event_type.startswith("job"):
                    await self.handle_job_update(
                        update.get("job_id"),
                        update.get("status"),
                        update.get("data", {})
                    )
                    
                elif event_type.startswith("system"):
                    await self.handle_system_announcement(update)
                    
        except Exception as e:
            logger.error(f"Poll update handling error: {str(e)}")
            
    async def broadcast_to_role(self, message: Dict[str, Any], role: str):
        """Broadcast message to all connections with specific role."""
        try:
            sent_count = 0
            for conn_id, conn_role in self.connection_roles.items():
                if conn_role == role and conn_id in self.active_connections:
                    try:
                        await self.send_personal_message(message, conn_id)
                        sent_count += 1
                    except Exception:
                        self.disconnect(conn_id)
                        
            logger.info(f"Broadcasted to {sent_count} {role} connections")
            
        except Exception as e:
            logger.error(f"Failed to broadcast to role {role}: {str(e)}")
            
    async def handle_interview_update(self, job_id: str, user_id: str, status: str, data: Dict[str, Any]):
        """Handle interview-specific updates."""
        try:
            message = {
                "type": "interview_update",
                "job_id": job_id,
                "status": status,
                "data": data,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            # Send to candidate
            await self.send_to_user(message, user_id)
            
            # Notify recruiters/HR
            await self.broadcast_to_role({
                **message,
                "candidate_id": user_id
            }, "recruiter")
            
        except Exception as e:
            logger.error(f"Failed to handle interview update: {str(e)}")
            
    async def handle_application_update(self, job_id: str, user_id: str, status: str, data: Dict[str, Any]):
        """Handle application status updates."""
        try:
            message = {
                "type": "application_update",
                "job_id": job_id,
                "status": status,
                "data": data,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            # Send to candidate
            await self.send_to_user(message, user_id)
            
            # Notify recruiters
            await self.broadcast_to_role({
                **message,
                "candidate_id": user_id
            }, "recruiter")
            
        except Exception as e:
            logger.error(f"Failed to handle application update: {str(e)}")


# Global WebSocket manager instance
# Backwards-compatibility alias: some modules import `WebsocketManager` (different capitalization)
WebsocketManager = WebSocketManager

# Global WebSocket manager instance
websocket_manager = WebSocketManager()
