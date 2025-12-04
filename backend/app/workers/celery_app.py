from celery import Celery
from app.config import settings
from app.services.parser import ResumeParser  # Now valid
import logging

# Create Celery instance
celery = Celery(
    'ai_ats',
    broker=settings.redis_url,
    backend=settings.redis_url
)

# Celery configuration
celery.conf.update(
    # Task routing - temporarily route all to default queue
    task_routes={},  # Empty dict = all tasks go to default queue

    # Task execution settings
    task_default_retry_delay=30,
    task_annotations={'*': {'max_retries': 3}},
    task_acks_late=True,
    worker_prefetch_multiplier=1,

    # Result backend settings
    result_expires=3600,  # 1 hour

    # Timezone
    timezone='UTC',
    enable_utc=True,

    # Serialization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',

    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# Import all task modules
from app.workers import resume_worker, scoring_worker, cleanup_worker
# Import interview_worker so tasks defined with shared_task are registered
from app.workers import interview_worker

# Log registered tasks for quick runtime verification
logger = logging.getLogger(__name__)
try:
    task_names = sorted(list(celery.tasks.keys()))
    logger.info(f"Registered Celery tasks ({len(task_names)}): {task_names}")
except Exception:
    # If inspection fails at import time, don't crash the app
    logger.debug("Could not list Celery tasks at import time")
