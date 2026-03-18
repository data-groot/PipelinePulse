from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, text
from app.database import Base

class DailyWeatherAgg(Base):
    __tablename__ = "daily_weather_agg"
    __table_args__ = {"schema": "gold"}

    date = Column(Date, primary_key=True)
    city = Column(String, primary_key=True)
    avg_temp_c = Column(Numeric)
    max_wind_ms = Column(Numeric)
    dbt_updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class DailySalesAgg(Base):
    __tablename__ = "daily_sales_agg"
    __table_args__ = {"schema": "gold"}

    date = Column(Date, primary_key=True)
    total_revenue = Column(Numeric)
    successful_orders = Column(Integer)
    dbt_updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

class GithubActivityAgg(Base):
    __tablename__ = "github_activity_agg"
    __table_args__ = {"schema": "gold"}

    date = Column(Date, primary_key=True)
    repo = Column(String, primary_key=True)
    total_commits = Column(Integer)
    total_prs = Column(Integer)
    open_prs = Column(Integer)
    dbt_updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
