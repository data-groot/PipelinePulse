"""Orchestrates one pipeline run: extract -> transform -> quality -> record.

This module is what replaces Airflow. Runs are awaited synchronously — extraction
is capped, so a run takes seconds.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_config
from app.engine.connectors import extract
from app.engine.quality import run_quality_checks
from app.engine.transform import transform
from app.models import Pipeline, Run

logger = logging.getLogger(__name__)

SCHEDULE_INTERVALS = {
    "5min": timedelta(minutes=5),
    "hourly": timedelta(hours=1),
    "daily": timedelta(days=1),
    "weekly": timedelta(weeks=1),
}


def compute_next_run(schedule: str, now: datetime | None = None) -> datetime | None:
    interval = SCHEDULE_INTERVALS.get(schedule)
    if interval is None:  # "manual"
        return None
    return (now or datetime.now(timezone.utc)) + interval


async def execute_pipeline(pipeline: Pipeline, db: AsyncSession, trigger: str = "manual") -> Run:
    run = Run(pipeline_id=pipeline.id, status="running", trigger=trigger)
    db.add(run)
    await db.flush()

    try:
        config = decrypt_config(pipeline.connection_config) if pipeline.connection_config else {}
        await extract(pipeline, config, db)
        rows = await transform(pipeline, db)
        await run_quality_checks(pipeline, run.id, db)
        run.status = "success"
        run.rows_processed = rows
    except Exception as exc:
        logger.exception("Pipeline %s run failed", pipeline.id)
        run.status = "failed"
        run.error_message = str(exc)[:2000]
    finally:
        run.finished_at = datetime.now(timezone.utc)
        pipeline.next_run_at = compute_next_run(pipeline.schedule)
        await db.commit()

    return run
