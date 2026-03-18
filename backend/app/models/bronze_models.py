import json
from sqlalchemy import Column, Integer, String, JSON, DateTime, text
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base

class RawWeather(Base):
    __tablename__ = "raw_weather"
    __table_args__ = {"schema": "bronze"}

    id = Column(Integer, primary_key=True, index=True)
    city = Column(String)
    payload = Column(JSONB, nullable=False)
    ingested_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class RawOrders(Base):
    __tablename__ = "raw_orders"
    __table_args__ = {"schema": "bronze"}

    id = Column(Integer, primary_key=True, index=True)
    payload = Column(JSONB, nullable=False)
    ingested_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class RawUsers(Base):
    __tablename__ = "raw_users"
    __table_args__ = {"schema": "bronze"}

    id = Column(Integer, primary_key=True, index=True)
    payload = Column(JSONB, nullable=False)
    ingested_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class RawCommits(Base):
    __tablename__ = "raw_commits"
    __table_args__ = {"schema": "bronze"}

    id = Column(Integer, primary_key=True, index=True)
    repo = Column(String)
    payload = Column(JSONB, nullable=False)
    ingested_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class RawPRs(Base):
    __tablename__ = "raw_prs"
    __table_args__ = {"schema": "bronze"}

    id = Column(Integer, primary_key=True, index=True)
    repo = Column(String)
    payload = Column(JSONB, nullable=False)
    ingested_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
