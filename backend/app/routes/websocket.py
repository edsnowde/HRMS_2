"""
WebSocket and real-time update routes for the application.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import Dict, Any, Optional
from app.auth import get_current_user
from app.websocket_manager import websocket_manager
from app.services.websocket_events import WebSocketEventType
from app.services.polling import polling_service
import uuid
import logging
import time

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ws",
    tags=["WebSocket & Real-time Updates"]
)


@router.websocket("/connect/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    role: Optional[str] = None
):
    """
    WebSocket connection endpoint with auto-reconnect support.
    """
    connection_id = f"ws_{uuid.uuid4().hex}"
    
    try:
        # Accept connection
        await websocket_manager.connect(
            websocket=websocket,
            connection_id=connection_id,
            user_id=user_id,
            role=role
        )
        
        try:
            while True:
                data = await websocket.receive_text()
                message = None
                
                try:
                    import json
                    message = json.loads(data)
                except:
                    continue
                
                # Handle pong responses
                if message.get("type") == "pong":
                    await websocket_manager.handle_pong(
                        connection_id,
                        message.get("ping_timestamp")
                    )
                    continue
                
                # Handle user messages
                if message.get("type") == "user_message":
                    await websocket_manager.handle_user_message(
                        connection_id=connection_id,
                        user_id=user_id,
                        message=message
                    )
                
        except WebSocketDisconnect:
            websocket_manager.disconnect(connection_id, user_id)
            
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.close()


@router.post("/reconnect")
async def reconnect_session(
    user_id: str,
    reconnect_token: str,
    role: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Attempt to restore a disconnected WebSocket session.
    """
    try:
        # Verify token
        stored_token = websocket_manager.reconnect_tokens.get(user_id)
        if not stored_token or stored_token != reconnect_token:
            raise HTTPException(status_code=401, detail="Invalid reconnect token")
        
        # Get session state
        session_state = next(
            (state for state in websocket_manager.session_state.values()
            if state["user_id"] == user_id),
            None
        )
        
        if not session_state:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "status": "ready_to_reconnect",
            "user_id": user_id,
            "role": role or session_state.get("role"),
            "last_message": session_state.get("last_message"),
            "disconnected_at": session_state.get("disconnected_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reconnect error: {str(e)}")
        raise HTTPException(status_code=500, detail="Reconnection failed")


@router.get("/status")
async def websocket_status(current_user = Depends(get_current_user)):
    """
    Get WebSocket connection statistics and health metrics.
    """
    try:
        stats = websocket_manager.get_connection_stats()
        
        # Add health metrics
        healthy_connections = sum(
            1 for health in websocket_manager.connection_health.values()
            if health.get("last_ping") and
            (time.time() - health["last_ping"]) < 60  # Last ping within 60s
        )
        
        return {
            **stats,
            "healthy_connections": healthy_connections,
            "polling_sessions": len(polling_service.active_polls),
            "queued_messages": sum(
                len(msgs) for msgs in websocket_manager.message_queue.values()
            )
        }
        
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        raise HTTPException(status_code=500, detail="Status check failed")