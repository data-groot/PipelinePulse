"""Quality step: score the pipeline's data after each run.

Four checks, each 0.0 or 1.0 (freshness is graded). Persisted per run so the
quality page can show trends over time.
"""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BronzeRow, Pipeline, QualityCheck, SilverRow


async def run_quality_checks(pipeline: Pipeline, run_id: int, db: AsyncSession) -> float:
    """Run all checks, persist results, return overall score (0.0 – 1.0)."""
    bronze_total = await db.scalar(
        select(func.count()).select_from(BronzeRow).where(BronzeRow.pipeline_id == pipeline.id)
    )
    bronze_nulls = await db.scalar(
        select(func.count())
        .select_from(BronzeRow)
        .where(BronzeRow.pipeline_id == pipeline.id, BronzeRow.payload.is_(None))
    )
    silver_total = await db.scalar(
        select(func.count()).select_from(SilverRow).where(SilverRow.pipeline_id == pipeline.id)
    )
    latest_ingest = await db.scalar(
        select(func.max(BronzeRow.ingested_at)).where(BronzeRow.pipeline_id == pipeline.id)
    )

    duplicates_dropped = (bronze_total - bronze_nulls) - silver_total
    dup_ratio = duplicates_dropped / bronze_total if bronze_total else 1.0

    if latest_ingest is None:
        freshness_score = 0.0
        age_hours = None
    else:
        if latest_ingest.tzinfo is None:  # SQLite returns naive datetimes
            latest_ingest = latest_ingest.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(timezone.utc) - latest_ingest).total_seconds() / 3600
        # Full score under 24h, decaying to 0 at 7 days.
        freshness_score = max(0.0, min(1.0, 1.0 - (age_hours - 24) / (24 * 6)))

    checks = [
        ("row_count_nonzero", bronze_total > 0, 1.0 if bronze_total else 0.0,
         {"bronze_rows": bronze_total}),
        ("no_null_payloads", bronze_nulls == 0, 1.0 if bronze_nulls == 0 else 0.0,
         {"null_payloads": bronze_nulls}),
        ("low_duplicates", dup_ratio <= 0.1, 1.0 if dup_ratio <= 0.1 else 0.0,
         {"duplicates_dropped": duplicates_dropped, "duplicate_ratio": round(dup_ratio, 3)}),
        ("freshness", freshness_score >= 0.5, round(freshness_score, 3),
         {"age_hours": round(age_hours, 1) if age_hours is not None else None}),
    ]

    for name, passed, score, details in checks:
        db.add(
            QualityCheck(
                run_id=run_id,
                pipeline_id=pipeline.id,
                check_name=name,
                passed=passed,
                score=score,
                details=details,
            )
        )
    await db.flush()
    return sum(score for _, _, score, _ in checks) / len(checks)
