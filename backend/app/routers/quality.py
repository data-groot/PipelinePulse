from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Pipeline, QualityCheck, User
from app.schemas import QualityCheckOut

router = APIRouter(prefix="/api/quality", tags=["quality"])


def _user_checks_query(user: User):
    return (
        select(QualityCheck, Pipeline.name)
        .join(Pipeline, QualityCheck.pipeline_id == Pipeline.id)
        .where(Pipeline.user_id == user.id)
    )


@router.get("/summary")
async def quality_summary(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    avg_score = await db.scalar(
        select(func.avg(QualityCheck.score))
        .join(Pipeline, QualityCheck.pipeline_id == Pipeline.id)
        .where(Pipeline.user_id == user.id, QualityCheck.checked_at >= week_ago)
    )
    failing = await db.scalar(
        select(func.count())
        .select_from(QualityCheck)
        .join(Pipeline, QualityCheck.pipeline_id == Pipeline.id)
        .where(
            Pipeline.user_id == user.id,
            QualityCheck.passed.is_(False),
            QualityCheck.checked_at >= datetime.now(timezone.utc) - timedelta(hours=24),
        )
    )
    return {
        "avg_score_pct": round(float(avg_score) * 100, 1) if avg_score is not None else None,
        "failing_checks_24h": failing or 0,
    }


@router.get("/scores", response_model=list[QualityCheckOut])
async def latest_scores(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Latest result per (pipeline, check_name)."""
    ranked = (
        select(
            QualityCheck.id,
            func.row_number()
            .over(
                partition_by=(QualityCheck.pipeline_id, QualityCheck.check_name),
                order_by=desc(QualityCheck.checked_at),
            )
            .label("rn"),
        )
        .join(Pipeline, QualityCheck.pipeline_id == Pipeline.id)
        .where(Pipeline.user_id == user.id)
        .subquery()
    )
    latest_ids = select(ranked.c.id).where(ranked.c.rn == 1)
    results = (
        await db.execute(
            _user_checks_query(user)
            .where(QualityCheck.id.in_(latest_ids))
            .order_by(Pipeline.name, QualityCheck.check_name)
        )
    ).all()
    return [_to_out(check, name) for check, name in results]


@router.get("/history", response_model=list[QualityCheckOut])
async def quality_history(
    pipeline_id: int,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    results = (
        await db.execute(
            _user_checks_query(user)
            .where(QualityCheck.pipeline_id == pipeline_id)
            .order_by(desc(QualityCheck.checked_at))
            .limit(min(limit, 500))
        )
    ).all()
    return [_to_out(check, name) for check, name in results]


@router.get("/alerts", response_model=list[QualityCheckOut])
async def quality_alerts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    results = (
        await db.execute(
            _user_checks_query(user)
            .where(QualityCheck.passed.is_(False), QualityCheck.checked_at >= day_ago)
            .order_by(desc(QualityCheck.checked_at))
        )
    ).all()
    return [_to_out(check, name) for check, name in results]


def _to_out(check: QualityCheck, pipeline_name: str) -> QualityCheckOut:
    out = QualityCheckOut.model_validate(check)
    out.pipeline_name = pipeline_name
    return out
