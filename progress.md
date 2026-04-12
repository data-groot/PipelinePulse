# PipelinePulse — Master Project Tracker

## Project Summary

PipelinePulse is a multi-tenant ETL observability platform built with:

- Next.js 15
- FastAPI
- PostgreSQL 16
- Apache Airflow 2.9
- dbt-core
- Docker Compose
- Kubernetes
- GitHub Actions

### Target Product Goals

- User authentication and protected APIs
- User-defined pipelines
- Multi-tenant schema-per-user data isolation
- Bronze → Silver → Gold medallion flow
- Automated data quality checks
- Live dashboard and real-time pipeline visibility
- Dynamic Airflow DAG generation from database configs

---

# Current Status

## Completed

- [x] Mounted canonical auth router in backend
- [x] Mounted canonical runs router
- [x] Mounted canonical WebSocket router
- [x] Removed active use of legacy `/auth/token` in backend routing
- [x] Completed initial backend repo consistency audit
- [x] Identified canonical backend path to keep
- [x] Identified duplicate/conflicting legacy vs canonical modules

## In Progress

- [ ] Verify backend health after router changes
- [ ] Verify frontend login flow against canonical backend auth
- [ ] Verify runs router works end to end
- [ ] Verify canonical WebSocket route works end to end
- [ ] Confirm whether frontend still depends on legacy WebSocket path
- [ ] Continue backend cleanup in safe batches

## Blocked / Needs Verification

- [ ] Airflow local reliability still needs investigation
- [ ] Backend health status needs confirmation
- [ ] QualityRun schema/model mismatch needs verification against actual DB schema
- [ ] Frontend/backend auth contract may still be mismatched
- [ ] Legacy polling WebSocket cannot be removed until frontend dependency is checked

---

# Phase 1 — Stabilize Current App

## Auth + API Contract

- [x] Switch backend auth mounting to canonical router
- [ ] Confirm `POST /auth/register` works
- [ ] Confirm `POST /auth/login` works
- [ ] Confirm `GET /auth/me` works
- [ ] Confirm protected routes accept canonical bearer token
- [ ] Confirm frontend login uses `/auth/login`
- [ ] Remove any frontend usage of `/auth/token`
- [ ] Verify seeded users are reachable through active auth flow

## Backend Health

- [ ] Run backend and confirm `/health` returns success
- [ ] Check for startup warnings/errors after auth router swap
- [ ] Confirm no import/runtime conflict from newly mounted routers

## Runs + WebSocket

- [x] Mount canonical runs router
- [x] Mount canonical WebSocket router
- [ ] Confirm `GET /runs` works with auth
- [ ] Confirm `GET /runs/{run_id}` works
- [ ] Confirm `POST /runs` works
- [ ] Confirm `PATCH /runs/{run_id}` works
- [ ] Confirm `/ws/runs/{run_id}` works
- [ ] Check whether frontend still uses `/ws/pipeline-runs`
- [ ] Decide when legacy `routers/websocket.py` can be removed

---

# Phase 2 — Backend Cleanup and Canonicalization

## Canonical Backend Consolidation

- [ ] Rewire `routers/pipelines.py` to canonical database/auth/models
- [ ] Rewire `routers/quality.py` to canonical database/auth/models
- [ ] Rewire or remove `routers/metrics.py`
- [ ] Resolve `QualityRun` field mismatch using actual DB schema
- [ ] Delete `app/auth.py` after confirming zero imports remain
- [ ] Delete `app/database.py` after confirming zero imports remain
- [ ] Delete `app/models/meta_models.py` after canonical migration is complete
- [ ] Reduce `app/schemas/__init__.py` to stub or remove legacy usage
- [ ] Remove legacy `routers/websocket.py` after frontend verification
- [ ] Remove or replace demo-era bronze/silver/gold ORM models
- [ ] Fix Alembic `target_metadata` to use canonical Base metadata

## Validation After Cleanup

