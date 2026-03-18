# PipelinePulse 🚀

PipelinePulse is an end-to-end ETL Observability platform showcasing a modern data stack. It integrates synthetic data generation, API consumption, transformation, and real-time frontend visualization.

## Architecture & Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI (Python 3.12), SQLAlchemy, Pydantic, WebSockets
- **Database:** PostgreSQL 16
- **Data Transformation:** dbt-core (Medallion Architecture: Bronze, Silver, Gold)
- **Orchestration:** Apache Airflow 2.9
- **Infrastructure:** Docker Compose (Local Dev) / Kubernetes (Production)

## Getting Started (Local Development)

### 1. Prerequisites
- Docker & Docker Compose
- Node.js (Optional if running outside container)

### 2. Boot Cluster
```bash
docker-compose up -d postgres backend frontend
```

### 3. Initialize Orchestrator
Airflow has been natively configured into the docker-compose cluster. To start scheduling pipelines:
```bash
docker-compose up -d airflow-webserver airflow-scheduler
```
* Access Airflow: `http://localhost:8080` (admin/admin)
* Access Dashboard: `http://localhost:3000`
* Access API Docs: `http://localhost:8000/docs`

### 4. Running dbt Manually
```bash
# Triggers the dbt container explicitly 
docker-compose run --rm dbt-runner dbt debug
docker-compose run --rm dbt-runner dbt run
```
