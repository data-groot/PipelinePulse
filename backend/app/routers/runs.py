"""Runs router — list and detail for meta.pipeline_runs"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.run import PipelineRun
from app.models.user import User
from app.schemas.pipeline import PipelineRunCreate, PipelineRunOut
from app.websocket.manager import manager

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[PipelineRunOut])
async def list_runs(
    dag_id: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PipelineRun]:
    q = select(PipelineRun).order_by(desc(PipelineRun.started_at)).limit(limit)
    if dag_id:
        q = q.where(PipelineRun.dag_id == dag_id)
    if status:
        q = q.where(PipelineRun.status == status)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.get("/{run_id}", response_model=PipelineRunOut)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PipelineRun:
    result = await db.execute(select(PipelineRun).where(PipelineRun.run_id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("", response_model=PipelineRunOut, status_code=201)
async def create_run(
    payload: PipelineRunCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PipelineRun:
    """Called by Airflow DAGs to register a new run."""
    run = PipelineRun(**payload.model_dump())
    db.add(run)
    await db.flush()
    # Broadcast the new run to WebSocket subscribers
    await manager.broadcast_all({
        "event": "run_created",
        "run_id": run.run_id,
        "dag_id": run.dag_id,
        "status": run.status,
    })
    return run


@router.patch("/{run_id}", response_model=PipelineRunOut)
async def update_run(
    run_id: str,
    payload: PipelineRunCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PipelineRun:
    """Update run status/metrics — called by Airflow on completion."""
    result = await db.execute(select(PipelineRun).where(PipelineRun.run_id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(run, field, value)
    await db.flush()

    await manager.broadcast(run_id, {
        "event": "run_updated",
        "run_id": run.run_id,
        "status": run.status,
        "rows_processed": run.rows_processed,
    })
    return run
