-- =============================================================
-- PipelinePulse — Initial Schema Migration
-- File: 001_initial_schema.sql
-- Creates: bronze, silver, gold, meta schemas + all tables + indexes
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ─────────────────────────────────────────────────────────────
-- SCHEMAS
-- ─────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;
CREATE SCHEMA IF NOT EXISTS meta;

-- =============================================================
-- SCHEMA: bronze  (raw ingestion layer — append-only)
-- =============================================================

CREATE TABLE IF NOT EXISTS bronze.raw_weather (
    id           SERIAL PRIMARY KEY,
    city         VARCHAR,
    payload      JSONB NOT NULL,
    ingested_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bronze.raw_orders (
    id           SERIAL PRIMARY KEY,
    payload      JSONB NOT NULL,
    ingested_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bronze.raw_users (
    id           SERIAL PRIMARY KEY,
    payload      JSONB NOT NULL,
    ingested_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bronze.raw_commits (
    id           SERIAL PRIMARY KEY,
    repo         VARCHAR,
    payload      JSONB NOT NULL,
    ingested_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bronze.raw_prs (
    id           SERIAL PRIMARY KEY,
    repo         VARCHAR,
    payload      JSONB NOT NULL,
    ingested_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bronze indexes (timestamp filtering)
CREATE INDEX IF NOT EXISTS idx_raw_weather_ingested_at  ON bronze.raw_weather  (ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_orders_ingested_at   ON bronze.raw_orders   (ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_users_ingested_at    ON bronze.raw_users    (ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_commits_ingested_at  ON bronze.raw_commits  (ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_prs_ingested_at      ON bronze.raw_prs      (ingested_at DESC);

-- Bronze indexes (FK-like / grouping columns)
CREATE INDEX IF NOT EXISTS idx_raw_weather_city   ON bronze.raw_weather  (city);
CREATE INDEX IF NOT EXISTS idx_raw_commits_repo   ON bronze.raw_commits  (repo);
CREATE INDEX IF NOT EXISTS idx_raw_prs_repo       ON bronze.raw_prs      (repo);

-- =============================================================
-- SCHEMA: silver  (cleaned / typed staging layer — dbt managed)
-- =============================================================

CREATE TABLE IF NOT EXISTS silver.stg_weather (
    id            SERIAL PRIMARY KEY,
    city          VARCHAR NOT NULL,
    temp_c        NUMERIC,
    humidity      INT,
    wind_ms       NUMERIC,
    recorded_at   TIMESTAMPTZ,
    dbt_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS silver.stg_orders (
    id            SERIAL PRIMARY KEY,
    order_id      VARCHAR UNIQUE,
    user_id       VARCHAR,
    amount        NUMERIC,
    status        VARCHAR,
    created_at    TIMESTAMPTZ,
    dbt_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS silver.stg_users (
    id         SERIAL PRIMARY KEY,
    user_id    VARCHAR UNIQUE,
    country    VARCHAR,
    plan       VARCHAR,
    created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS silver.stg_commits (
    id           SERIAL PRIMARY KEY,
    sha          VARCHAR UNIQUE,
    author       VARCHAR,
    message      TEXT,
    committed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS silver.stg_prs (
    id               SERIAL PRIMARY KEY,
    pr_number        INT,
    state            VARCHAR,
    merged_at        TIMESTAMPTZ,
    cycle_time_hrs   NUMERIC
);

-- Silver indexes (timestamp filtering)
CREATE INDEX IF NOT EXISTS idx_stg_weather_recorded_at    ON silver.stg_weather   (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_stg_weather_dbt_updated_at ON silver.stg_weather   (dbt_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stg_orders_created_at      ON silver.stg_orders    (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stg_orders_dbt_updated_at  ON silver.stg_orders    (dbt_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stg_users_created_at       ON silver.stg_users     (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stg_commits_committed_at   ON silver.stg_commits   (committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stg_prs_merged_at          ON silver.stg_prs       (merged_at DESC);

-- Silver indexes (FK-like / grouping columns)
CREATE INDEX IF NOT EXISTS idx_stg_orders_user_id     ON silver.stg_orders   (user_id);
CREATE INDEX IF NOT EXISTS idx_stg_weather_city       ON silver.stg_weather  (city);
CREATE INDEX IF NOT EXISTS idx_stg_commits_author     ON silver.stg_commits  (author);
CREATE INDEX IF NOT EXISTS idx_stg_prs_state          ON silver.stg_prs      (state);

-- Silver unique constraints are already covered by UNIQUE column definitions above
-- Additional explicit indexes for unique columns when not already B-tree by default:
CREATE INDEX IF NOT EXISTS idx_stg_orders_order_id    ON silver.stg_orders   (order_id);
CREATE INDEX IF NOT EXISTS idx_stg_users_user_id      ON silver.stg_users    (user_id);
CREATE INDEX IF NOT EXISTS idx_stg_commits_sha        ON silver.stg_commits  (sha);

-- =============================================================
-- SCHEMA: gold  (aggregated KPI layer — dbt managed)
-- =============================================================

CREATE TABLE IF NOT EXISTS gold.kpi_weather_daily (
    id            SERIAL PRIMARY KEY,
    date          DATE,
    city          VARCHAR,
    avg_temp_c    NUMERIC,
    avg_humidity  NUMERIC,
    data_points   INT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gold.kpi_revenue_daily (
    id               SERIAL PRIMARY KEY,
    date             DATE UNIQUE,
    gmv              NUMERIC,
    orders           INT,
    avg_order_value  NUMERIC,
    return_rate      NUMERIC,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gold.kpi_dev_velocity (
    id                  SERIAL PRIMARY KEY,
    date                DATE UNIQUE,
    commits             INT,
    prs_merged          INT,
    avg_cycle_time_hrs  NUMERIC,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Gold indexes (timestamp / date filtering)
CREATE INDEX IF NOT EXISTS idx_kpi_weather_daily_date        ON gold.kpi_weather_daily   (date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_weather_daily_created_at  ON gold.kpi_weather_daily   (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_revenue_daily_date        ON gold.kpi_revenue_daily   (date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_revenue_daily_created_at  ON gold.kpi_revenue_daily   (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_velocity_date         ON gold.kpi_dev_velocity    (date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_velocity_created_at   ON gold.kpi_dev_velocity    (created_at DESC);

-- Gold indexes (grouping)
CREATE INDEX IF NOT EXISTS idx_kpi_weather_daily_city   ON gold.kpi_weather_daily (city);

-- =============================================================
-- SCHEMA: meta  (pipeline observability layer)
-- =============================================================

CREATE TABLE IF NOT EXISTS meta.pipeline_runs (
    id             SERIAL PRIMARY KEY,
    dag_id         VARCHAR,
    run_id         VARCHAR UNIQUE,
    status         VARCHAR,
    started_at     TIMESTAMPTZ,
    finished_at    TIMESTAMPTZ,
    rows_processed INT,
    error_message  TEXT
);

CREATE TABLE IF NOT EXISTS meta.quality_runs (
    id          SERIAL PRIMARY KEY,
    table_name  VARCHAR,
    check_name  VARCHAR,
    passed      BOOLEAN,
    score       NUMERIC,
    details     JSONB,
    run_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meta.pipeline_configs (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR UNIQUE,
    source_type  VARCHAR,
    schedule     VARCHAR,
    enabled      BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meta.users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(64) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE NOT NULL,
    is_admin        BOOLEAN DEFAULT FALSE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Meta indexes (timestamp filtering)
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at   ON meta.pipeline_runs  (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_finished_at  ON meta.pipeline_runs  (finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_runs_run_at        ON meta.quality_runs   (run_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_configs_created_at ON meta.pipeline_configs (created_at DESC);

-- Meta indexes (FK-like / grouping columns)
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_dag_id       ON meta.pipeline_runs  (dag_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status       ON meta.pipeline_runs  (status);
CREATE INDEX IF NOT EXISTS idx_quality_runs_table_name    ON meta.quality_runs   (table_name);
CREATE INDEX IF NOT EXISTS idx_quality_runs_passed        ON meta.quality_runs   (passed);
CREATE INDEX IF NOT EXISTS idx_pipeline_configs_enabled   ON meta.pipeline_configs (enabled);

-- Unique constraint index already created by UNIQUE on run_id and name
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_run_id       ON meta.pipeline_runs  (run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_configs_name      ON meta.pipeline_configs (name);
