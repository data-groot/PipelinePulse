from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, text
from app.database import Base

class PipelineConfig(Base):
    __tablename__ = "pipeline_configs"
    __table_args__ = {"schema": "meta"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    dag_id = Column(String, nullable=True)   # Airflow DAG ID; nullable until backfilled
    source_type = Column(String, nullable=False)
    schedule = Column(String, nullable=False)
    enabled = Column(Boolean, server_default=text("true"))

class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    __table_args__ = {"schema": "meta"}

    run_id = Column(String, primary_key=True)
    dag_id = Column(String, nullable=False)
    status = Column(String, nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    finished_at = Column(DateTime(timezone=True))
    rows_processed = Column(Integer, server_default=text("0"))
    error_message = Column(Text)

class QualityRun(Base):
    __tablename__ = "quality_runs"
    __table_args__ = {"schema": "meta"}

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String)
    table_name = Column(String, nullable=False)
    test_name = Column(String, nullable=False)
    passed = Column(Boolean, nullable=False)
    error_message = Column(Text)
    checked_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "meta"}

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
