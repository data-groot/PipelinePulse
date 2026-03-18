"""WebSocket connection manager for real-time pipeline run events."""
import asyncio
import json
from typing import Any
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # Maps run_id → set of active WebSocket connections
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, run_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(run_id, set()).add(websocket)

    def disconnect(self, run_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(run_id, set())
        conns.discard(websocket)
        if not conns:
            self._connections.pop(run_id, None)

    async def broadcast(self, run_id: str, data: dict[str, Any]) -> None:
        """Send a JSON message to all subscribers of a run_id."""
        message = json.dumps(data)
        dead: set[WebSocket] = set()
        for ws in list(self._connections.get(run_id, set())):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(run_id, ws)

    async def broadcast_all(self, data: dict[str, Any]) -> None:
        """Broadcast to ALL connected clients (e.g. global status updates)."""
        tasks = [self.broadcast(run_id, data) for run_id in list(self._connections)]
        await asyncio.gather(*tasks, return_exceptions=True)


# Singleton instance shared across the app
manager = ConnectionManager()
