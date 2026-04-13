from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.models.gold_models import DailyWeatherAgg, DailySalesAgg, GithubActivityAgg
from app.schemas import WeatherMetric, RevenueMetric, VelocityMetric, SummaryMetrics

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

@router.get("/weather", response_model=List[WeatherMetric])
async def get_weather_metrics(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    try:
        query = select(DailyWeatherAgg)
        if date_from:
            query = query.where(DailyWeatherAgg.date >= date_from)
        if date_to:
            query = query.where(DailyWeatherAgg.date <= date_to)
        result = await db.execute(query.order_by(DailyWeatherAgg.date.desc()))
        return result.scalars().all()
    except Exception:
        return []

@router.get("/revenue", response_model=List[RevenueMetric])
async def get_revenue_metrics(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    try:
        query = select(DailySalesAgg)
        if date_from:
            query = query.where(DailySalesAgg.date >= date_from)
        if date_to:
            query = query.where(DailySalesAgg.date <= date_to)
        result = await db.execute(query.order_by(DailySalesAgg.date.desc()))
        return result.scalars().all()
    except Exception:
        return []

@router.get("/velocity", response_model=List[VelocityMetric])
async def get_velocity_metrics(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    try:
        query = select(GithubActivityAgg)
        if date_from:
            query = query.where(GithubActivityAgg.date >= date_from)
        if date_to:
            query = query.where(GithubActivityAgg.date <= date_to)
        result = await db.execute(query.order_by(GithubActivityAgg.date.desc()))
        return result.scalars().all()
    except Exception:
        return []

@router.get("/summary", response_model=SummaryMetrics)
async def get_summary_metrics(db: AsyncSession = Depends(get_db)):
    try:
        w_res = await db.execute(select(DailyWeatherAgg).order_by(DailyWeatherAgg.date.desc()).limit(1))
        r_res = await db.execute(select(DailySalesAgg).order_by(DailySalesAgg.date.desc()).limit(1))
        v_res = await db.execute(select(GithubActivityAgg).order_by(GithubActivityAgg.date.desc()).limit(1))
        
        return SummaryMetrics(
            weather=w_res.scalars().first(),
            revenue=r_res.scalars().first(),
            velocity=v_res.scalars().first()
        )
    except Exception:
        return SummaryMetrics()
