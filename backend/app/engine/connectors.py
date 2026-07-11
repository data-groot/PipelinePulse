"""Extract step: pull raw rows from the pipeline's source into memory.

Each connector returns a list of dict payloads, capped by settings to keep
runs fast and free-tier friendly.
"""

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import BronzeRow, Pipeline


async def extract_rest_api(config: dict) -> list[dict]:
    settings = get_settings()
    url = config["url"]
    headers = {}
    if config.get("api_key"):
        headers["Authorization"] = f"Bearer {config['api_key']}"

    rows: list[dict] = []
    first_batch: list[dict] | None = None
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for page in range(1, settings.max_extract_pages + 1):
            params = {"page": page} if page > 1 else {}
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
            # Unwrap envelope shapes like {"data": [...]}: prefer well-known keys,
            # else the first key whose value is a list of objects.
            if isinstance(data, dict):
                list_keys = [k for k, v in data.items() if isinstance(v, list)]
                preferred = [k for k in ("data", "results", "items") if k in list_keys]
                if preferred or list_keys:
                    data = data[(preferred or list_keys)[0]]
                else:
                    data = [data]
            if not data:
                break
            batch = [row if isinstance(row, dict) else {"value": row} for row in data]
            # APIs that ignore ?page= return the same batch forever — stop after one.
            if first_batch is None:
                first_batch = batch
            elif batch == first_batch:
                break
            rows.extend(batch)
            if len(rows) >= settings.max_extract_rows:
                break
    return rows[: settings.max_extract_rows]


async def extract_postgresql(config: dict) -> list[dict]:
    settings = get_settings()
    from sqlalchemy.ext.asyncio import create_async_engine

    url = (
        f"postgresql+asyncpg://{config['user']}:{config['password']}"
        f"@{config['host']}:{config.get('port', 5432)}/{config['database']}"
    )
    if config.get("query"):
        query = config["query"]
    else:
        # Table name can't be bound as a parameter; quote it defensively.
        table = config["table"].replace('"', "")
        query = f'SELECT * FROM "{table}"'

    source_engine = create_async_engine(url, pool_pre_ping=True)
    try:
        async with source_engine.connect() as conn:
            result = await conn.execute(
                text(f"SELECT * FROM ({query}) AS q LIMIT :lim"),
                {"lim": settings.max_extract_rows},
            )
            return [_jsonable(dict(row)) for row in result.mappings()]
    finally:
        await source_engine.dispose()


def _jsonable(row: dict) -> dict:
    """Coerce DB-native values (datetime, Decimal, UUID, ...) to JSON-safe types."""
    import json

    return json.loads(json.dumps(row, default=str))


async def extract(pipeline: Pipeline, config: dict, db: AsyncSession) -> int:
    """Run the source connector and land raw payloads in bronze. Returns row count.

    CSV pipelines are ingested at upload time, so a run just re-processes
    whatever is already in bronze.
    """
    if pipeline.source_type == "csv":
        from sqlalchemy import func, select

        count = await db.scalar(
            select(func.count()).select_from(BronzeRow).where(BronzeRow.pipeline_id == pipeline.id)
        )
        return count or 0

    if pipeline.source_type == "rest_api":
        payloads = await extract_rest_api(config)
    elif pipeline.source_type == "postgresql":
        payloads = await extract_postgresql(config)
    else:
        raise ValueError(f"Unknown source type: {pipeline.source_type}")

    db.add_all(BronzeRow(pipeline_id=pipeline.id, payload=p) for p in payloads)
    await db.flush()
    return len(payloads)
