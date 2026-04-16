from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, text
from typing import List
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.quality import QualityRun
from app.models.pipeline import Pipeline
from app.models.user import User

router = APIRouter(prefix="/api/quality", tags=["quality"])


class QualityScoreItem(BaseModel):
    table_name: str
    check_name: str
    passed: bool
    score: Optional[float]
    run_at: Optional[datetime]

    class Config:
        from_attributes = True


class AvgQualityResponse(BaseModel):
    avg_score_pct: float
    pipeline_count: int
    check_count: int


@router.get("/avg", response_model=AvgQualityResponse)
async def get_avg_quality(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the average quality score (as a percentage, 0-100) across all
    quality checks run against the current user's pipelines in the last 7 days.
    """
    try:
        # Build the list of bronze table name prefixes owned by this user
        pipeline_res = await db.execute(
            select(Pipeline.source_type, Pipeline.id).where(
                Pipeline.user_id == current_user.id
            )
        )
        pipeline_rows = pipeline_res.fetchall()

        if not pipeline_rows:
            return AvgQualityResponse(avg_score_pct=0.0, pipeline_count=0, check_count=0)

        # Quality table_name is stored as  user_{user_id}_bronze.raw_{source_type}
        # so we match on the schema prefix  user_{user_id}_bronze
        schema_prefix = f"user_{current_user.id}_bronze.%"
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)

        res = await db.execute(
            select(
                func.avg(QualityRun.score).label("avg_score"),
                func.count(QualityRun.id).label("check_count"),
            ).where(
                and_(
                    QualityRun.table_name.like(schema_prefix),
                    QualityRun.run_at >= cutoff,
                )
            )
        )
        row = res.fetchone()
        avg_raw = float(row.avg_score) if row and row.avg_score is not None else 0.0
        check_count = int(row.check_count) if row and row.check_count else 0

        return AvgQualityResponse(
            avg_score_pct=round(avg_raw * 100, 1),
            pipeline_count=len(pipeline_rows),
            check_count=check_count,
        )
    except Exception:
        return AvgQualityResponse(avg_score_pct=0.0, pipeline_count=0, check_count=0)


@router.get("/scores", response_model=List[QualityScoreItem])
async def get_quality_scores(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest quality check result per table for the current user's pipelines."""
    try:
        schema_prefix = f"user_{current_user.id}_bronze.%"
        subquery = (
            select(
                QualityRun.table_name,
                func.max(QualityRun.run_at).label("latest")
            )
            .where(QualityRun.table_name.like(schema_prefix))
            .group_by(QualityRun.table_name)
            .subquery()
        )

        query = (
            select(QualityRun)
            .join(
                subquery,
                and_(
                    QualityRun.table_name == subquery.c.table_name,
                    QualityRun.run_at == subquery.c.latest,
                )
            )
        )
        result = await db.execute(query)
        return result.scalars().all()
    except Exception:
        return []


@router.get("/alerts", response_model=List[QualityScoreItem])
async def get_quality_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return failed quality checks in the last 24 h for the current user's pipelines."""
    try:
        schema_prefix = f"user_{current_user.id}_bronze.%"
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        query = (
            select(QualityRun)
            .where(
                and_(
                    QualityRun.table_name.like(schema_prefix),
                    QualityRun.passed == False,
                    QualityRun.run_at >= cutoff,
                )
            )
            .order_by(QualityRun.run_at.desc())
        )
        result = await db.execute(query)
        return result.scalars().all()
    except Exception:
        return []
