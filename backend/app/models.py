from beanie import Document, Indexed
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ApplicationStage(str, Enum):
    RESUME_PROCESSING = "resume_processing"
    AI_SCREENING = "ai_screening"
    INTERVIEW = "interview"
    EVALUATION_DONE = "evaluation_done"

class ApplicationStatus(str, Enum):
    PENDING = "pending"
    SHORTLISTED = "shortlisted"
    REJECTED = "rejected"
    ACCEPTED = "accepted"

class JobStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"
    DRAFT = "draft"


class CandidateStage(str, Enum):
    PROFILE_CREATED = "Profile Created"
    SCREENING = "Screening"
    INTERVIEW = "Interview"
    ASSESSMENT = "Assessment"
    OFFER = "Offer"
    HIRED = "Hired"
    REJECTED = "Rejected"


class UserRole(str, Enum):
    ADMIN = "admin"
    HR = "hr"
    RECRUITER = "recruiter"
    EMPLOYEE = "employee"
    CANDIDATE = "candidate"


class FileType(str, Enum):
    RESUME = "resume"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"


# Base Models
class BaseDocument(Document):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        use_cache = True
        cache_expiration_time = 300  # 5 minutes


# User Models
class User(BaseDocument):
    email: EmailStr = Field(index=True)
    name: str
    role: UserRole
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    last_login: Optional[datetime] = None
    profile_picture: Optional[str] = None
    
    class Settings:
        name = "users"


class Candidate(BaseDocument):
    name: str
    email: EmailStr = Field(index=True)  # Keep index but not unique
    phone: Optional[str] = None
    skills: List[str] = []
    experience: float = 0.0
    education: Optional[str] = None
    resume_text: Optional[str] = None
    embedding_id: Optional[str] = Field(index=True)
    gcs_path: Optional[str] = None
    application_id: str = Field(index=True, unique=True)  # Make application_id the unique identifier
    job_id: Optional[str] = None
    stage: CandidateStage = CandidateStage.PROFILE_CREATED
    latest_score: Optional[Dict[str, Any]] = None
    latest_job_score: Optional[Dict[str, Any]] = None
    
    # Audit and compliance fields
    consent_timestamp: Optional[datetime] = None
    fairness_flagged: bool = False
    needs_human_review: bool = False
    stage_history: List[Dict[str, Any]] = []
    
    # AI decision tracking
    scores: Dict[str, Dict[str, Any]] = {}  # job_id -> score details
    voice_scores: Dict[str, Dict[str, Any]] = {}  # job_id -> voice analysis
    
    class Settings:
        name = "candidates"


class Job(BaseDocument):
    job_id: str = Field(index=True, unique=True)  # UUID string, canonical id
    title: str
    description: str
    requirements: List[str] = []
    skills_required: List[str] = []
    experience_required: float = 0.0
    location: Optional[str] = None
    salary_range: Optional[str] = None
    employment_type: str = "full-time"  # full-time, part-time, contract
    department: Optional[str] = None
    status: str = "active"  # active, paused, closed
    posted_by: str  # user_id
    jd_vector_id: Optional[str] = Field(index=True)  # Pinecone vector id
    embedding_id: Optional[str] = None  # Legacy field, kept for backward compatibility
    
    class Settings:
        name = "jobs"
        indexes = [
            "job_id",
            "status",
            ("job_id", "status")
        ]


class Application(BaseDocument):
    application_id: str = Field(index=True, unique=True)  # UUID string, canonical for application
    job_id: str = Field(index=True)
    candidate_id: str = Field(index=True)
    candidate_name: str
    candidate_email: EmailStr
    
    # Resume data
    gcs_resume_uri: Optional[str] = None
    resume_text: Optional[str] = None
    resume_vector_id: Optional[str] = Field(index=True)
    
    # AI matching
    ai_match_score: Optional[float] = None
    pinecone_metadata: Optional[Dict[str, Any]] = None
    
    # Application state
    stage: str = "resume_processing"  # resume_processing -> ai_screening -> interview -> evaluation_done
    status: str = "pending"  # pending/shortlisted/rejected/accepted
    
    # Interview data
    gemini_questions: List[Dict[str, Any]] = []  # [{qid, text, expires_at}]
    gemini_answers: List[Dict[str, Any]] = []  # [{qid, answer_text, submitted_at}]
    gemini_results: Optional[Dict[str, Any]] = None
    
    # Quality flags
    needs_human_review: bool = False
    fairness_flagged: bool = False
    
    # Audit trail
    audit_trail: List[Dict[str, Any]] = []
    applied_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated_by: Optional[str] = None  # user_id of last modifier
    notes: Optional[str] = None
    
    class Settings:
        name = "applications"
        indexes = [
            "application_id",
            "job_id",
            "candidate_id",
            ("job_id", "status"),
            ("candidate_id", "status")
        ]


