"""Service layer initialization."""

from app.services.sync_wrappers import run_async, SyncDatabaseService
from app.services.scorer import ScorerService, LLMScoringService  # Alias for backward compatibility
from app.services.embedder import EmbedderService, create_embedding_and_upsert
from app.services.storage import StorageService
from app.services.cache import CacheService
from app.services.audit import AuditService
from app.services.notifier import NotificationService
from app.services.parser import ResumeParser


__all__ = [
    'SyncDatabaseService',
    'ScorerService',
    'LLMScoringService',  # Compatibility alias
    'EmbedderService',
    'create_embedding_and_upsert',  # Legacy embedding helper
    'StorageService',
    'CacheService',
    'AuditService',
    'NotificationService',
    'ResumeParser',
    'run_async'  # Helper for running async code in sync contexts
]