from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging
import time
import sys
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_database, close_database
from app.websocket_manager import websocket_manager
from .routes import (
    chatbot,
    employee,
    job,
    jobs_status,
    resume,
    polling,
    interview,
    websocket,
    application
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format=settings.log_format
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting AI HRMS & ATS application...")
    
    try:
        # Initialize database
        await init_database()
        logger.info("Database initialized successfully")
        
        # Start WebSocket event listener
        await websocket_manager.start_event_listener()
        logger.info("WebSocket manager started")
        
        logger.info("Application startup completed")
        
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")
    
    try:
        # Close database connection
        await close_database()
        logger.info("Database connection closed")
        
        # Close WebSocket connections
        websocket_manager.unsubscribe_all()
        logger.info("WebSocket connections closed")
        
        logger.info("Application shutdown completed")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")


# Create FastAPI application
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Frontend development servers
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["Content-Length", "Content-Range"]
)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"] if settings.debug else ["localhost", "127.0.0.1"]
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "detail": str(exc) if settings.debug else None
        }
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.api_version,
        "environment": settings.environment,
        "database": "connected",
        "websocket": "active"
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "AI-Powered HRMS & ATS API",
        "version": settings.api_version,
        "docs": "/docs" if settings.debug else "Documentation not available in production",
        "health": "/health",
        "features": [
            "Resume Processing & AI Matching",
            "Text-based Structured Interviews",
            "HRMS Employee Management",
            "Real-time WebSocket Updates",
            "Role-based Chatbot Assistant"
        ]
    }


# Include routers
app.include_router(resume.router)
app.include_router(chatbot.router)
app.include_router(employee.router)
app.include_router(jobs_status.router)

# Ensure interview and polling routers are included
from app.routes import polling, interview
app.include_router(polling.router)
app.include_router(interview.router)

# Import and include new routers
from app.routes import storage, candidate, websocket, monitoring, application, job
app.include_router(storage.router)
app.include_router(candidate.router)
app.include_router(websocket.router)
app.include_router(monitoring.router)
app.include_router(application.router)
app.include_router(job.router)  # Job router now has /api prefix built in

# Add monitoring endpoint if enabled
if settings.enable_metrics:
    from prometheus_fastapi_instrumentator import Instrumentator
    
    instrumentator = Instrumentator()
    instrumentator.instrument(app)
    instrumentator.expose(app, endpoint="/metrics")
    
    logger.info("Metrics endpoint enabled at /metrics")


# Middleware for request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests."""
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    
    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Time: {process_time:.3f}s"
    )
    
    return response


if __name__ == "__main__":
    import time
    
    # Run the application
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        # Disable automatic reload on Windows to avoid spawning extra
        # subprocesses that can exhaust socket/buffer resources.
        reload=(settings.debug and not sys.platform.startswith("win")),
        log_level=settings.log_level.lower(),
        access_log=True
    )