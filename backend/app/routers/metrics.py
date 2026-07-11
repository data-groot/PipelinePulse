from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import GoldDaily, Pipeline, QualityCheck, Run, User
from app.schemas import DailyMetricOut, OverviewOut

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/overview", response_model=OverviewOut)
async def overview(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    total = await db.scalar(
        select(func.count()).select_from(Pipeline).where(Pipeline.user_id == user.id)
    )
    enabled = await db.scalar(
        select(func.count())
        .select_from(Pipeline)
        .where(Pipeline.user_id == user.id, Pipeline.enabled.is_(True))
    )
    # Healthy = latest run succeeded
    latest_runs = (
        select(
            Run.pipeline_id,
            Run.status,
            func.row_number()
            .over(partition_by=Run.pipeline_id, order_by=desc(Run.started_at))
            .label("rn"),
        )
        .join(Pipeline, Run.pipeline_id == Pipeline.id)
        .where(Pipeline.user_id == user.id)
        .subquery()
    )
    healthy = await db.scalar(
        select(func.count())
        .select_from(latest_runs)
        .where(latest_runs.c.rn == 1, latest_runs.c.status == "success")
    )
    avg_quality = await db.scalar(
        select(func.avg(QualityCheck.score))
        .join(Pipeline, QualityCheck.pipeline_id == Pipeline.id)
        .where(Pipeline.user_id == user.id, QualityCheck.checked_at >= now - timedelta(days=7))
    )
    runs_24h = await db.scalar(
        select(func.count())
        .select_from(Run)
        .join(Pipeline, Run.pipeline_id == Pipeline.id)
        .where(Pipeline.user_id == user.id, Run.started_at >= now - timedelta(hours=24))
    )
    last_activity = await db.scalar(
        select(func.max(Run.started_at))
        .join(Pipeline, Run.pipeline_id == Pipeline.id)
        .where(Pipeline.user_id == user.id)
    )
    return OverviewOut(
        total_pipelines=total or 0,
        enabled_pipelines=enabled or 0,
        healthy_pipelines=healthy or 0,
        avg_quality_score=round(float(avg_quality) * 100, 1) if avg_quality is not None else None,
        runs_last_24h=runs_24h or 0,
        last_activity=last_activity,
    )


@router.get("/daily", response_model=list[DailyMetricOut])
async def daily_metrics(
    pipeline_id: int,
    days: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc).date() - timedelta(days=min(days, 365))
    rows = (
        await db.scalars(
            select(GoldDaily)
            .join(Pipeline, GoldDaily.pipeline_id == Pipeline.id)
            .where(
                Pipeline.user_id == user.id,
                GoldDaily.pipeline_id == pipeline_id,
                GoldDaily.day >= since,
            )
            .order_by(GoldDaily.day)
        )
    ).all()
    return rows
