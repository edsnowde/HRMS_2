from pydantic import BaseModel, ConfigDict
from typing import List, Optional


class CandidateCreate(BaseModel):
    name: str
    skills: List[str] = []
    experience: int = 0
    phone: Optional[str] = None
    education: Optional[str] = None
    resume_text: Optional[str] = None
    embedding_id: Optional[str] = None

class CandidateProfile(BaseModel):
    name: str
    skills: List[str] = []
    experience: int = 0
    phone: Optional[str] = None
    education: Optional[str] = None

class CandidateProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    skills: List[str] = []
    experience: int = 0
    education: Optional[str] = None
    stage: str = "new"
    latest_score: Optional[dict] = None

class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str
    skills: List[str] = []
    experience: int = 0
    education: Optional[str] = None
    resume_text: Optional[str] = None
    embedding_id: Optional[str] = None
    stage: str = "new"
    latest_score: Optional[dict] = None


class JobMatchRequest(BaseModel):
	job_desc: str

class JobDescriptionSchema(BaseModel):
    job_desc: str

class RankedCandidate(BaseModel):
	candidate_id: str
	similarity: float
	ai_score: int
	rationale: str


class InterviewRequest(BaseModel):
    """Request to create a new interview session."""
    application_id: str
    role_type: str
    time_per_question: int = 60  # Default 60 seconds per question


class InterviewResponse(BaseModel):
    """Response submitted for an interview question."""
    text: str
    audio_url: Optional[str] = None
    transcript: Optional[str] = None


class InterviewQuestion(BaseModel):
    """Individual interview question with metadata."""
    id: str
    text: str
    type: str = "technical"  # technical, behavioral, etc.
    max_time: int = 60
    required: bool = True


class InterviewSession(BaseModel):
    """Complete interview session details."""
    model_config = ConfigDict(from_attributes=True)
    
    session_id: str
    application_id: str
    candidate_id: str
    job_id: str
    status: str
    questions: List[InterviewQuestion]
    responses: dict = {}
    scores: Optional[dict] = None
    feedback: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
