from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import List
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.meta_models import QualityRun
from app.schemas import QualityRun as QualityRunSchema

router = APIRouter(prefix="/api/quality", tags=["quality"])

@router.get("/scores", response_model=List[QualityRunSchema])
async def get_quality_scores(db: AsyncSession = Depends(get_db)):
    subquery = (
        select(
            QualityRun.table_name,
            func.max(QualityRun.checked_at).label("latest")
        )
        .group_by(QualityRun.table_name)
        .subquery()
    )
    
    query = (
        select(QualityRun)
        .join(
            subquery,
            and_(
                QualityRun.table_name == subquery.c.table_name,
                QualityRun.checked_at == subquery.c.latest
            )
        )
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/history/{table_name}", response_model=List[QualityRunSchema])
async def get_quality_history(table_name: str, db: AsyncSession = Depends(get_db)):
    query = select(QualityRun).where(QualityRun.table_name == table_name).order_by(QualityRun.checked_at.desc()).limit(100)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/alerts", response_model=List[QualityRunSchema])
async def get_quality_alerts(db: AsyncSession = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    query = select(QualityRun).where(
        and_(
            QualityRun.passed == False,
            QualityRun.checked_at >= cutoff
        )
    ).order_by(QualityRun.checked_at.desc())
    result = await db.execute(query)
    return result.scalars().all()
