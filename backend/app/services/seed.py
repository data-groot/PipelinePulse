"""Seed service — populates 3 demo pipelines + sample runs on startup."""
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.pipeline import Pipeline
from app.models.run import PipelineRun
from app.models.user import User
from app.core.security import hash_password

DEMO_PIPELINES = [
    {
        "name": "WeatherFlow",
        "source_type": "weatherflow",
        "schedule": "*/15 * * * *",
        "enabled": True,
    },
    {
        "name": "OrderStream",
        "source_type": "orderstream",
        "schedule": "*/5 * * * *",
        "enabled": True,
    },
    {
        "name": "GitPulse",
        "source_type": "gitpulse",
        "schedule": "*/10 * * * *",
        "enabled": True,
    },
]

DEMO_RUNS = [
    ("weather_ingest", "success", 120),
    ("weather_ingest", "success", 115),
    ("weather_ingest", "failed", 0),
    ("orders_ingest", "success", 500),
    ("orders_ingest", "success", 482),
    ("github_ingest", "success", 88),
    ("github_ingest", "running", 0),
]


async def seed_database(db: AsyncSession) -> None:
    """Idempotently seed demo data."""
    # Admin user
    result = await db.execute(select(User).where(User.username == "admin"))
    if not result.scalar_one_or_none():
        db.add(User(
            username="admin",
            email="admin@pipelinepulse.dev",
            hashed_password=hash_password("admin123"),
            is_admin=True,
        ))

    # Demo pipelines
    for p in DEMO_PIPELINES:
        result = await db.execute(select(Pipeline).where(Pipeline.name == p["name"]))
        if not result.scalar_one_or_none():
            db.add(Pipeline(**p))

    await db.flush()

    # Demo runs (only if none exist)
    result = await db.execute(select(PipelineRun))
    if not result.scalars().first():
        now = datetime.now(timezone.utc)
        for i, (dag_id, status, rows) in enumerate(DEMO_RUNS):
            started = now - timedelta(hours=len(DEMO_RUNS) - i, minutes=5)
            finished = started + timedelta(minutes=3) if status != "running" else None
            db.add(PipelineRun(
                dag_id=dag_id,
                run_id=f"demo_{dag_id}_{i}",
                status=status,
                started_at=started,
                finished_at=finished,
                rows_processed=rows,
            ))

    await db.commit()