class Interview(BaseDocument):
    candidate_id: str = Field(index=True)
    job_id: Optional[str] = Field(index=True)
    type: str = "video"  # video, audio, in-person
    transcript: Optional[str] = None
    analysis: Optional[Dict[str, Any]] = None
    job_score: Optional[Dict[str, Any]] = None
    gcs_path: Optional[str] = None
    duration: Optional[float] = None  # in seconds
    status: str = "completed"  # pending, processing, completed, failed
    
    class Settings:
        name = "interviews"


class JobMatch(BaseDocument):
    job_id: str = Field(index=True)
    matches: List[Dict[str, Any]] = []
    total_candidates: int = 0
    completed_scoring: int = 0
    
    class Settings:
        name = "job_matches"


class File(BaseDocument):
    filename: str
    original_name: str
    file_type: FileType
    gcs_path: str
    size: int  # in bytes
    content_type: str
    uploaded_by: str  # user_id
    job_id: Optional[str] = None
    candidate_id: Optional[str] = None
    deleted: bool = False
    deleted_at: Optional[datetime] = None
    
    class Settings:
        name = "files"


class Notification(BaseDocument):
    user_id: str = Field(index=True)
    title: str
    message: str
    type: str = "info"  # info, success, warning, error
    job_id: Optional[str] = None
    read: bool = False
    read_at: Optional[datetime] = None
    
    class Settings:
        name = "notifications"


# HRMS Models
class Employee(BaseDocument):
    user_id: str = Field(index=True)
    employee_id: str = Field(index=True, unique=True)
    department: str
    position: str
    manager_id: Optional[str] = None
    hire_date: datetime
    salary: Optional[float] = None
    employment_type: str = "full-time"
    status: str = "active"  # active, inactive, terminated
    
    class Settings:
        name = "employees"


class Attendance(BaseDocument):
    employee_id: str = Field(index=True)
    date: datetime = Field(index=True)
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    hours_worked: Optional[float] = None
    status: str = "present"  # present, absent, late, half-day
    
    class Settings:
        name = "attendance"


class LeaveRequest(BaseDocument):
    employee_id: str = Field(index=True)
    leave_type: str  # sick, vacation, personal, emergency
    start_date: datetime
    end_date: datetime
    days_requested: float
    reason: str
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    comments: Optional[str] = None
    
    class Settings:
        name = "leave_requests"


class Payroll(BaseDocument):
    employee_id: str = Field(index=True)
    month: int
    year: int
    basic_salary: float
    allowances: Dict[str, float] = {}
    deductions: Dict[str, float] = {}
    overtime_hours: float = 0.0
    overtime_pay: float = 0.0
    net_salary: float
    status: str = "pending"  # pending, processed, paid
    
    class Settings:
        name = "payroll"


# System Models
class AuditLog(BaseDocument):
    actor_uid: str = Field(index=True)  # recruiter_123 or system
    action: str = Field(index=True)  # gemini_evaluate, pinecone_query, application_rejected etc.
    target_type: str = Field(index=True)  # application, job
    target_id: str = Field(index=True)  # application_id or job_id
    
    # AI operation details
    model_version: Optional[str] = None  # gemini-2.0-flash etc.
    prompt_hash: str = Field(default="")  # sha256 of prompt template
    input_snapshot: Optional[Dict[str, Any]] = None  # truncated input
    output_snapshot: Optional[Dict[str, Any]] = None  # truncated output
    
    # Action context
    old_status: Optional[str] = None  # for status changes
    new_status: Optional[str] = None  # for status changes
    reason: Optional[str] = None  # human-provided reason
    requires_human_review: bool = False
    
    # Cost & performance tracking
    operation_time_ms: Optional[int] = None  # operation duration
    token_count: Optional[int] = None  # for API calls
    estimated_cost: Optional[float] = None  # in USD
    
    metadata: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "audit_logs"
        indexes = [
            ("target_type", "target_id"),
            ("actor_uid", "action"),
            "timestamp",
            ("target_id", "timestamp")
        ]


