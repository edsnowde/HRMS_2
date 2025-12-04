from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database Configuration
    database_url: str
    mongo_url: str
    mongo_db_name: str = "ai_ats"

    class Config:
        env_file = ".env"
    
    # Redis Configuration
    redis_url: str
    
    # Pinecone Configuration
    pinecone_api_key: str | None = None
    pinecone_environment: str = "us-east1-aws"
    pinecone_index_name: str = "resumes"
    # Maximum number of results for top-k queries
    max_top_k: int = 100
    # Default scoring settings
    default_scoring_config: dict = {
        "weight_recent": 0.3,  # 30% weight for recency
        "max_age_days": 365,   # Consider matches up to 1 year old
        "boost_fields": ["job_title", "industry", "skills"]  # Fields to boost
    }
    # Minimum match score threshold
    min_match_score: float = 0.6  # 60% minimum similarity

    # Firebase Configuration
    # The primary Firebase project id this backend expects for ID tokens.
    # You can set either a single project id (firebase_project_id) or a
    # comma-separated list in ALLOWED_FIREBASE_PROJECT_IDS to accept tokens
    # from multiple projects (useful for staging vs prod during migration).
    firebase_project_id: str | None = None
    # Accept either a comma-separated string from the environment or a list.
    # Using a plain string in `.env` like `a,b,c` is common; we'll normalize
    # that later in code (see `app.auth` which robustly parses this value).
    allowed_firebase_project_ids: str | list | None = None

    # Vertex AI / GCP Configuration
    vtx_gcp_project_id: str | None = None
    vtx_gcp_region: str = "us-central1"
    vtx_index_id: str | None = None
    vtx_index_endpoint_id: str | None = None
    # Vertex AI / GCP Matching Engine Configuration
    gcp_project_id: str
    gcp_region: Optional[str] = "us-central1"
    vertex_index_id: Optional[str] = None
    vertex_index_endpoint_id: Optional[str] = None
    # Path to GCP service account JSON
    gcs_credentials_path: Optional[str] = None
    
    # Google Cloud Configuration
    gemini_api_key: str
    gcs_bucket_name: Optional[str] = None
    gcs_credentials_path: Optional[str] = None
    gcp_project_id: Optional[str] = None
    
    # Google Cloud Speech-to-Text
    google_application_credentials: Optional[str] = None
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment.lower() == "development"
    
    @property
    def has_gcs_config(self) -> bool:
        """Check if GCS is properly configured."""
        return bool(
            self.gcs_bucket_name and 
            (self.gcs_credentials_path or self.google_application_credentials)
        )
    
    # Cache Configuration
    cache_ttl: int = 86400  # 1 day in seconds
    
    # Batch Processing
    batch_embed_size: int = 25
    max_video_size_mb: int = 50
    use_small_model: bool = True
    
    # API Configuration
    api_title: str = "AI-Powered HRMS & ATS"
    api_version: str = "1.0.0"
    api_description: str = "AI-powered Human Resource Management System with Applicant Tracking"
    
    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS
    allowed_origins: list = ["http://localhost:3000", "http://localhost:8000"]
    
    # Monitoring
    enable_metrics: bool = True
    metrics_port: int = 9090
    
    # Rate Limiting
    rate_limit_per_minute: int = 60
    
    # File Upload
    max_file_size_mb: int = 100
    allowed_file_types: list = [".pdf", ".docx", ".doc", ".mp4", ".mp3", ".wav"]
    
    # Background Jobs
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"
    
    # WebSocket
    websocket_port: int = 8001
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Development/Production
    debug: bool = False
    environment: str = "development"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()