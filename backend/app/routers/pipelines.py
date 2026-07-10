import csv
import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import encrypt_config, get_current_user
from app.engine import compute_next_run, execute_pipeline
from app.models import BronzeRow, Pipeline, Run, User
from app.schemas import PipelineCreate, PipelineOut, RunOut
from app.services.sample_data import SAMPLE_PIPELINE_NAME, create_sample_pipeline

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


async def _get_owned_pipeline(pipeline_id: int, user: User, db: AsyncSession) -> Pipeline:
    pipeline = await db.scalar(
        select(Pipeline).where(Pipeline.id == pipeline_id, Pipeline.user_id == user.id)
    )
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


async def _with_last_run(pipeline: Pipeline, db: AsyncSession) -> PipelineOut:
    last_run = await db.scalar(
        select(Run).where(Run.pipeline_id == pipeline.id).order_by(desc(Run.started_at)).limit(1)
    )
    out = PipelineOut.model_validate(pipeline)
    if last_run:
        out.last_run_status = last_run.status
        out.last_run_at = last_run.started_at
        out.rows_processed = last_run.rows_processed
    return out


@router.get("", response_model=list[PipelineOut])
async def list_pipelines(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pipelines = (
        await db.scalars(
            select(Pipeline).where(Pipeline.user_id == user.id).order_by(Pipeline.created_at)
        )
    ).all()
    return [await _with_last_run(p, db) for p in pipelines]


@router.post("", response_model=PipelineOut, status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    body: PipelineCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    duplicate = await db.scalar(
        select(Pipeline).where(Pipeline.user_id == user.id, Pipeline.name == body.name)
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="You already have a pipeline with this name")
    pipeline = Pipeline(
        user_id=user.id,
        name=body.name,
        source_type=body.source_type,
        schedule=body.schedule,
        connection_config=encrypt_config(body.connection_config) if body.connection_config else "",
        timestamp_field=body.timestamp_field,
        metric_field=body.metric_field,
        next_run_at=compute_next_run(body.schedule),
    )
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return await _with_last_run(pipeline, db)


@router.post("/sample", response_model=PipelineOut, status_code=status.HTTP_201_CREATED)
async def sample_pipeline(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(
        select(Pipeline).where(Pipeline.user_id == user.id, Pipeline.name == SAMPLE_PIPELINE_NAME)
    )
    if existing:
        return await _with_last_run(existing, db)
    pipeline = await create_sample_pipeline(user, db)
    return await _with_last_run(pipeline, db)


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(
    pipeline_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    pipeline = await _get_owned_pipeline(pipeline_id, user, db)
    await db.delete(pipeline)
    await db.commit()


@router.patch("/{pipeline_id}/toggle", response_model=PipelineOut)
async def toggle_pipeline(
    pipeline_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    pipeline = await _get_owned_pipeline(pipeline_id, user, db)
    pipeline.enabled = not pipeline.enabled
    pipeline.next_run_at = compute_next_run(pipeline.schedule) if pipeline.enabled else None
    await db.commit()
    await db.refresh(pipeline)
    return await _with_last_run(pipeline, db)


@router.post("/{pipeline_id}/trigger", response_model=RunOut)
async def trigger_pipeline(
    pipeline_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    pipeline = await _get_owned_pipeline(pipeline_id, user, db)
    run = await execute_pipeline(pipeline, db, trigger="manual")
    out = RunOut.model_validate(run)
    out.pipeline_name = pipeline.name
    return out


@router.post("/{pipeline_id}/upload", status_code=status.HTTP_201_CREATED)
async def upload_csv(
    pipeline_id: int,
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pipeline = await _get_owned_pipeline(pipeline_id, user, db)
    if pipeline.source_type != "csv":
        raise HTTPException(status_code=400, detail="Only CSV pipelines accept file uploads")

    settings = get_settings()
    content = await file.read()
    if len(content) > settings.max_csv_bytes:
        raise HTTPException(status_code=413, detail="File exceeds 10MB limit")
    try:
        text_stream = io.StringIO(content.decode("utf-8-sig"))
        reader = csv.DictReader(text_stream)
        rows = [dict(r) for _, r in zip(range(settings.max_extract_rows), reader)]
    except (UnicodeDecodeError, csv.Error) as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")
    if not rows:
        raise HTTPException(status_code=400, detail="CSV contained no data rows")

    # Re-upload replaces the previous file's rows
    await db.execute(delete(BronzeRow).where(BronzeRow.pipeline_id == pipeline.id))
    db.add_all(BronzeRow(pipeline_id=pipeline.id, payload=r) for r in rows)
    await db.commit()
    return {"rows_ingested": len(rows)}


@router.get("/{pipeline_id}/preview")
async def preview_pipeline(
    pipeline_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    pipeline = await _get_owned_pipeline(pipeline_id, user, db)
    rows = (
        await db.scalars(
            select(BronzeRow)
            .where(BronzeRow.pipeline_id == pipeline.id)
            .order_by(desc(BronzeRow.ingested_at))
            .limit(20)
        )
    ).all()
    return {
        "pipeline_id": pipeline.id,
        "rows": [{"payload": r.payload, "ingested_at": r.ingested_at} for r in rows],
    }
