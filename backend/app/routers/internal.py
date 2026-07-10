"""Scheduler tick — Cloud Scheduler POSTs here every 5 minutes in production.

Guarded by a shared secret header rather than user auth. Runs every enabled
pipeline whose next_run_at has passed, sequentially (runs are seconds each).
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import async_session
from app.engine import execute_pipeline
from app.models import Pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal", tags=["internal"])


def verify_scheduler_secret(x_scheduler_secret: str = Header(default="")):
    if x_scheduler_secret != get_settings().scheduler_secret:
        raise HTTPException(status_code=403, detail="Invalid scheduler secret")


@router.post("/scheduler/tick", dependencies=[Depends(verify_scheduler_secret)])
async def scheduler_tick():
    now = datetime.now(timezone.utc)
    results = []
    async with async_session() as db:
        due = (
            await db.scalars(
                select(Pipeline).where(
                    Pipeline.enabled.is_(True),
                    Pipeline.next_run_at.is_not(None),
                    Pipeline.next_run_at <= now,
                )
            )
        ).all()

    for pipeline in due:
        # Fresh session per run so one failure can't poison the batch
        async with async_session() as db:
            fresh = await db.get(Pipeline, pipeline.id)
            if fresh is None:
                continue
            run = await execute_pipeline(fresh, db, trigger="scheduled")
            results.append({"pipeline_id": fresh.id, "run_id": run.id, "status": run.status})

    logger.info("Scheduler tick: %d due, results=%s", len(due), results)
    return {"due": len(due), "runs": results}
