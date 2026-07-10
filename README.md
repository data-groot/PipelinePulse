# PipelinePulse

**Self-serve data pipelines with built-in observability.** Sign up, connect a source (REST API, PostgreSQL, or CSV), pick a schedule — PipelinePulse extracts your data, runs it through a bronze → silver → gold medallion flow, scores its quality after every run, and shows everything on a live dashboard.

No Airflow. No YAML. No data team required.

## Architecture

```
Browser
  └── Next.js (Vercel)
        │  /api/* and /auth/* proxied via Next.js rewrites
        │  → same-origin cookies, zero CORS config
        ▼
  FastAPI (Google Cloud Run, scale-to-zero)
        │
        ├── PostgreSQL (Neon) ── users, pipelines, runs, quality_checks
        │                        bronze_rows → silver_rows → gold_daily
        │
        └── Run engine:  extract → transform → quality → record
              ▲
  Cloud Scheduler ── POST /internal/scheduler/tick every 5 min
```

**Design choices that keep it simple:**

- **No orchestrator process.** Cloud Scheduler pings a tick endpoint; the backend runs due pipelines in-process. Runs are capped (~1000 rows) so they finish in seconds.
- **Row-level multi-tenancy.** Every table carries a `user_id`/`pipeline_id` foreign key — no per-user schemas, no runtime DDL.
- **Medallion in plain Python/SQL.** Bronze holds raw JSONB payloads unchanged; silver is cleaned, deduplicated, and typed; gold is one row per pipeline-day with `row_count`, `metric_sum`, `metric_avg`.
- **Quality scored every run.** Row count, null payloads, duplicate ratio, and freshness — persisted per run so trends are queryable.
- **Secrets encrypted at rest.** Connection configs (API keys, DB credentials) are Fernet-encrypted before storage.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2 async, Pydantic v2 |
| Auth | JWT in httpOnly cookie, bcrypt |
| Database | PostgreSQL 16 (Neon in production) |
| Scheduling | Google Cloud Scheduler → Cloud Run |
| Hosting | Vercel (frontend) + Cloud Run (backend) — ~$0/month |

## Local Development

**Prerequisites:** Python 3.12+, Node 20+, Docker Desktop

```bash
git clone https://github.com/data-groot/PipelinePulse.git
cd PipelinePulse

# 1. Postgres
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # Windows
pip install -r requirements.txt
cp ../.env.example .env                              # then set FERNET_KEY (see below)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
uvicorn app.main:app --port 8000 --reload

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`, sign up, click **Load sample** on the Pipelines page, and press **Run now**.

**Tests:**

```bash
cd backend && python -m pytest
```

## Deployment

1. **Neon** — create a free Postgres project, copy the connection string (use the `postgresql+asyncpg://` scheme).
2. **Cloud Run** — from `backend/`:
   ```bash
   gcloud run deploy pipelinepulse-api --source . --region us-east4 --allow-unauthenticated \
     --set-env-vars "DATABASE_URL=...,JWT_SECRET=...,FERNET_KEY=...,SCHEDULER_SECRET=...,COOKIE_SECURE=true"
   ```
3. **Cloud Scheduler** — one job, every 5 minutes, hitting the tick endpoint:
   ```bash
   gcloud scheduler jobs create http pipelinepulse-tick --schedule "*/5 * * * *" \
     --uri "https://<cloud-run-url>/internal/scheduler/tick" --http-method POST \
     --headers "X-Scheduler-Secret=<SCHEDULER_SECRET>" --location us-east4
   ```
4. **Vercel** — import the repo, set root directory to `frontend/`, add env var `BACKEND_URL=https://<cloud-run-url>`.

## API Surface

| Route | Purpose |
|---|---|
| `POST /auth/signup` `login` `logout`, `GET /auth/me` | Cookie-JWT auth |
| `GET/POST /api/pipelines`, `DELETE /{id}` | Pipeline CRUD |
| `PATCH /{id}/toggle`, `POST /{id}/trigger` | Enable/disable, run now |
| `POST /{id}/upload`, `GET /{id}/preview` | CSV ingest, bronze preview |
| `GET /api/runs` | Run history / live feed |
| `GET /api/quality/summary` `scores` `alerts` `history` | Quality checks |
| `GET /api/metrics/overview` `daily` | KPI cards, gold-layer chart data |
| `POST /internal/scheduler/tick` | Cloud Scheduler entry point (secret-guarded) |
