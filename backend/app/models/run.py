from sqlalchemy import Column, DateTime, Integer, String, Text, func
from app.core.database import Base


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    __table_args__ = {"schema": "meta"}

    id = Column(Integer, primary_key=True, index=True)
    dag_id = Column(String(255), nullable=False, index=True)
    run_id = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(String(32), nullable=False, index=True)  # running|success|failed|skipped
    started_at = Column(DateTime(timezone=True), index=True)
    finished_at = Column(DateTime(timezone=True), index=True)
    rows_processed = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
