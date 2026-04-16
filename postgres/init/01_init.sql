-- 01_init.sql
-- Runs once on first Postgres container start (docker-entrypoint-initdb.d).
-- Creates the Airflow metadata database and all schemas required by PipelinePulse.

-- Airflow uses its own database separate from the app database.
CREATE DATABASE airflow;

-- Schemas in the pipelinepulse database (Bronze / Silver / Gold / Meta).
-- The \connect below switches context; this file is executed by psql as the
-- POSTGRES_USER superuser, so it has the needed privileges.
\connect pipelinepulse

CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;
CREATE SCHEMA IF NOT EXISTS meta;

-- ---------------------------------------------------------------------------
-- meta.users
-- Must be created before pipeline_configs (user_id references it logically).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(64)              NOT NULL,
    email           VARCHAR(255)             NOT NULL,
    hashed_password VARCHAR(255)             NOT NULL,
    is_active       BOOLEAN                  NOT NULL DEFAULT TRUE,
    is_admin        BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE          DEFAULT NOW(),
    CONSTRAINT users_username_key UNIQUE (username),
    CONSTRAINT users_email_key    UNIQUE (email)
);

-- ---------------------------------------------------------------------------
-- meta.pipeline_configs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.pipeline_configs (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR,
    source_type       VARCHAR,
    schedule          VARCHAR,
    enabled           BOOLEAN                  DEFAULT TRUE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id           INTEGER,
    dag_id            VARCHAR,
    connection_config JSONB                    DEFAULT '{}',
    CONSTRAINT pipeline_configs_name_key UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_configs_name       ON meta.pipeline_configs (name);
CREATE INDEX IF NOT EXISTS idx_pipeline_configs_enabled    ON meta.pipeline_configs (enabled);
CREATE INDEX IF NOT EXISTS idx_pipeline_configs_created_at ON meta.pipeline_configs (created_at DESC);

-- ---------------------------------------------------------------------------
-- meta.pipeline_runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.pipeline_runs (
    id             SERIAL PRIMARY KEY,
    dag_id         VARCHAR,
    run_id         VARCHAR,
    status         VARCHAR,
    started_at     TIMESTAMP WITH TIME ZONE,
    finished_at    TIMESTAMP WITH TIME ZONE,
    rows_processed INTEGER,
    error_message  TEXT,
    CONSTRAINT pipeline_runs_run_id_key UNIQUE (run_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_dag_id      ON meta.pipeline_runs (dag_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_run_id      ON meta.pipeline_runs (run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status      ON meta.pipeline_runs (status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at  ON meta.pipeline_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_finished_at ON meta.pipeline_runs (finished_at DESC);

-- ---------------------------------------------------------------------------
-- meta.quality_runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.quality_runs (
    id         SERIAL PRIMARY KEY,
    table_name VARCHAR,
    check_name VARCHAR,
    passed     BOOLEAN,
    score      NUMERIC,
    details    JSONB,
    run_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_runs_table_name ON meta.quality_runs (table_name);
CREATE INDEX IF NOT EXISTS idx_quality_runs_passed     ON meta.quality_runs (passed);
CREATE INDEX IF NOT EXISTS idx_quality_runs_run_at     ON meta.quality_runs (run_at DESC);
