from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, Numeric, String, func
from app.core.database import Base


class QualityRun(Base):
    __tablename__ = "quality_runs"
    __table_args__ = {"schema": "meta"}

    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String(255), nullable=False, index=True)
    check_name = Column(String(255), nullable=False)
    passed = Column(Boolean, nullable=False, index=True)
    score = Column(Numeric(5, 2), nullable=True)
    details = Column(JSON, nullable=True)
    run_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
