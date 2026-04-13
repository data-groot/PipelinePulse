# PipelinePulse 🚀

PipelinePulse is an end-to-end modern **ETL Observability Platform**. This system runs automated data ingestion pipelines (using Apache Airflow), processes transformations through a multi-layer Medallion architecture (bronze/silver/gold using `dbt`), and serves real-time observability metrics via a Next.js Dashboard and FastAPI backend.

---

## 🏗️ Architecture Stack

- **Orchestration:** Apache Airflow
- **Data Warehouse:** PostgreSQL (Medallion Architecture)
- **Transformations:** dbt (Data Build Tool) core
- **Backend API:** FastAPI (Python) + WebSockets
- **Frontend UI:** Next.js 15, React Query, Recharts, shadcn/ui
- **Deployment:** Docker Compose (with Kubernetes manifests ready for production)

---

## 🛠️ Local Setup & Quickstart

Everything is fully containerized with Docker, making local setup incredibly easy.

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- Git installed.

### 2. Environment Variables
Copy the example environment securely.
```bash
cp .env.example .env
```

### 3. Start the Cluster
Use Docker Compose to build and start all 5 servers (Postgres, Airflow Web, Airflow Scheduler, FastAPI Backend, and Next.js Frontend).
```bash
docker-compose up -d
```
*(Note: On the first run, this may take a few minutes as it compiles the Next.js app and pulls down the heavy Airflow/Postgres images).*

### 4. Run Data Transformations (dbt)
The Airflow DAGs will automatically start populating the raw "Bronze" layer in PostgreSQL. You can manually run your dbt transformations to aggregate those tables into the Silver and Gold analytics layers:

```bash
# Run data transformations
docker-compose run --rm dbt-runner run

# Run quality integrity tests
docker-compose run --rm dbt-runner test
```

---

## 🌐 Navigating the Platform

Once the cluster is running, the following services are available natively on your `localhost`:

- **Observability Dashboard (Next.js):** [http://localhost:3000](http://localhost:3000)
    - *Features real-time WebSocket logs, Pipeline trigger toggles, and Data Quality scorecards.*
- **Airflow Web UI:** [http://localhost:8080](http://localhost:8080)
    - *Username/Password: admin / admin*
- **FastAPI OpenAPI Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **PostgreSQL Database:** `localhost:5432` 

---

## 🧹 Shutting Down

To gracefully pause the containers without losing your data:
```bash
docker-compose stop
```
*(You can resume exactly where you left off by running `docker-compose start` later).*

To completely destroy the containers (your Postgres records remain securely cached in Docker volumes):
```bash
docker-compose down
```
