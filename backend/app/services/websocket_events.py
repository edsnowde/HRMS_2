"""
Defines WebSocket event types and message structures for consistent real-time updates.
"""

from enum import Enum
from typing import Dict, Any, TypedDict, List, Optional, Union
from datetime import datetime
from pydantic import BaseModel


class WebSocketEventType(str, Enum):
    """Defines all possible WebSocket event types."""
    
    # Connection Events
    CONNECTION_ESTABLISHED = "connection_established"
    CONNECTION_ERROR = "connection_error"
    RECONNECT_ATTEMPT = "reconnect_attempt"
    PING = "ping"
    PONG = "pong"
    
    # Interview Events
    INTERVIEW_QUESTIONS_READY = "interview_questions_ready"
    INTERVIEW_STARTED = "interview_started"
    INTERVIEW_QUESTION_TIMER = "interview_question_timer"
    INTERVIEW_RESPONSE_EVALUATED = "interview_response_evaluated"
    INTERVIEW_COMPLETED = "interview_completed"
    INTERVIEW_ERROR = "interview_error"
    
    # Application Events
    APPLICATION_SUBMITTED = "application_submitted"
    APPLICATION_STATUS_CHANGED = "application_status_changed"
    APPLICATION_SCORED = "application_scored"
    APPLICATION_FEEDBACK = "application_feedback"
    
    # Job Events
    JOB_POSTED = "job_posted"
    JOB_UPDATED = "job_updated"
    JOB_CLOSED = "job_closed"
    JOB_MATCHED = "job_matched"
    
    # Processing Events
    RESUME_PROCESSING_STARTED = "resume_processing_started"
    RESUME_PROCESSING_COMPLETED = "resume_processing_completed"
    VIDEO_PROCESSING_STARTED = "video_processing_started"
    VIDEO_PROCESSING_COMPLETED = "video_processing_completed"
    
    # System Events
    SYSTEM_ANNOUNCEMENT = "system_announcement"
    SYSTEM_ERROR = "system_error"
    SYSTEM_MAINTENANCE = "system_maintenance"
    SYSTEM_STATUS = "system_status"


class BaseWSMessage(BaseModel):
    """Base model for all WebSocket messages."""
    type: WebSocketEventType
    timestamp: datetime
    message_id: str


class InterviewMessage(BaseWSMessage):
    """Model for interview-related messages."""
    job_id: str
    session_id: str
    status: str
    data: Dict[str, Any]
    candidate_id: Optional[str]
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": WebSocketEventType.INTERVIEW_QUESTIONS_READY,
                "timestamp": datetime.now(),
                "message_id": "msg_123",
                "job_id": "job_123",
                "session_id": "session_123",
                "status": "ready",
                "data": {
                    "questions": [{"id": "Q1", "question": "Example question"}]
                },
                "candidate_id": "user_123"
            }
        }


class ApplicationMessage(BaseWSMessage):
    """Model for application-related messages."""
    application_id: str
    job_id: str
    status: str
    data: Dict[str, Any]
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": WebSocketEventType.APPLICATION_STATUS_CHANGED,
                "timestamp": datetime.now(),
                "message_id": "msg_123",
                "application_id": "app_123",
                "job_id": "job_123",
                "status": "under_review",
                "data": {
                    "score": 85,
                    "feedback": "Strong technical match"
                }
            }
        }


class SystemMessage(BaseWSMessage):
    """Model for system-wide messages."""
    severity: str
    title: str
    content: str
    action_required: bool = False
    expires_at: Optional[datetime] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": WebSocketEventType.SYSTEM_ANNOUNCEMENT,
                "timestamp": datetime.now(),
                "message_id": "msg_123",
                "severity": "info",
                "title": "System Maintenance",
                "content": "Scheduled maintenance in 1 hour",
                "action_required": False,
                "expires_at": datetime.now()
            }
        }


class ConnectionMessage(BaseWSMessage):
    """Model for connection-related messages."""
    connection_id: str
    user_id: Optional[str]
    reconnect_token: Optional[str]
    latency_ms: Optional[float]
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": WebSocketEventType.CONNECTION_ESTABLISHED,
                "timestamp": datetime.now(),
                "message_id": "msg_123",
                "connection_id": "conn_123",
                "user_id": "user_123",
                "reconnect_token": "token_123",
                "latency_ms": 50.5
            }
        }


WSMessage = Union[InterviewMessage, ApplicationMessage, SystemMessage, ConnectionMessage]