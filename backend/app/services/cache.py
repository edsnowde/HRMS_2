import json
import hashlib
import redis
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class CacheService:
    """Service for Redis caching operations."""
    
    def __init__(self):
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        self.default_ttl = settings.cache_ttl  # Default TTL in seconds
    
    def hash_text(self, text: str) -> str:
        """Generate SHA-256 hash of text for caching."""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()
    
    def generate_score_key(self, candidate_id: str, job_description: str) -> str:
        """Generate cache key for candidate-job score."""
        content = f"{candidate_id}:{self.hash_text(job_description)}"
        return f"score:{hashlib.md5(content.encode()).hexdigest()}"
    
    def get_embedding(self, text_hash: str) -> Optional[str]:
        """
        Get cached embedding ID for text.
        
        Args:
            text_hash: SHA-256 hash of the text
        
        Returns:
            Embedding ID if found, None otherwise
        """
        try:
            key = f"embedding:{text_hash}"
            return self.redis_client.get(key)
        except Exception as e:
            logger.error(f"Failed to get embedding from cache: {str(e)}")
            return None
    
    def set_embedding(self, text_hash: str, embedding_id: str, ttl: int = None) -> bool:
        """
        Cache embedding ID for text.
        
        Args:
            text_hash: SHA-256 hash of the text
            embedding_id: Pinecone vector ID
            ttl: Time to live in seconds
        
        Returns:
            True if successful, False otherwise
        """
        try:
            key = f"embedding:{text_hash}"
            ttl = ttl or self.default_ttl
            return self.redis_client.setex(key, ttl, embedding_id)
        except Exception as e:
            logger.error(f"Failed to cache embedding: {str(e)}")
            return False
    
    def get_score(self, score_key: str) -> Optional[Dict[str, Any]]:
        """
        Get cached score for candidate-job pair.
        
        Args:
            score_key: Cache key for the score
        
        Returns:
            Score data if found, None otherwise
        """
        try:
            cached_data = self.redis_client.get(score_key)
            if cached_data:
                return json.loads(cached_data)
            return None
        except Exception as e:
            logger.error(f"Failed to get score from cache: {str(e)}")
            return None
    
    def set_score(self, score_key: str, score_data: Dict[str, Any], ttl: int = None) -> bool:
        """
        Cache score for candidate-job pair.
        
        Args:
            score_key: Cache key for the score
            score_data: Score and rationale data
            ttl: Time to live in seconds
        
        Returns:
            True if successful, False otherwise
        """
        try:
            ttl = ttl or self.default_ttl
            return self.redis_client.setex(score_key, ttl, json.dumps(score_data))
        except Exception as e:
            logger.error(f"Failed to cache score: {str(e)}")
            return False
    
    def get_session_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached session data.
        
        Args:
            session_id: Session identifier
        
        Returns:
            Session data if found, None otherwise
        """
        try:
            key = f"session:{session_id}"
            cached_data = self.redis_client.get(key)
            if cached_data:
                return json.loads(cached_data)
            return None
        except Exception as e:
            logger.error(f"Failed to get session from cache: {str(e)}")
            return None
    
    def set_session_data(self, session_id: str, session_data: Dict[str, Any], ttl: int = None) -> bool:
        """
        Cache session data.
        
        Args:
            session_id: Session identifier
            session_data: Session data to cache
            ttl: Time to live in seconds
        
        Returns:
            True if successful, False otherwise
        """
        try:
            key = f"session:{session_id}"
            ttl = ttl or 3600  # 1 hour default for sessions
            return self.redis_client.setex(key, ttl, json.dumps(session_data))
        except Exception as e:
            logger.error(f"Failed to cache session: {str(e)}")
            return False
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete session from cache.
        
        Args:
            session_id: Session identifier
        
        Returns:
            True if successful, False otherwise
        """
        try:
            key = f"session:{session_id}"
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Failed to delete session: {str(e)}")
            return False
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached job status.
        
        Args:
            job_id: Job identifier
        
        Returns:
            Job status data if found, None otherwise
        """
        try:
            key = f"job_status:{job_id}"
            cached_data = self.redis_client.get(key)
            if cached_data:
                return json.loads(cached_data)
            return None
        except Exception as e:
            logger.error(f"Failed to get job status from cache: {str(e)}")
            return None
    
    def set_job_status(self, job_id: str, status_data: Dict[str, Any], ttl: int = None) -> bool:
        """
        Cache job status.
        
        Args:
            job_id: Job identifier
            status_data: Job status data
            ttl: Time to live in seconds
        
        Returns:
            True if successful, False otherwise
        """
        try:
            key = f"job_status:{job_id}"
            ttl = ttl or 7200  # 2 hours default for job status
            return self.redis_client.setex(key, ttl, json.dumps(status_data))
        except Exception as e:
            logger.error(f"Failed to cache job status: {str(e)}")
            return False
    
    def cleanup_expired_embeddings(self) -> int:
        """
        Clean up expired embedding cache entries.
        
        Returns:
            Number of entries cleaned up
        """
        try:
            pattern = "embedding:*"
            keys = self.redis_client.keys(pattern)
            
            cleaned_count = 0
            for key in keys:
                # Check if key is expired
                ttl = self.redis_client.ttl(key)
                if ttl == -2:  # Key doesn't exist (expired)
                    cleaned_count += 1
            
            return cleaned_count
        except Exception as e:
            logger.error(f"Failed to cleanup expired embeddings: {str(e)}")
            return 0
    
    def cleanup_expired_scores(self) -> int:
        """
        Clean up expired score cache entries.
        
        Returns:
            Number of entries cleaned up
        """
        try:
            pattern = "score:*"
            keys = self.redis_client.keys(pattern)
            
            cleaned_count = 0
            for key in keys:
                # Check if key is expired
                ttl = self.redis_client.ttl(key)
                if ttl == -2:  # Key doesn't exist (expired)
                    cleaned_count += 1
            
            return cleaned_count
        except Exception as e:
            logger.error(f"Failed to cleanup expired scores: {str(e)}")
            return 0
    
    def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired session cache entries.
        
        Returns:
            Number of entries cleaned up
        """
        try:
            pattern = "session:*"
            keys = self.redis_client.keys(pattern)
            
            cleaned_count = 0
            for key in keys:
                # Check if key is expired
                ttl = self.redis_client.ttl(key)
                if ttl == -2:  # Key doesn't exist (expired)
                    cleaned_count += 1
            
            return cleaned_count
        except Exception as e:
            logger.error(f"Failed to cleanup expired sessions: {str(e)}")
            return 0
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dict with cache statistics
        """
        try:
            info = self.redis_client.info()
            
            # Count keys by pattern
            embedding_count = len(self.redis_client.keys("embedding:*"))
            score_count = len(self.redis_client.keys("score:*"))
            session_count = len(self.redis_client.keys("session:*"))
            job_status_count = len(self.redis_client.keys("job_status:*"))
            
            return {
                "total_keys": info.get("db0", {}).get("keys", 0),
                "embedding_keys": embedding_count,
                "score_keys": score_count,
                "session_keys": session_count,
                "job_status_keys": job_status_count,
                "memory_usage": info.get("used_memory_human", "0B"),
                "connected_clients": info.get("connected_clients", 0),
                "uptime": info.get("uptime_in_seconds", 0)
            }
        except Exception as e:
            logger.error(f"Failed to get cache stats: {str(e)}")
            return {}
    
    def flush_cache(self, pattern: str = None) -> bool:
        """
        Flush cache entries.
        
        Args:
            pattern: Pattern to match keys (e.g., "embedding:*")
        
        Returns:
            True if successful, False otherwise
        """
        try:
            if pattern:
                keys = self.redis_client.keys(pattern)
                if keys:
                    return bool(self.redis_client.delete(*keys))
            else:
                self.redis_client.flushdb()
            return True
        except Exception as e:
            logger.error(f"Failed to flush cache: {str(e)}")
            return False
