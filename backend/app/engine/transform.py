"""Transform step: bronze (raw JSONB) -> silver (cleaned) -> gold (daily aggregates).

Replaces the v1 dbt models. Silver drops null/duplicate payloads and parses the
pipeline's optional timestamp/metric fields; gold upserts one row per day with
row_count and metric sum/avg — enough to chart any source on the dashboard.
"""

import json
from datetime import datetime, timezone

from dateutil import parser as dateparser
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BronzeRow, GoldDaily, Pipeline, SilverRow


def _parse_ts(value) -> datetime | None:
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):  # unix epoch
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        ts = dateparser.parse(str(value))
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    except (ValueError, OverflowError):
        return None


def _parse_metric(value) -> float | None:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


async def transform(pipeline: Pipeline, db: AsyncSession) -> int:
    """Rebuild silver + gold for this pipeline from bronze. Returns silver row count.

    Full rebuild (not incremental) keeps the logic simple and idempotent;
    bronze is capped at ~1000 rows per extract so this stays fast.
    """
    bronze = (
        await db.scalars(select(BronzeRow).where(BronzeRow.pipeline_id == pipeline.id))
    ).all()

    await db.execute(delete(SilverRow).where(SilverRow.pipeline_id == pipeline.id))
    await db.execute(delete(GoldDaily).where(GoldDaily.pipeline_id == pipeline.id))

    seen: set[str] = set()
    silver_rows: list[SilverRow] = []
    for row in bronze:
        if row.payload is None:
            continue
        fingerprint = json.dumps(row.payload, sort_keys=True, default=str)
        if fingerprint in seen:
            continue
        seen.add(fingerprint)

        event_ts = None
        if pipeline.timestamp_field:
            event_ts = _parse_ts(row.payload.get(pipeline.timestamp_field))
        metric = None
        if pipeline.metric_field:
            metric = _parse_metric(row.payload.get(pipeline.metric_field))

        silver_rows.append(
            SilverRow(
                pipeline_id=pipeline.id,
                record=row.payload,
                event_ts=event_ts or row.ingested_at,
                metric_value=metric,
            )
        )
    db.add_all(silver_rows)
    await db.flush()

    # Gold: aggregate per day
    daily: dict = {}
    for s in silver_rows:
        day = (s.event_ts or datetime.now(timezone.utc)).date()
        agg = daily.setdefault(day, {"count": 0, "sum": 0.0, "metrics": 0})
        agg["count"] += 1
        if s.metric_value is not None:
            agg["sum"] += s.metric_value
            agg["metrics"] += 1

    # Gold was cleared above, so plain inserts are safe (no upsert needed).
    for day, agg in daily.items():
        has_metric = agg["metrics"] > 0
        db.add(
            GoldDaily(
                pipeline_id=pipeline.id,
                day=day,
                row_count=agg["count"],
                metric_sum=agg["sum"] if has_metric else None,
                metric_avg=(agg["sum"] / agg["metrics"]) if has_metric else None,
            )
        )
    await db.flush()

    return len(silver_rows)
