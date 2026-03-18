"""WebSocket router — /ws/runs/{run_id} for real-time run events"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/runs/{run_id}")
async def websocket_run(websocket: WebSocket, run_id: str) -> None:
    """Subscribe to live events for a specific run_id.
    Send run_id='*' to receive all events (global feed).
    """
    await manager.connect(run_id, websocket)
    try:
        while True:
            # Keep the connection alive; client can send pings
            data = await websocket.receive_text()
            # Echo back any client message as an ack
            await websocket.send_text(f'{{"ack": "{data}"}}')
    except WebSocketDisconnect:
        manager.disconnect(run_id, websocket)
