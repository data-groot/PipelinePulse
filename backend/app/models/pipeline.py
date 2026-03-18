from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from app.core.database import Base


class Pipeline(Base):
    __tablename__ = "pipeline_configs"
    __table_args__ = {"schema": "meta"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), unique=True, nullable=False, index=True)
    source_type = Column(String(64), nullable=False)   # weatherflow | orderstream | gitpulse
    schedule = Column(String(64), nullable=False)       # cron string
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
