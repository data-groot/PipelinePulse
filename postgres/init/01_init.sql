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