- [ ] App starts without legacy auth/db imports being required
- [ ] No duplicate mapper conflicts
- [ ] Canonical routes are actually mounted and reachable
- [ ] Legacy dead paths are removed or isolated
- [ ] Auth returns real DB users, not legacy username strings

---

# Phase 3 — Local Reliability and Infrastructure Fixes

## Docker + Compose

- [ ] Confirm `docker compose build` succeeds
- [ ] Confirm backend container becomes healthy
- [ ] Confirm frontend container runs correctly
- [ ] Confirm postgres container is healthy
- [ ] Confirm Airflow services start correctly
- [ ] Confirm dbt runner can execute

## Airflow

- [ ] Investigate current Airflow reliability
- [ ] Confirm scheduler starts successfully
- [ ] Confirm webserver starts successfully
- [ ] Confirm required Python dependencies exist in Airflow image
- [ ] Confirm dbt is installed in Airflow environment if required
- [ ] Verify one manual DAG trigger works
- [ ] Verify run metadata is written correctly after pipeline execution

## End-to-End Local Smoke Test

- [ ] Start full stack locally
- [ ] Log into frontend
- [ ] Trigger a pipeline
- [ ] Confirm run appears in backend
- [ ] Confirm run appears in frontend
- [ ] Confirm WebSocket updates appear live
- [ ] Confirm quality data appears correctly

---

# Phase 4 — Authentication and Multi-Tenancy Foundation

## Auth Foundation

- [ ] Ensure all relevant API endpoints are protected
- [ ] Ensure current user is resolved from DB-backed JWT flow
- [ ] Ensure routes use real user object where required
- [ ] Add ownership checks for pipeline data
- [ ] Add ownership checks for runs
- [ ] Add ownership checks for quality data

## Multi-Tenancy

- [ ] Design schema-per-user implementation
- [ ] Create `user_{id}_bronze`
- [ ] Create `user_{id}_silver`
- [ ] Create `user_{id}_gold`
- [ ] Create per-user schema creation flow on first pipeline
- [ ] Ensure one user cannot access another user's data
- [ ] Ensure backend queries are user-scoped
- [ ] Ensure frontend only sees current user data

---

# Phase 5 — Pipeline Builder and User-Defined Pipelines

## Pipeline Builder Backend

- [ ] Create canonical pipeline creation flow
- [ ] Persist pipeline configs in database
- [ ] Store schedule, source type, and connection config
- [ ] Encrypt connection credentials before storage
- [ ] Add validation for supported source types
- [ ] Add enable/disable pipeline behavior

## Pipeline Builder Frontend

- [ ] Build pipeline creation UI
- [ ] Add source type selection
- [ ] Add schedule selection
- [ ] Add connection details form
- [ ] Add CSV upload flow
- [ ] Add create pipeline submission flow
- [ ] Add success/error states
- [ ] Add pipeline visibility in dashboard after creation

## Replace Demo Pipelines

- [ ] Remove hardcoded demo-only assumptions
- [ ] Stop depending on hardcoded pipeline names
- [ ] Move toward fully user-configurable pipelines

---

# Phase 6 — Airflow DAG Factory

## Dynamic DAG Generation

- [ ] Design config-driven DAG factory
- [ ] Read pipeline configs from DB
- [ ] Generate one DAG per active config
- [ ] Support REST API source type
- [ ] Support PostgreSQL source type
- [ ] Support CSV source type
- [ ] Ensure no code change is needed for a new user pipeline
- [ ] Ensure DAG enable/disable matches pipeline state

## DAG Execution Flow

- [ ] Extract task works correctly
- [ ] dbt transform task works correctly
- [ ] quality check task works correctly
- [ ] run status update task works correctly
- [ ] pipeline run metadata persists correctly

---

# Phase 7 — Data Layer and Quality

## Connectors

- [ ] REST API connector
- [ ] PostgreSQL connector
- [ ] CSV upload connector

## Medallion Flow

