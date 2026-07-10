# PipelinePulse — Project Context

PipelinePulse v2 is a self-serve multi-tenant ETL platform with observability: users connect a source (REST API / PostgreSQL / CSV), pick a schedule, and get bronze → silver → gold data with quality scores on a live dashboard.

v2 deliberately replaced the v1 stack (Airflow, dbt, schema-per-user, WebSockets, Kubernetes) with a lean design. Do not reintroduce those.

## Stack

- Frontend: Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui on **Base UI** (`render` prop, NOT Radix `asChild`), TanStack Query v5, Recharts. Deployed on Vercel.
- Backend: FastAPI, Python 3.12, SQLAlchemy 2 async, Pydantic v2. Deployed on Google Cloud Run (scale-to-zero).
- DB: PostgreSQL 16 — local via docker-compose, prod on Neon. Tables created by `create_all` on startup (no Alembic).
- Scheduling: Google Cloud Scheduler → `POST /internal/scheduler/tick` (guarded by `X-Scheduler-Secret` header). No orchestrator process.

## Architecture rules

- Multi-tenancy is row-level: every query is scoped by `user_id`/`pipeline_id` FKs. No per-user schemas, no runtime DDL.
- Auth is httpOnly-cookie JWT ONLY. No localStorage tokens, no Bearer headers. The frontend proxies `/api/*` and `/auth/*` to the backend via Next.js rewrites (`next.config.ts`, `BACKEND_URL` env), so requests are same-origin — do not add CORS workarounds.
- The run engine (`backend/app/engine/`) is the heart: `execute_pipeline` = extract (connectors.py) → transform bronze→silver→gold (transform.py, full rebuild, idempotent) → quality checks (quality.py, 4 checks scored 0–1) → record run. Runs are awaited synchronously; extraction is capped (settings: 1000 rows / 5 pages).
- Live updates are TanStack Query polling (5–10s). No WebSockets.
- Connection configs are Fernet-encrypted strings in `pipelines.connection_config`.
- Code must stay SQLite-compatible for tests (JSONB via `with_variant`, no pg-only statements, guard tz-naive datetimes).

## Working on this repo

- Backend tests: `cd backend && python -m pytest` (in-memory SQLite, respx for HTTP mocks). Keep them passing.
- Frontend must pass `npm run build` (TypeScript strict).
- Landing page (`frontend/app/page.tsx`) contains a Three.js voxel scene (`components/Voxel*.ts*`) — don't regress it.
- E2E smoke: docker compose up → uvicorn on :8000 → npm run dev → signup → Load sample → Run now → dashboard shows data.
