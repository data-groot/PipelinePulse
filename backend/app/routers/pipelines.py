from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, text, nullslast
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.pipeline import Pipeline
from app.models.run import PipelineRun
from app.models.user import User
from app.schemas import PipelineConfigWithStatus, PipelineRun as PipelineRunSchema
from app.services.airflow_client import AirflowClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


# ---------------------------------------------------------------------------
# Inline request / response schemas
# ---------------------------------------------------------------------------

class PipelineCreateRequest(BaseModel):
    name: str
    source_type: str
    schedule: str
    connection_config: Dict[str, Any] = {}


class PipelineCreateResponse(BaseModel):
    id: int
    user_id: Optional[int]
    name: str
    source_type: str
    schedule: str
    enabled: bool
    dag_id: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_fernet():
    """Return a Fernet instance if FERNET_KEY is configured, else None."""
    settings = get_settings()
    if not settings.fernet_key:
        logger.warning(
            "FERNET_KEY is not set — connection_config will be stored unencrypted. "
            "Set FERNET_KEY in your environment for production use."
        )
        return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(settings.fernet_key.encode())
    except Exception as exc:
        logger.error("Invalid FERNET_KEY: %s", exc)
        return None


def _encrypt(fernet, data: Dict[str, Any]) -> Dict[str, Any]:
    """Encrypt every string value in the connection_config dict."""
    if fernet is None:
        return data
    import json
    payload = json.dumps(data).encode()
    return {"_encrypted": fernet.encrypt(payload).decode()}


async def create_user_schemas(user_id: int, db: AsyncSession) -> None:
    """Idempotently create the bronze / silver / gold schemas for a user."""
    for tier in ("bronze", "silver", "gold"):
        schema_name = f"user_{user_id}_{tier}"
        # text() is needed because CREATE SCHEMA cannot be parameterised
        await db.execute(
            text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")
        )
    await db.commit()
    logger.info("Ensured bronze/silver/gold schemas for user_id=%s", user_id)


async def _pipeline_with_status(config: Pipeline, db: AsyncSession) -> PipelineConfigWithStatus:
    run_res = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.dag_id == config.dag_id)
        .order_by(nullslast(PipelineRun.started_at.desc()))
        .limit(1)
    )
    latest_run = run_res.scalars().first()
    cfg_dict = {
        c.name: getattr(config, c.name)
        for c in config.__table__.columns
    }
    if latest_run:
        cfg_dict["last_run_status"] = latest_run.status
        cfg_dict["last_run_time"] = latest_run.started_at
    return PipelineConfigWithStatus(**cfg_dict)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=PipelineCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    body: PipelineCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new pipeline owned by the authenticated user."""
    dag_id = body.name.lower().replace(" ", "_") + "_dag"

    fernet = _get_fernet()
    encrypted_cfg = _encrypt(fernet, body.connection_config)

    pipeline = Pipeline(
        user_id=current_user.id,
        name=body.name,
        source_type=body.source_type,
        schedule=body.schedule,
        dag_id=dag_id,
        connection_config=encrypted_cfg,
        enabled=True,
    )
    db.add(pipeline)
    await db.flush()          # get the auto-assigned id before schema creation
    await db.refresh(pipeline)

    await create_user_schemas(current_user.id, db)

    await db.commit()
    await db.refresh(pipeline)
    return pipeline


@router.get("", response_model=List[PipelineConfigWithStatus])
async def get_pipelines(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return only the pipelines owned by the authenticated user."""
    result = await db.execute(
        select(Pipeline).where(Pipeline.user_id == current_user.id)
    )
    configs = result.scalars().all()

    response = []
    for config in configs:
        response.append(await _pipeline_with_status(config, db))
    return response


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a pipeline owned by the authenticated user."""
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == current_user.id,
        )
    )
    pipeline = result.scalars().first()
    if pipeline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")

    await db.delete(pipeline)
    await db.commit()


@router.get("/{dag_id}/runs", response_model=List[PipelineRunSchema])
async def get_pipeline_runs(
    dag_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Ownership check: the dag_id must belong to this user
    owner_check = await db.execute(
        select(Pipeline).where(
            Pipeline.dag_id == dag_id,
            Pipeline.user_id == current_user.id,
        )
    )
    if owner_check.scalars().first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")

    result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.dag_id == dag_id)
        .order_by(PipelineRun.started_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/{dag_id}/trigger")
async def trigger_pipeline(
    dag_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    owner_check = await db.execute(
        select(Pipeline).where(
            Pipeline.dag_id == dag_id,
            Pipeline.user_id == current_user.id,
        )
    )
    if owner_check.scalars().first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")

    client = AirflowClient()
    response = await client.trigger_dag(dag_id)
    return response.model_dump()


@router.patch("/{dag_id}/toggle", response_model=PipelineConfigWithStatus)
async def toggle_pipeline(
    dag_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.dag_id == dag_id,
            Pipeline.user_id == current_user.id,
        )
    )
    config = result.scalars().first()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")

    config.enabled = not config.enabled
    await db.commit()
    await db.refresh(config)
    return await _pipeline_with_status(config, db)
