from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any
from datetime import date, datetime

class PipelineConfigBase(BaseModel):
    name: str
    source_type: str
    schedule: str
    enabled: bool

class PipelineRunBase(BaseModel):
    run_id: str
    dag_id: str
    status: str
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    rows_processed: Optional[int]
    error_message: Optional[str]

class PipelineConfigWithStatus(PipelineConfigBase):
    id: int
    user_id: Optional[int] = None
    dag_id: Optional[str] = None
    created_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    last_run_time: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class PipelineRun(PipelineRunBase):
    model_config = ConfigDict(from_attributes=True)

class QualityRun(BaseModel):
    id: int
    run_id: Optional[str]
    table_name: str
    test_name: str
    passed: bool
    error_message: Optional[str]
    checked_at: Optional[datetime]
    model_config = ConfigDict(from_attributes=True)

class WeatherMetric(BaseModel):
    date: date
    city: str
    avg_temp_c: Optional[float]
    max_wind_ms: Optional[float]
    model_config = ConfigDict(from_attributes=True)

class RevenueMetric(BaseModel):
    date: date
    total_revenue: Optional[float]
    successful_orders: Optional[int]
    model_config = ConfigDict(from_attributes=True)

class VelocityMetric(BaseModel):
    date: date
    repo: str
    total_commits: Optional[int]
    total_prs: Optional[int]
    open_prs: Optional[int]
    model_config = ConfigDict(from_attributes=True)

class SummaryMetrics(BaseModel):
    weather: Optional[WeatherMetric]
    revenue: Optional[RevenueMetric]
    velocity: Optional[VelocityMetric]
