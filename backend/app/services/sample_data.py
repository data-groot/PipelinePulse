"""Built-in sample pipeline so a new user sees the product working in one click.

Uses DummyJSON's carts endpoint — a free, keyless fake e-commerce API — with
`total` as the metric field, so the dashboard chart shows real aggregates.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import encrypt_config
from app.engine import compute_next_run
from app.models import Pipeline, User

SAMPLE_PIPELINE_NAME = "Sample: E-commerce Orders"


async def create_sample_pipeline(user: User, db: AsyncSession) -> Pipeline:
    pipeline = Pipeline(
        user_id=user.id,
        name=SAMPLE_PIPELINE_NAME,
        source_type="rest_api",
        schedule="daily",
        connection_config=encrypt_config({"url": "https://dummyjson.com/carts"}),
        metric_field="total",
        timestamp_field=None,
        next_run_at=compute_next_run("daily"),
    )
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return pipeline
