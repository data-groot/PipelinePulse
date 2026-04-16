from __future__ import annotations

import csv
import io
import logging
import os
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
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


class UploadResponse(BaseModel):
    filename: str
    rows: int
    status: str


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
        cfg_dict["rows_processed"] = latest_run.rows_processed
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


# ---------------------------------------------------------------------------
# Sample pipeline
# ---------------------------------------------------------------------------

_SAMPLE_NAME = "Sample: E-commerce Orders"


@router.post("/sample", response_model=PipelineCreateResponse, status_code=status.HTTP_200_OK)
async def create_sample_pipeline(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Idempotently create (or return) the built-in sample pipeline for the
    authenticated user.

    - If the user already has a pipeline named "Sample: E-commerce Orders",
      it is returned unchanged — no duplicate is created.
    - On first call a new pipeline row is inserted, user schemas are ensured,
      and the row is returned.  The DAG is NOT triggered; the user does that
      themselves with the Trigger Run button.
    """
    sample_dag_id = f"sample_orders_{current_user.id}_dag"

    existing_res = await db.execute(
        select(Pipeline).where(
            Pipeline.user_id == current_user.id,
            Pipeline.name == _SAMPLE_NAME,
        )
    )
    existing = existing_res.scalars().first()
    if existing is not None:
        return existing

    fernet = _get_fernet()
    raw_cfg: Dict[str, Any] = {
        "url": "https://jsonplaceholder.typicode.com/posts",
        "api_key": "",
    }
    encrypted_cfg = _encrypt(fernet, raw_cfg)

    pipeline = Pipeline(
        user_id=current_user.id,
        name=_SAMPLE_NAME,
        source_type="rest_api",
        schedule="0 * * * *",
        dag_id=sample_dag_id,
        connection_config=encrypted_cfg,
        enabled=True,
    )
    db.add(pipeline)
    await db.flush()
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


@router.post("/{pipeline_id}/upload", response_model=UploadResponse)
async def upload_csv(
    pipeline_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Accept a CSV file upload for a pipeline owned by the authenticated user.

    - Only .csv files are accepted.
    - Max file size: 10 MB.
    - Saved to /tmp/uploads/{user_id}_{pipeline_id}.csv so the Airflow extract
      task can find it by that deterministic path.
    - Returns the original filename, row count, and status="uploaded".
    """
    # Ownership check
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == current_user.id,
        )
    )
    pipeline = result.scalars().first()
    if pipeline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")

    # Filename / extension validation
    original_name = file.filename or ""
    if not original_name.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only .csv files are accepted.",
        )

    # Read the entire file into memory so we can (a) check size and (b) count rows
    MAX_BYTES = 10 * 1024 * 1024  # 10 MB
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 10 MB limit.",
        )

    # Count data rows (exclude header)
    try:
        text_content = raw.decode("utf-8-sig")  # handle optional BOM
        reader = csv.DictReader(io.StringIO(text_content))
        rows = list(reader)
        row_count = len(rows)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse CSV: {exc}",
        )

    if row_count == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV file must contain at least one data row.",
        )

    # Persist to disk so the Airflow task can read it
    upload_dir = "/tmp/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    dest_path = os.path.join(upload_dir, f"{current_user.id}_{pipeline_id}.csv")
    with open(dest_path, "wb") as fh:
        fh.write(raw)

    logger.info(
        "CSV uploaded: user_id=%s pipeline_id=%s rows=%d path=%s",
        current_user.id, pipeline_id, row_count, dest_path,
    )
    return UploadResponse(filename=original_name, rows=row_count, status="uploaded")


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


class PreviewResponse(BaseModel):
    pipeline_name: str
    rows: List[Dict[str, Any]]
    total_count: int
    last_synced: Optional[str]


@router.get("/{pipeline_id}/preview", response_model=PreviewResponse)
async def preview_pipeline_data(
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the last 20 rows ingested for a pipeline.

    - Queries the correct per-user bronze table based on source_type.
    - Flattens the JSONB payload so each row's keys appear as top-level fields.
    - Returns an empty rows list (not 404) when no data has been ingested yet.
    """
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.id == pipeline_id,
            Pipeline.user_id == current_user.id,
        )
    )
    pipeline = result.scalars().first()
    if pipeline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")

    schema = f"user_{current_user.id}_bronze"
    source_type = pipeline.source_type or "rest_api"

    # Map source_type to the table name written by the DAG factory
    table_map = {
        "rest_api": "raw_rest_api",
        "csv": "raw_csv",
        "postgresql": "raw_postgresql",
    }
    table_name = table_map.get(source_type, f"raw_{source_type}")
    full_table = f"{schema}.{table_name}"

    try:
        # Check whether the table exists before querying it
        exists_res = await db.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = :schema AND table_name = :table LIMIT 1"
            ),
            {"schema": schema, "table": table_name},
        )
        if exists_res.fetchone() is None:
            return PreviewResponse(
                pipeline_name=pipeline.name,
                rows=[],
                total_count=0,
                last_synced=None,
            )

        count_res = await db.execute(
            text(f"SELECT COUNT(*) FROM {full_table} WHERE pipeline_id = :pid"),
            {"pid": pipeline_id},
        )
        total_count = count_res.scalar() or 0

        rows_res = await db.execute(
            text(
                f"SELECT payload, ingested_at FROM {full_table} "
                "WHERE pipeline_id = :pid "
                "ORDER BY ingested_at DESC LIMIT 20"
            ),
            {"pid": pipeline_id},
        )
        raw_rows = rows_res.fetchall()

        last_synced: Optional[str] = None
        flat_rows: List[Dict[str, Any]] = []
        for row_payload, ingested_at in raw_rows:
            if last_synced is None and ingested_at is not None:
                last_synced = ingested_at.isoformat()
            if isinstance(row_payload, dict):
                flat_rows.append(row_payload)
            else:
                flat_rows.append({"data": str(row_payload)})

        return PreviewResponse(
            pipeline_name=pipeline.name,
            rows=flat_rows,
            total_count=total_count,
            last_synced=last_synced,
        )

    except Exception as exc:
        logger.error("preview_pipeline_data error for pipeline_id=%s: %s", pipeline_id, exc)
        return PreviewResponse(
            pipeline_name=pipeline.name,
            rows=[],
            total_count=0,
            last_synced=None,
        )


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
