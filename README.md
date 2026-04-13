# PipelinePulse

PipelinePulse is a self-hosted ETL observability platform for people who need data pipelines but don't have a data engineering team. You sign up, connect a data source, pick a schedule, and PipelinePulse takes care of the rest — extracting the data, running transformations through a bronze/silver/gold pipeline, checking quality, and showing everything on a live dashboard.

It sits on top of Airflow and dbt but hides their complexity. You don't write DAGs or YAML. You fill out a form.

---

## Architecture

```
Browser
  └── Next.js 15 (App Router)
        │
        ▼
  FastAPI Backend
        │
        ├── PostgreSQL ──── meta.users
        │     (meta)        meta.pipeline_configs
        │                   meta.pipeline_runs
        │                   meta.quality_runs
        │
        └── Airflow DAG Factory
              │
              │  (reads meta.pipeline_configs on every scan)
              │
              └── Per-pipeline DAG
                    │
                    ├── extract        → user_{id}_bronze.raw_{source_type}
                    ├── dbt transform  → user_{id}_silver.stg_{model}
                    │                  → user_{id}_gold.kpi_{model}
                    ├── quality check  → meta.quality_runs
                    └── update run     → meta.pipeline_runs
```

Each user gets their own bronze/silver/gold schemas. One user's data never touches another's.

---

## Tech Stack

| Component     | Technology                                    | Purpose                              |
|---------------|-----------------------------------------------|--------------------------------------|
| Frontend      | Next.js 15, TypeScript, Tailwind, shadcn/ui   | Dashboard and pipeline builder UI    |
| Data fetching | TanStack Query v5, Recharts                   | Queries, caching, charts             |
| Backend       | FastAPI, Python 3.12, SQLAlchemy async        | REST API, auth, pipeline management  |
| Auth          | JWT (httpOnly cookie + Bearer), bcrypt        | Signup, login, logout                |
| Orchestration | Apache Airflow 2.9, LocalExecutor             | DAG scheduling and execution         |
| Transforms    | dbt-core, Jinja SQL                           | Bronze → Silver → Gold medallion     |
| Database      | PostgreSQL 16                                 | Metadata + per-user data schemas     |
| Encryption    | Fernet (cryptography library)                 | Connection credential storage        |
| Infra (local) | Docker Compose                                | All services in one command          |
| Infra (prod)  | Kubernetes (planned)                          | Scalable multi-tenant deployment     |

---

## What's Working

- User signup, login, logout — JWT in httpOnly cookie, bcrypt password hashing
- Pipeline creation form — name, source type, schedule, connection config with dynamic fields per source type
- Per-user schema isolation — `user_{id}_bronze`, `user_{id}_silver`, `user_{id}_gold` created automatically
- DAG factory — scans `meta.pipeline_configs` every 5 minutes, generates one live Airflow DAG per enabled pipeline
- `orders_ingest_dag` — full end-to-end run (extract → dbt bronze/silver/gold → quality checks → run record)
- `kpi_revenue_daily` gold model — real aggregated revenue metrics
- Quality checks after every run — row count, null checks, scores persisted to `meta.quality_runs`
- Live run feed — WebSocket pushes pipeline run events to the dashboard in real time
- Multi-tenant API — `GET /api/pipelines` returns only the authenticated user's pipelines
- Connection config encryption — Fernet-encrypted before storage, decrypted at DAG runtime

---

## Quick Start

**Prerequisites:** Docker Desktop, Git

```bash
# 1. Clone
git clone https://github.com/data-groot/PipelinePulse.git
cd PipelinePulse

# 2. Set up environment
cp .env.example .env
```

Open `.env` and set `FERNET_KEY` to a fresh generated key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

```bash
# 3. Start all services
docker compose up -d

# 4. Wait ~60 seconds for Airflow and Postgres to initialize, then open:
#    Dashboard  → http://localhost:3000
#    Airflow UI → http://localhost:8080  (admin / admin)
#    API docs   → http://localhost:8000/docs
```

**5. Sign up** at `http://localhost:3000/login`, create a pipeline, and watch it appear in Airflow automatically.

---

## Project Structure

```
PipelinePulse/
├── frontend/           Next.js 15 app — dashboard, pipeline builder, auth pages
├── backend/            FastAPI app — REST API, auth, pipeline CRUD, WebSocket
│   └── app/
│       ├── routers/    API route handlers (auth, pipelines, metrics, quality, runs)
│       ├── models/     SQLAlchemy ORM models
│       ├── core/       Database, security, settings, dependency injection
│       └── services/   Airflow client, seed data
├── airflow/
│   └── dags/           DAG files — dag_factory.py + 3 demo DAGs
├── dbt/
│   └── models/         Staging and mart SQL models (bronze → silver → gold)
├── postgres/
│   └── init/           DB initialization SQL (schemas, extensions)
├── k8s/                Kubernetes manifests (planned production deployment)
├── .claude/            Claude Code agent definitions and project context
└── docker-compose.yml  Full local stack definition
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FERNET_KEY` | Yes | Encrypts pipeline connection credentials at rest. Generate with `cryptography.fernet.Fernet.generate_key()` |
| `POSTGRES_PASSWORD` | No (default: `postgres`) | PostgreSQL superuser password |
| `POSTGRES_USER` | No (default: `postgres`) | PostgreSQL superuser name |
| `POSTGRES_DB` | No (default: `pipelinepulse`) | Application database name |
| `AIRFLOW_FERNET_KEY` | No | Airflow's own internal Fernet key — separate from the app key |
| `AIRFLOW_ADMIN_PASSWORD` | No (default: `admin`) | Password for the Airflow web UI admin account |

---

## Roadmap

Week 3-4:

- [ ] REST API connector — real HTTP fetch with configurable headers and API key
- [ ] PostgreSQL source connector — pull from any Postgres table on a schedule
- [ ] CSV file upload connector — upload a file, pipeline processes it
- [ ] dbt model routing per source type — right model runs for right data
- [ ] Quality scorecard page — real scores from `meta.quality_runs`, trends over time
- [ ] Alert system — email or Slack notification on failed quality checks
- [ ] Kubernetes deployment — Helm chart for production multi-tenant hosting
- [ ] GitHub Actions CI/CD — build, test, and deploy on push to main

---

## Built By

**Mihir Tatavarthi** — CS Graduate Student at UMBC

Built with [Claude Code](https://claude.ai/code), Cursor Pro, and Claude Pro.
