# PipelinePulse — Project Context

PipelinePulse is a multi-tenant ETL observability platform.

Target stack:

- Frontend: Next.js 15, App Router, TypeScript, Tailwind, shadcn/ui, Recharts, TanStack Query v5
- Backend: FastAPI, Python 3.12, SQLAlchemy async, Pydantic v2, Alembic, JWT auth
- Data: PostgreSQL 16
- Orchestration: Apache Airflow 2.9
- Transforms: dbt-core
- Infra: Docker Compose local, Kubernetes production, GitHub Actions CI/CD

Target architecture:

- Schema-per-user multi-tenancy: user*{id}\_bronze, user*{id}_silver, user_{id}\_gold
- Dynamic DAG generation from pipeline configs
- User-defined pipelines, not hardcoded demo DAGs
- Authenticated ownership checks on all user data
- Bronze -> Silver -> Gold data flow
- Data quality checks after each run
- Live dashboard updates through WebSocket

Current repo realities to remember (as of 2026-04-12):

- Auth is fully working: JWT in httpOnly cookie + localStorage, signup/login/logout all functional.
- Pipeline creation form is live: POST /api/pipelines creates pipelines with per-user ownership.
- DAG factory is built: airflow/dags/dag_factory.py auto-generates one Airflow DAG per active user pipeline.
- orders_ingest_dag runs end to end (extract -> dbt_transform -> quality_check -> update_run).
- FERNET_KEY is set across backend, airflow-scheduler, and airflow-webserver.
- Per-user bronze/silver/gold schemas are created automatically on signup and pipeline creation.
- GET /api/pipelines is user-scoped (returns only the authenticated user's pipelines).
- Frontend auth guard (middleware.ts) redirects unauthenticated users to /login.
- Demo pipelines (WeatherFlow, OrderStream, GitPulse) have user_id=NULL and are excluded from user pipeline lists.
- Legacy routers (metrics.py, quality.py, websocket.py) still import from app.database / app.models.meta_models -- not yet canonicalized.
- No Alembic migration files for the user_id/dag_id/connection_config columns added in this session.

Rules:

1. Do not deviate from the approved stack.
2. Prefer cohesive changes over scattered rewrites.
3. Before editing, read the relevant files and determine the canonical code path.
4. Reconcile duplicated abstractions instead of adding a third one.
5. For any feature touching multiple layers, verify the contract end-to-end.
6. Protect secrets. Never read or expose .env values unless explicitly required and allowed.
7. Prefer minimal, testable progress that moves the repo toward the target architecture.
8. When proposing work, separate:
   - current state
   - target state
   - gap
   - recommended next change
9. When finishing a task, summarize:
   - files changed
   - commands run
   - validation performed
   - known risks / follow-ups
