from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.meta_models import PipelineConfig, PipelineRun
from app.schemas import PipelineConfigWithStatus, PipelineRun as PipelineRunSchema
from app.auth import get_current_user
from app.services.airflow_client import AirflowClient

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])

@router.get("", response_model=List[PipelineConfigWithStatus])
async def get_pipelines(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PipelineConfig))
    configs = result.scalars().all()
    
    response = []
    for config in configs:
        run_res = await db.execute(
            select(PipelineRun).where(PipelineRun.dag_id == config.name).order_by(PipelineRun.started_at.desc()).limit(1)
        )
        latest_run = run_res.scalars().first()
        
        cfg_dict = config.__dict__.copy()
        if latest_run:
            cfg_dict["last_run_status"] = latest_run.status
            cfg_dict["last_run_time"] = latest_run.started_at
            
        response.append(PipelineConfigWithStatus(**cfg_dict))
    return response

@router.get("/{dag_id}/runs", response_model=List[PipelineRunSchema])
async def get_pipeline_runs(
    dag_id: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(PipelineRun).where(PipelineRun.dag_id == dag_id).order_by(PipelineRun.started_at.desc()).offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.post("/{dag_id}/trigger")
async def trigger_pipeline(
    dag_id: str,
    current_user: str = Depends(get_current_user)
):
    client = AirflowClient()
    response = await client.trigger_dag(dag_id)
    return response.model_dump()

@router.patch("/{dag_id}/toggle", response_model=PipelineConfigWithStatus)
async def toggle_pipeline(
    dag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    result = await db.execute(select(PipelineConfig).where(PipelineConfig.name == dag_id))
    config = result.scalars().first()
    if not config:
        raise HTTPException(status_code=404, detail="Pipeline not found")
        
    config.enabled = not config.enabled
    await db.commit()
    await db.refresh(config)
    
    run_res = await db.execute(
        select(PipelineRun).where(PipelineRun.dag_id == config.name).order_by(PipelineRun.started_at.desc()).limit(1)
    )
    latest_run = run_res.scalars().first()
    cfg_dict = config.__dict__.copy()
    if latest_run:
        cfg_dict["last_run_status"] = latest_run.status
        cfg_dict["last_run_time"] = latest_run.started_at
    return PipelineConfigWithStatus(**cfg_dict)