- [ ] Raw data lands in bronze unchanged
- [ ] Silver data is cleaned and typed
- [ ] Gold tables are dashboard-ready
- [ ] dbt models reflect actual source/target contracts
- [ ] dbt tests align with final schema

## Data Quality

- [ ] Run checks after every pipeline execution
- [ ] Calculate table quality scores
- [ ] Persist quality results in final schema format
- [ ] Show alert conditions for failures
- [ ] Support score trends/history
- [ ] Ensure frontend quality page matches backend fields

---

# Phase 8 — Frontend Product Completion

## Dashboard

- [ ] Confirm KPI cards reflect real data
- [ ] Confirm pipeline status grid reflects real data
- [ ] Confirm live feed reflects real data
- [ ] Confirm chart data matches backend contract

## Pipelines Page

- [ ] Confirm trigger pipeline works
- [ ] Confirm toggle pipeline works
- [ ] Confirm run history is correct
- [ ] Confirm auth prompts/flows work correctly

## Quality Page

- [ ] Confirm scores render correctly
- [ ] Confirm alerts render correctly
- [ ] Confirm table history renders correctly
- [ ] Confirm field names match final backend schema

## Sources Page / Future UX

- [ ] Replace demo source cards with real user sources
- [ ] Show actual source connection states
- [ ] Add source management workflows if needed

---

# Phase 9 — CI/CD and Deployment

## CI

- [ ] Frontend build passes
- [ ] Backend dependency install passes
- [ ] Docker Compose build passes
- [ ] Add backend tests where missing
- [ ] Add critical frontend tests where needed
- [ ] Add dbt validation in CI if needed

## Deployment

- [ ] Validate Kubernetes manifests
- [ ] Ensure secrets/config are wired correctly
- [ ] Deploy to real cluster
- [ ] Configure real domain
- [ ] Validate production health checks
- [ ] Validate production login
- [ ] Validate production pipeline execution
- [ ] Validate production dashboard

---

# Validation Checklist

## Core Commands

- [ ] `docker compose ps`
- [ ] `docker compose build`
- [ ] `curl http://localhost:8000/health`

## Auth Validation

- [ ] Register test user
- [ ] Login test user
- [ ] Access protected route with token
- [ ] Confirm old `/auth/token` path is no longer used

## Frontend Validation

- [ ] Frontend loads
- [ ] Login works
- [ ] Dashboard loads data
- [ ] Pipelines page loads data
- [ ] Quality page loads data
- [ ] No auth-related 404/401 caused by legacy endpoints

## Pipeline Validation

- [ ] Trigger pipeline
- [ ] Run metadata updates
- [ ] WebSocket updates appear
- [ ] Quality updates appear
- [ ] Dashboard reflects latest run

---

# Next Recommended Tasks

## Immediate Next

- [ ] Verify backend health after router changes
- [ ] Verify frontend auth contract and fix if needed
- [ ] Validate runs router and canonical WebSocket path
- [ ] Then continue safe backend cleanup batch

## After Immediate Next

- [ ] Investigate Airflow local reliability
- [ ] Verify one end-to-end DAG run
- [ ] Continue canonical backend cleanup
- [ ] Start auth + multi-tenancy groundwork

---

# Task Log Template

## Task

**Title:**  
**Goal:**

### Scope

- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

### Files Changed

- [ ] file/path/one
- [ ] file/path/two

### Commands Run

- [ ] command 1
- [ ] command 2

### Validation

- [ ] Validation step 1
- [ ] Validation step 2

### Result

- [ ] Done
- [ ] Partially done
- [ ] Blocked

### Notes / Follow-up

-

---

# Done Log

## Completed Changes

- [x] Canonical auth router mounted in `backend/app/main.py`
- [x] Canonical runs router mounted in `backend/app/main.py`
- [x] Canonical WebSocket router mounted in `backend/app/main.py`

## Important Notes

- `/auth/token` is no longer the active backend login route.
- Active auth routes are now:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
- Legacy polling WebSocket is still present and should not be removed until frontend dependency is verified.
