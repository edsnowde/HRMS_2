"""
Service for collecting and managing system metrics and monitoring.
Integrates with Prometheus for metrics collection and OpenTelemetry for tracing.
"""

import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from prometheus_client import Counter, Gauge, Histogram, Summary
import logging
from opentelemetry import trace, metrics
from opentelemetry.trace import Status, StatusCode
from app.database import AsyncMongoClient
from app.services.cache import CacheService

logger = logging.getLogger(__name__)

# Initialize tracing
tracer = trace.get_tracer(__name__)

# Initialize metrics
meter = metrics.get_meter(__name__)

class MetricsService:
    """Service for system metrics and monitoring."""
    
    def __init__(self):
        self.cache = CacheService()
        
        # Prometheus metrics
        self.ai_operations = Counter(
            'ai_operations_total',
            'Total AI operations by type',
            ['operation_type', 'status']
        )
        
        self.ai_operation_duration = Histogram(
            'ai_operation_duration_seconds',
            'AI operation duration in seconds',
            ['operation_type']
        )
        
        self.active_interviews = Gauge(
            'active_interviews',
            'Number of active interview sessions'
        )
        
        self.websocket_connections = Gauge(
            'websocket_connections',
            'Number of active WebSocket connections'
        )
        
        self.api_requests = Counter(
            'api_requests_total',
            'Total API requests by endpoint',
            ['endpoint', 'method', 'status']
        )
        
        self.job_processing_time = Summary(
            'job_processing_seconds',
            'Time spent processing jobs',
            ['job_type']
        )
        
        # System health metrics
        self.system_health = Gauge(
            'system_health',
            'Overall system health status',
            ['component']
        )
        
        # Error tracking
        self.error_counter = Counter(
            'error_total',
            'Total errors by type',
            ['error_type', 'severity']
        )
        
    async def track_ai_operation(
        self,
        operation_type: str,
        duration: float,
        status: str = "success"
    ):
        """Track AI operation metrics."""
        try:
            self.ai_operations.labels(operation_type=operation_type, status=status).inc()
            self.ai_operation_duration.labels(operation_type=operation_type).observe(duration)
            
            # Store in cache for real-time monitoring
            cache_key = f"ai_ops_{operation_type}"
            await self.cache.lpush(cache_key, {
                "timestamp": datetime.utcnow().isoformat(),
                "duration": duration,
                "status": status
            })
            await self.cache.ltrim(cache_key, 0, 999)  # Keep last 1000 operations
            
        except Exception as e:
            logger.error(f"Failed to track AI operation: {str(e)}")
    
    async def update_interview_metrics(self, active_count: int):
        """Update interview session metrics."""
        try:
            self.active_interviews.set(active_count)
            
            # Track in time series
            await self.cache.set(
                "interview_metrics",
                {
                    "active_count": active_count,
                    "timestamp": datetime.utcnow().isoformat()
                },
                expire=3600
            )
            
        except Exception as e:
            logger.error(f"Failed to update interview metrics: {str(e)}")
    
    async def track_api_request(
        self,
        endpoint: str,
        method: str,
        status: int,
        duration: float
    ):
        """Track API request metrics."""
        try:
            self.api_requests.labels(
                endpoint=endpoint,
                method=method,
                status=str(status)
            ).inc()
            
            # Track latency
            if duration > 1.0:  # Slow request threshold
                await self.log_slow_request(endpoint, method, duration)
            
        except Exception as e:
            logger.error(f"Failed to track API request: {str(e)}")
    
    async def update_system_health(self, component: str, status: float):
        """Update system health metrics."""
        try:
            self.system_health.labels(component=component).set(status)
            
            # Store health history
            await self.cache.lpush(f"health_{component}", {
                "status": status,
                "timestamp": datetime.utcnow().isoformat()
            })
            await self.cache.ltrim(f"health_{component}", 0, 719)  # Keep 30 days (hourly)
            
        except Exception as e:
            logger.error(f"Failed to update system health: {str(e)}")
    
    async def track_error(
        self,
        error_type: str,
        severity: str,
        details: Dict[str, Any]
    ):
        """Track error occurrences."""
        try:
            self.error_counter.labels(
                error_type=error_type,
                severity=severity
            ).inc()
            
            # Store error details
            await self.cache.lpush("recent_errors", {
                "error_type": error_type,
                "severity": severity,
                "details": details,
                "timestamp": datetime.utcnow().isoformat()
            })
            await self.cache.ltrim("recent_errors", 0, 99)  # Keep last 100 errors
            
        except Exception as e:
            logger.error(f"Failed to track error: {str(e)}")
    
    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get comprehensive system metrics."""
        try:
            # Get metrics from different components
            websocket_metrics = await self.get_websocket_metrics()
            ai_metrics = await self.get_ai_metrics()
            api_metrics = await self.get_api_metrics()
            error_metrics = await self.get_error_metrics()
            health_metrics = await self.get_health_metrics()
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "websocket": websocket_metrics,
                "ai_operations": ai_metrics,
                "api": api_metrics,
                "errors": error_metrics,
                "health": health_metrics
            }
            
        except Exception as e:
            logger.error(f"Failed to get system metrics: {str(e)}")
            return {}
    
    async def get_websocket_metrics(self) -> Dict[str, Any]:
        """Get WebSocket-specific metrics."""
        try:
            return {
                "active_connections": self.websocket_connections._value.get(),
                "active_interviews": self.active_interviews._value.get()
            }
        except Exception as e:
            logger.error(f"Failed to get WebSocket metrics: {str(e)}")
            return {}
    
    async def get_ai_metrics(self) -> Dict[str, Any]:
        """Get AI operation metrics."""
        try:
            # Get recent operations from cache
            recent_ops = []
            for op_type in ["scoring", "matching", "interview", "analysis"]:
                ops = await self.cache.lrange(f"ai_ops_{op_type}", 0, 99)
                recent_ops.extend(ops)
            
            # Calculate statistics
            total_ops = sum(1 for op in recent_ops if op.get("status") == "success")
            error_rate = sum(1 for op in recent_ops if op.get("status") == "error") / len(recent_ops) if recent_ops else 0
            avg_duration = sum(op.get("duration", 0) for op in recent_ops) / len(recent_ops) if recent_ops else 0
            
            return {
                "total_operations": total_ops,
                "error_rate": error_rate,
                "average_duration": avg_duration,
                "recent_operations": recent_ops[:10]  # Last 10 operations
            }
            
        except Exception as e:
            logger.error(f"Failed to get AI metrics: {str(e)}")
            return {}
    
    async def get_api_metrics(self) -> Dict[str, Any]:
        """Get API performance metrics."""
        try:
            # Get slow requests
            slow_requests = await self.cache.lrange("slow_requests", 0, 9)
            
            return {
                "request_count": self.api_requests._metrics,
                "slow_requests": slow_requests,
                "endpoints": {
                    endpoint: {
                        "count": self.api_requests.labels(endpoint=endpoint)._value.get()
                    }
                    for endpoint in self.api_requests._metrics.keys()
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get API metrics: {str(e)}")
            return {}
    
    async def get_error_metrics(self) -> Dict[str, Any]:
        """Get error tracking metrics."""
        try:
            recent_errors = await self.cache.lrange("recent_errors", 0, 9)
            
            error_summary = {}
            for error in recent_errors:
                error_type = error.get("error_type")
                if error_type not in error_summary:
                    error_summary[error_type] = 0
                error_summary[error_type] += 1
            
            return {
                "recent_errors": recent_errors,
                "error_summary": error_summary
            }
            
        except Exception as e:
            logger.error(f"Failed to get error metrics: {str(e)}")
            return {}
    
    async def get_health_metrics(self) -> Dict[str, Any]:
        """Get system health metrics."""
        try:
            health = {}
            for component in ["database", "cache", "ai", "websocket"]:
                history = await self.cache.lrange(f"health_{component}", 0, 23)  # Last 24 hours
                current = self.system_health.labels(component=component)._value.get()
                
                health[component] = {
                    "current": current,
                    "history": history
                }
            
            return health
            
        except Exception as e:
            logger.error(f"Failed to get health metrics: {str(e)}")
            return {}
    
    async def log_slow_request(
        self,
        endpoint: str,
        method: str,
        duration: float
    ):
        """Log slow API requests."""
        try:
            await self.cache.lpush("slow_requests", {
                "endpoint": endpoint,
                "method": method,
                "duration": duration,
                "timestamp": datetime.utcnow().isoformat()
            })
            await self.cache.ltrim("slow_requests", 0, 99)  # Keep last 100 slow requests
            
        except Exception as e:
            logger.error(f"Failed to log slow request: {str(e)}")
    
    async def cleanup_metrics(self):
        """Clean up old metrics data."""
        try:
            # Clean up old cache entries
            cleanup_tasks = []
            
            # Health metrics (keep 30 days)
            for component in ["database", "cache", "ai", "websocket"]:
                cleanup_tasks.append(
                    self.cache.ltrim(
                        f"health_{component}",
                        0,
                        719  # 30 days * 24 hours
                    )
                )
            
            # AI operations (keep 7 days)
            for op_type in ["scoring", "matching", "interview", "analysis"]:
                cleanup_tasks.append(
                    self.cache.ltrim(
                        f"ai_ops_{op_type}",
                        0,
                        10079  # 7 days * 24 hours * 60 minutes
                    )
                )
            
            # Errors (keep 1000)
            cleanup_tasks.append(self.cache.ltrim("recent_errors", 0, 999))
            
            # Slow requests (keep 1000)
            cleanup_tasks.append(self.cache.ltrim("slow_requests", 0, 999))
            
            await asyncio.gather(*cleanup_tasks)
            
            logger.info("Metrics cleanup completed")
            
        except Exception as e:
            logger.error(f"Failed to cleanup metrics: {str(e)}")


# Global metrics service instance
metrics_service = MetricsService()