from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Pipeline, Run, User
from app.schemas import RunOut

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("", response_model=list[RunOut])
async def list_runs(
    pipeline_id: int | None = None,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Run, Pipeline.name)
        .join(Pipeline, Run.pipeline_id == Pipeline.id)
        .where(Pipeline.user_id == user.id)
        .order_by(desc(Run.started_at))
        .limit(min(limit, 200))
    )
    if pipeline_id is not None:
        query = query.where(Run.pipeline_id == pipeline_id)
    results = (await db.execute(query)).all()
    out = []
    for run, pipeline_name in results:
        item = RunOut.model_validate(run)
        item.pipeline_name = pipeline_name
        out.append(item)
    return out
