import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from typing import List

from app.database import AsyncSessionLocal
from app.models.meta_models import PipelineRun
from app.schemas import PipelineRun as PipelineRunSchema

router = APIRouter(tags=["websocket"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.polling_task = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if self.polling_task is None or self.polling_task.done():
            self.polling_task = asyncio.create_task(self.poll_pipeline_runs())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except:
                self.disconnect(connection)

    async def poll_pipeline_runs(self):
        while self.active_connections:
            try:
                async with AsyncSessionLocal() as db:
                    res = await db.execute(select(PipelineRun).order_by(PipelineRun.started_at.desc()).limit(10))
                    runs = res.scalars().all()
                    if runs:
                        schemas = [PipelineRunSchema.model_validate(r).model_dump_json() for r in runs]
                        await self.broadcast(f"[{','.join(schemas)}]")
            except Exception as e:
                pass
            await asyncio.sleep(5)
        self.polling_task = None

manager = ConnectionManager()

@router.websocket("/ws/pipeline-runs")
async def websocket_pipeline_runs(websocket: WebSocket):
    await manager.connect(websocket)
    
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(PipelineRun).order_by(PipelineRun.started_at.desc()).limit(10))
        runs = res.scalars().all()
        schemas = [PipelineRunSchema.model_validate(r).model_dump_json() for r in runs]
        await websocket.send_text(f"[{','.join(schemas)}]")

    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