class SystemLog(BaseDocument):
    level: str  # info, warning, error, debug
    message: str
    user_id: Optional[str] = None
    job_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    class Settings:
        name = "system_logs"


class APIUsage(BaseDocument):
    user_id: str = Field(index=True)
    endpoint: str
    method: str
    status_code: int
    response_time: float  # in milliseconds
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "api_usage"


# Pydantic Models for API
class CandidateCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    skills: List[str] = []
    experience: float = 0.0
    education: Optional[str] = None


class JobCreate(BaseModel):
    title: str
    description: str
    requirements: List[str] = []
    skills_required: List[str] = []
    experience_required: float = Field(ge=0.0, description="Years of experience required")
    location: Optional[str] = None
    salary_range: Optional[str] = None
    employment_type: str = Field(
        default="full-time",
        pattern="^(full-time|part-time|contract|internship)$",
        description="Type of employment"
    )
    department: Optional[str] = None
    
    @field_validator('title')
    def title_not_empty(cls, v):
        if not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()
    
    @field_validator('description')
    def description_not_empty(cls, v):
        if not v.strip():
            raise ValueError('Description cannot be empty')
        return v.strip()
    
    @field_validator('requirements', 'skills_required')
    def lists_not_empty_strings(cls, v):
        if any(not str(x).strip() for x in v):
            raise ValueError('Lists cannot contain empty strings')
        return [str(x).strip() for x in v]


class InterviewCreate(BaseModel):
    candidate_id: str
    job_id: Optional[str] = None
    type: str = "video"
    gcs_path: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: UserRole
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]


class JobDescriptionSchema(BaseModel):
    job_desc: str


# API Request/Response Models
class ApplicationCreate(BaseModel):
    job_id: str
    candidate_id: str
    candidate_name: str
    candidate_email: EmailStr

class ApplicationResponse(BaseModel):
    application_id: str
    job_id: str
    status: str
    message: str

class MatchJobRequest(BaseModel):
    top_k: int = Field(default=10, ge=5, le=100)

class MatchJobResponse(BaseModel):
    job_id: str
    task_id: str
    status: str
    top_k: int

class StartInterviewRequest(BaseModel):
    num_questions: int = Field(default=4, ge=3, le=5)
    time_per_question_seconds: int = Field(default=60, ge=30, le=120)

class InterviewQuestion(BaseModel):
    qid: str
    text: str
    expires_at: datetime

class InterviewAnswerSubmit(BaseModel):
    qid: str
    answer_text: str
    submitted_at: datetime

class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    actor_uid: str
    comment: Optional[str] = None

# Legacy Response Models
class CandidateResponse(BaseModel):
    id: str
    name: str
    email: str
    skills: List[str]
    experience: float
    education: Optional[str]
    stage: str
    latest_score: Optional[Dict[str, Any]]
    created_at: datetime


class JobResponse(BaseModel):
    id: str
    title: str
    description: str
    requirements: List[str]
    skills_required: List[str]
    experience_required: float
    location: Optional[str]
    salary_range: Optional[str]
    employment_type: str
    department: Optional[str]
    status: str
    created_by: str
    created_at: datetime


class InterviewResponse(BaseModel):
    id: str
    candidate_id: str
    job_id: Optional[str]
    type: str
    transcript: Optional[str]
    analysis: Optional[Dict[str, Any]]
    job_score: Optional[Dict[str, Any]]
    duration: Optional[float]
    status: str
    created_at: datetime


class SystemStatsResponse(BaseModel):
    total_candidates: int
    total_jobs: int
    total_interviews: int
    active_jobs: int
    completed_jobs: int
    failed_jobs: int
    recent_candidates: int
    recent_jobs: int
    recent_interviews: int