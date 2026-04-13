from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base


class Pipeline(Base):
    __tablename__ = "pipeline_configs"
    __table_args__ = {"schema": "meta"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("meta.users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(128), unique=True, nullable=False, index=True)
    source_type = Column(String(64), nullable=False)
    schedule = Column(String(64), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    dag_id = Column(String(256), nullable=True)
    connection_config = Column(JSONB, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
