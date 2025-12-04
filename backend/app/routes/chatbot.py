from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import uuid
from app.services.scorer import LLMScoringService
from app.services.db_utils import DatabaseService
from app.models import UserRole
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chatbot"])


@router.post("/query")
async def chat_query(
    query: str,
    user_role: UserRole = UserRole.CANDIDATE,
    user_id: str = None,
    context: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Process chatbot query with role-aware responses.
    
    Args:
        query: User's question
        user_role: Role of the user (admin, hr, recruiter, employee, candidate)
        user_id: User identifier
        context: Additional context for the query
    
    Returns:
        Dict with chatbot response
    """
    try:
        if not query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        
        scorer = LLMScoringService()
        db_service = DatabaseService()
        
        # Role-specific system prompts
        system_prompts = {
            UserRole.ADMIN: "You are an AI assistant for system administrators. Help with system management, analytics, and oversight tasks.",
            UserRole.HR: "You are an AI assistant for HR professionals. Help with recruitment, employee management, and HR policies.",
            UserRole.RECRUITER: "You are an AI assistant for recruiters. Help with candidate sourcing, job matching, and recruitment workflows.",
            UserRole.EMPLOYEE: "You are an AI assistant for employees. Help with leave requests, attendance, payroll, and general HR queries.",
            UserRole.CANDIDATE: "You are an AI assistant for job candidates. Help with application status, interview preparation, and career guidance."
        }
        
        system_prompt = system_prompts.get(user_role, "You are a helpful AI assistant.")
        
        # Create context-aware prompt
        full_prompt = f"""
{system_prompt}

User Role: {user_role.value}
Query: {query}

Context: {context or {}}

Please provide a helpful, accurate, and professional response based on the user's role and query.
If the query is about specific data (like leave balance, salary, etc.), mention that you'll need to fetch that information.
If the query is general advice or information, provide helpful guidance.
"""
        
        # Generate response using LLM
        response = scorer.model.generate_content(full_prompt)
        answer = getattr(response, 'text', '') or 'I apologize, but I could not generate a response at this time.'
        
        # Check if query requires data fetching
        data_queries = [
            "leave balance", "attendance", "salary", "payroll", "my profile",
            "application status", "interview schedule", "job matches"
        ]
        
        requires_data = any(keyword in query.lower() for keyword in data_queries)
        
        # Log the interaction
        interaction_id = str(uuid.uuid4())
        log_data = {
            "interaction_id": interaction_id,
            "user_id": user_id,
            "user_role": user_role.value,
            "query": query,
            "response": answer,
            "requires_data": requires_data,
            "timestamp": None  # Will be set by database
        }
        
        # Store interaction log (implement in db_service)
        # await db_service.log_chat_interaction(log_data)
        
        logger.info(f"Chatbot query processed: {interaction_id} for user {user_id}")
        
        return {
            "interaction_id": interaction_id,
            "query": query,
            "response": answer,
            "user_role": user_role.value,
            "requires_data": requires_data,
            "suggested_actions": _get_suggested_actions(user_role, query)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process chat query: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/suggestions/{user_role}")
async def get_chat_suggestions(user_role: UserRole) -> Dict[str, Any]:
    """
    Get suggested queries based on user role.
    
    Args:
        user_role: User role
    
    Returns:
        Dict with suggested queries
    """
    try:
        suggestions = {
            UserRole.ADMIN: [
                "Show me system analytics",
                "How many active users do we have?",
                "What are the recent system errors?",
                "Generate a monthly report",
                "Show database statistics"
            ],
            UserRole.HR: [
                "Show me active job postings",
                "How many candidates applied this week?",
                "Generate recruitment report",
                "Show employee attendance summary",
                "What are the pending leave requests?"
            ],
            UserRole.RECRUITER: [
                "Find candidates for Python developer role",
                "Show me top candidates for current jobs",
                "Generate candidate matching report",
                "What are the interview schedules?",
                "Show me recent applications"
            ],
            UserRole.EMPLOYEE: [
                "What is my leave balance?",
                "Show my attendance record",
                "What is my salary information?",
                "How do I request leave?",
                "Show my upcoming holidays"
            ],
            UserRole.CANDIDATE: [
                "What is my application status?",
                "How can I prepare for interviews?",
                "Show me matching jobs",
                "What are the interview tips?",
                "How do I update my profile?"
            ]
        }
        
        return {
            "user_role": user_role.value,
            "suggestions": suggestions.get(user_role, [])
        }
        
    except Exception as e:
        logger.error(f"Failed to get chat suggestions: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/feedback")
async def submit_chat_feedback(
    interaction_id: str,
    rating: int,
    feedback: str = None
) -> Dict[str, Any]:
    """
    Submit feedback for chatbot interaction.
    
    Args:
        interaction_id: Interaction identifier
        rating: Rating from 1-5
        feedback: Optional text feedback
    
    Returns:
        Dict with feedback submission status
    """
    try:
        if rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
        # Store feedback (implement in db_service)
        feedback_data = {
            "interaction_id": interaction_id,
            "rating": rating,
            "feedback": feedback,
            "timestamp": None  # Will be set by database
        }
        
        # await db_service.store_chat_feedback(feedback_data)
        
        logger.info(f"Chat feedback submitted: {interaction_id} with rating {rating}")
        
        return {
            "interaction_id": interaction_id,
            "message": "Feedback submitted successfully",
            "rating": rating
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit feedback: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/analytics")
async def get_chat_analytics() -> Dict[str, Any]:
    """
    Get chatbot usage analytics.
    
    Returns:
        Dict with analytics data
    """
    try:
        # This would fetch analytics from database
        # For now, return placeholder data
        return {
            "total_interactions": 0,
            "average_rating": 0.0,
            "popular_queries": [],
            "user_role_breakdown": {},
            "response_time_avg": 0.0,
            "message": "Analytics not yet implemented"
        }
        
    except Exception as e:
        logger.error(f"Failed to get chat analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


def _get_suggested_actions(user_role: UserRole, query: str) -> list:
    """Get suggested follow-up actions based on role and query."""
    query_lower = query.lower()
    
    if user_role == UserRole.EMPLOYEE:
        if "leave" in query_lower:
            return ["View Leave Balance", "Request Leave", "View Leave History"]
        elif "attendance" in query_lower:
            return ["View Attendance Record", "Check-in/Check-out", "View Timesheet"]
        elif "salary" in query_lower or "payroll" in query_lower:
            return ["View Pay Slip", "View Salary Details", "Download Pay Stub"]
    
    elif user_role == UserRole.RECRUITER:
        if "candidate" in query_lower:
            return ["View Candidates", "Schedule Interview", "Send Assessment"]
        elif "job" in query_lower:
            return ["Create Job Posting", "View Job Matches", "Update Job Status"]
    
    elif user_role == UserRole.HR:
        if "employee" in query_lower:
            return ["View Employee List", "Add Employee", "Update Employee Info"]
        elif "report" in query_lower:
            return ["Generate Report", "View Analytics", "Export Data"]
    
    elif user_role == UserRole.CANDIDATE:
        if "application" in query_lower:
            return ["View Application Status", "Update Profile", "Upload Documents"]
        elif "interview" in query_lower:
            return ["View Interview Schedule", "Prepare for Interview", "Practice Questions"]
    
    return []
