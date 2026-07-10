from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

SOURCE_TYPES = {"rest_api", "postgresql", "csv"}
SCHEDULES = {"5min", "hourly", "daily", "weekly", "manual"}


# --- Auth ---

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Pipelines ---

class PipelineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    source_type: str
    schedule: str = "daily"
    connection_config: dict = {}
    timestamp_field: str | None = None
    metric_field: str | None = None

    @field_validator("source_type")
    @classmethod
    def valid_source(cls, v: str) -> str:
        if v not in SOURCE_TYPES:
            raise ValueError(f"source_type must be one of {sorted(SOURCE_TYPES)}")
        return v

    @field_validator("schedule")
    @classmethod
    def valid_schedule(cls, v: str) -> str:
        if v not in SCHEDULES:
            raise ValueError(f"schedule must be one of {sorted(SCHEDULES)}")
        return v


class PipelineOut(BaseModel):
    id: int
    name: str
    source_type: str
    schedule: str
    enabled: bool
    timestamp_field: str | None
    metric_field: str | None
    next_run_at: datetime | None
    created_at: datetime
    # Enriched from latest run:
    last_run_status: str | None = None
    last_run_at: datetime | None = None
    rows_processed: int = 0

    model_config = {"from_attributes": True}


# --- Runs ---

class RunOut(BaseModel):
    id: int
    pipeline_id: int
    pipeline_name: str | None = None
    status: str
    trigger: str
    started_at: datetime
    finished_at: datetime | None
    rows_processed: int
    error_message: str | None

    model_config = {"from_attributes": True}


# --- Quality ---

class QualityCheckOut(BaseModel):
    id: int
    pipeline_id: int
    pipeline_name: str | None = None
    check_name: str
    passed: bool
    score: float
    details: dict | None
    checked_at: datetime

    model_config = {"from_attributes": True}


# --- Metrics ---

class OverviewOut(BaseModel):
    total_pipelines: int
    enabled_pipelines: int
    healthy_pipelines: int
    avg_quality_score: float | None
    runs_last_24h: int
    last_activity: datetime | None


class DailyMetricOut(BaseModel):
    day: date
    row_count: int
    metric_sum: float | None
    metric_avg: float | None

    model_config = {"from_attributes": True}
