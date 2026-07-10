from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# JSONB on Postgres, plain JSON elsewhere (SQLite in tests)
JSONB = JSON().with_variant(PG_JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Pipeline(Base):
    __tablename__ = "pipelines"
    __table_args__ = (UniqueConstraint("user_id", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    source_type: Mapped[str] = mapped_column(String(20))  # rest_api | postgresql | csv
    schedule: Mapped[str] = mapped_column(String(20), default="daily")  # 5min|hourly|daily|weekly|manual
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Fernet-encrypted JSON string of connection details (url/api key/db creds)
    connection_config: Mapped[str] = mapped_column(Text, default="")
    timestamp_field: Mapped[str | None] = mapped_column(String(120), nullable=True)
    metric_field: Mapped[str | None] = mapped_column(String(120), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BronzeRow(Base):
    __tablename__ = "bronze_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pipeline_id: Mapped[int] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SilverRow(Base):
    __tablename__ = "silver_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pipeline_id: Mapped[int] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    record: Mapped[dict] = mapped_column(JSONB)
    event_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metric_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class GoldDaily(Base):
    __tablename__ = "gold_daily"
    __table_args__ = (UniqueConstraint("pipeline_id", "day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pipeline_id: Mapped[int] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    day: Mapped[date] = mapped_column(Date)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    metric_sum: Mapped[float | None] = mapped_column(Float, nullable=True)
    metric_avg: Mapped[float | None] = mapped_column(Float, nullable=True)


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pipeline_id: Mapped[int] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(10), default="running")  # running|success|failed
    trigger: Mapped[str] = mapped_column(String(10), default="manual")  # manual|scheduled
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rows_processed: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class QualityCheck(Base):
    __tablename__ = "quality_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    pipeline_id: Mapped[int] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    check_name: Mapped[str] = mapped_column(String(60))
    passed: Mapped[bool] = mapped_column(Boolean)
    score: Mapped[float] = mapped_column(Float)  # 0.0 – 1.0
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
