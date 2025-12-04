"""
Service for managing long-polling connections and updates.
"""

import asyncio
from typing import Dict, Any, Set
from datetime import datetime


class PollingService:
    def __init__(self):
        self.active_polls: Set[str] = set()
        self.poll_timeouts: Dict[str, datetime] = {}
        self.poll_data: Dict[str, Any] = {}

    async def register_poll(self, poll_id: str, timeout: int = 30):
        """Register a new long-polling connection."""
        self.active_polls.add(poll_id)
        self.poll_timeouts[poll_id] = datetime.now()
        return poll_id

    async def unregister_poll(self, poll_id: str):
        """Remove a polling connection."""
        self.active_polls.discard(poll_id)
        self.poll_timeouts.pop(poll_id, None)
        self.poll_data.pop(poll_id, None)

    async def set_poll_data(self, poll_id: str, data: Any):
        """Set data for a specific polling connection."""
        if poll_id in self.active_polls:
            self.poll_data[poll_id] = data
            return True
        return False

    async def get_poll_data(self, poll_id: str) -> Any:
        """Get data for a specific polling connection."""
        return self.poll_data.get(poll_id)

    async def cleanup_expired_polls(self):
        """Remove expired polling connections."""
        now = datetime.now()
        expired = [
            poll_id 
            for poll_id, timeout in self.poll_timeouts.items()
            if (now - timeout).total_seconds() > 30
        ]
        for poll_id in expired:
            await self.unregister_poll(poll_id)

    async def wait_for_update(self, poll_id: str, timeout: int = 30):
        """Wait for new data on a specific polling connection."""
        if poll_id not in self.active_polls:
            return None

        try:
            start_time = asyncio.get_event_loop().time()
            while (asyncio.get_event_loop().time() - start_time) < timeout:
                if poll_id in self.poll_data:
                    data = self.poll_data[poll_id]
                    del self.poll_data[poll_id]
                    return data
                await asyncio.sleep(0.1)
            return None
        finally:
            await self.unregister_poll(poll_id)


# Global instance
polling_service = PollingService()