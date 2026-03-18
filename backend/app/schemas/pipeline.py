from datetime import datetime
from pydantic import BaseModel


class PipelineBase(BaseModel):
    name: str
    source_type: str
    schedule: str
    enabled: bool = True


class PipelineCreate(PipelineBase):
    pass


class PipelineOut(PipelineBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PipelineRunBase(BaseModel):
    dag_id: str
    run_id: str
    status: str
    rows_processed: int = 0
    error_message: str | None = None


class PipelineRunCreate(PipelineRunBase):
    started_at: datetime | None = None
    finished_at: datetime | None = None


class PipelineRunOut(PipelineRunBase):
    id: int
    started_at: datetime | None
    finished_at: datetime | None

    model_config = {"from_attributes": True}


class QualityRunOut(BaseModel):
    id: int
    table_name: str
    check_name: str
    passed: bool
    score: float | None
    details: dict | None
    run_at: datetime

    model_config = {"from_attributes": True}
