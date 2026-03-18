from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, text
from app.database import Base

class StgWeather(Base):
    __tablename__ = "stg_weather"
    __table_args__ = {"schema": "silver"}

    id = Column(Integer, primary_key=True, index=True)
    city = Column(String, nullable=False)
    temp_c = Column(Numeric)
    humidity = Column(Integer)
    wind_ms = Column(Numeric)
    recorded_at = Column(DateTime(timezone=True))
    dbt_updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class StgOrders(Base):
    __tablename__ = "stg_orders"
    __table_args__ = {"schema": "silver"}

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String, unique=True)
    user_id = Column(String)
    amount = Column(Numeric)
    status = Column(String)
    created_at = Column(DateTime(timezone=True))
    dbt_updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class StgUsers(Base):
    __tablename__ = "stg_users"
    __table_args__ = {"schema": "silver"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True)
    name = Column(String)
    email = Column(String)
    created_at = Column(DateTime(timezone=True))
    dbt_updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class StgCommits(Base):
    __tablename__ = "stg_commits"
    __table_args__ = {"schema": "silver"}

    id = Column(Integer, primary_key=True, index=True)
    commit_sha = Column(String, unique=True)
    repo = Column(String)
    author = Column(String)
    message = Column(Text)
    committed_at = Column(DateTime(timezone=True))
    dbt_updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class StgPRs(Base):
    __tablename__ = "stg_prs"
    __table_args__ = {"schema": "silver"}

    id = Column(Integer, primary_key=True, index=True)
    pr_id = Column(Integer, unique=True)
    repo = Column(String)
    title = Column(String)
    state = Column(String)
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))
    dbt_updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
