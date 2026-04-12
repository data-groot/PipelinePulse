"""
DAG Factory — PipelinePulse
============================
Runs at module-load time (every Airflow DAG-scan cycle, ~5 minutes by default).
Reads meta.pipeline_configs where enabled=true and registers one Airflow DAG
per row into globals() so the scheduler discovers them automatically.

Idempotent: safe to execute 100 times — existing DAG objects are simply
overwritten in globals() with identical definitions.

Connection: uses AIRFLOW__DATABASE__SQL_ALCHEMY_CONN from the environment,
swaps the database name to "pipelinepulse" — same pattern as orders_ingest_dag.py.
"""

import json
import logging
import os
import csv
from datetime import datetime, timedelta

import psycopg2
from cryptography.fernet import Fernet, InvalidToken

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _get_meta_conn():
    """
    Return a psycopg2 connection to the pipelinepulse database.
    Derives host/port/user/password from the Airflow metadata DB URL so there
    is a single source of truth for credentials in docker-compose.yml.
    """
    airflow_conn = os.environ.get(
        "AIRFLOW__DATABASE__SQL_ALCHEMY_CONN",
        "postgresql+psycopg2://postgres:postgres@postgres:5432/airflow",
    )
    # Strip the SQLAlchemy driver suffix (+psycopg2) and swap the database.
    base = airflow_conn.replace("+psycopg2", "").rsplit("/", 1)[0]
    db_url = base + "/pipelinepulse"
    return psycopg2.connect(db_url)


def _decrypt_config(raw_config: dict) -> dict:
    """
    Decrypt connection_config values that are Fernet-encrypted byte strings.
    If FERNET_KEY is not set or the value is not encrypted, returns the
    config as-is (plain-text fallback for development pipelines).
    """
    fernet_key = os.environ.get("FERNET_KEY", "")
    if not fernet_key:
        return raw_config

    try:
        f = Fernet(fernet_key.encode())
    except Exception as exc:
        log.warning("FERNET_KEY is invalid, returning raw config: %s", exc)
        return raw_config

    decrypted = {}
    for k, v in raw_config.items():
        if isinstance(v, str):
            try:
                decrypted[k] = f.decrypt(v.encode()).decode()
            except (InvalidToken, Exception):
                # Value was not encrypted — keep as-is
                decrypted[k] = v
        else:
            decrypted[k] = v
    return decrypted


# ---------------------------------------------------------------------------
# Task callables (one set per generated DAG, closed over pipeline metadata)
# ---------------------------------------------------------------------------

def _make_extract(pipeline_id: int, user_id: int, source_type: str, raw_config: dict):
    """Return a PythonOperator callable that extracts data for one pipeline."""

    def extract(**context):
        conn = _get_meta_conn()
        cur = conn.cursor()
        run_id = context["run_id"]
        dag_id = context["dag"].dag_id
        row_count = 0

        # Insert a 'running' record immediately so the UI shows in-flight state.
        cur.execute(
            """
            INSERT INTO meta.pipeline_runs (run_id, dag_id, status, started_at)
            VALUES (%s, %s, 'running', NOW())
            ON CONFLICT (run_id)
            DO UPDATE SET status = 'running', started_at = NOW()
            """,
            (run_id, dag_id),
        )
        conn.commit()

        try:
            config = _decrypt_config(raw_config)
            schema = f"user_{user_id}_bronze"
            table  = f"raw_{source_type}"

            # Ensure the bronze table exists for this pipeline's source type.
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {schema}.{table} (
                    id         BIGSERIAL PRIMARY KEY,
                    payload    JSONB NOT NULL,
                    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            conn.commit()

            if source_type == "rest_api":
                import urllib.request
                url     = config.get("url", "")
                api_key = config.get("api_key", "")
                if not url:
                    raise ValueError("rest_api pipeline is missing 'url' in connection_config")
                req = urllib.request.Request(url)
                if api_key:
                    req.add_header("Authorization", f"Bearer {api_key}")
                    req.add_header("X-API-Key", api_key)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    body = resp.read().decode()
                data = json.loads(body)
                rows = data if isinstance(data, list) else [data]
                for row in rows:
                    cur.execute(
                        f"INSERT INTO {schema}.{table} (payload) VALUES (%s::jsonb)",
                        (json.dumps(row),),
                    )
                row_count = len(rows)

            elif source_type == "postgresql":
                import psycopg2 as pg2
                src_host  = config.get("host", "localhost")
                src_port  = int(config.get("port", 5432))
                src_db    = config.get("database", "")
                src_user  = config.get("user", "")
                src_pass  = config.get("password", "")
                src_table = config.get("table", "")
                if not src_table:
                    raise ValueError("postgresql pipeline is missing 'table' in connection_config")
                src_conn = pg2.connect(
                    host=src_host, port=src_port, dbname=src_db,
                    user=src_user, password=src_pass,
                )
                src_cur = src_conn.cursor()
                src_cur.execute(f"SELECT * FROM {src_table}")
                cols = [desc[0] for desc in src_cur.description]
                for src_row in src_cur.fetchall():
                    payload = dict(zip(cols, [str(v) if v is not None else None for v in src_row]))
                    cur.execute(
                        f"INSERT INTO {schema}.{table} (payload) VALUES (%s::jsonb)",
                        (json.dumps(payload),),
                    )
                    row_count += 1
                src_cur.close()
                src_conn.close()

            elif source_type == "csv":
                upload_path = f"/tmp/uploads/{pipeline_id}.csv"
                if not os.path.exists(upload_path):
                    log.warning("CSV file not found at %s — skipping extract", upload_path)
                else:
                    with open(upload_path, newline="") as fh:
                        reader = csv.DictReader(fh)
                        for csv_row in reader:
                            cur.execute(
                                f"INSERT INTO {schema}.{table} (payload) VALUES (%s::jsonb)",
                                (json.dumps(dict(csv_row)),),
                            )
                            row_count += 1

            else:
                log.warning(
                    "Unknown source_type '%s' for pipeline %d — no data extracted",
                    source_type, pipeline_id,
                )

            conn.commit()

        except Exception as exc:
            conn.rollback()
            # Mark as failed before re-raising so update_run still has a record.
            cur.execute(
                """
                UPDATE meta.pipeline_runs
                SET status = 'failed', finished_at = NOW(), error_message = %s
                WHERE run_id = %s
                """,
                (str(exc)[:2000], run_id),
            )
            conn.commit()
            cur.close()
            conn.close()
            raise

        cur.close()
        conn.close()

        context["ti"].xcom_push(key="rows_processed", value=row_count)
        return row_count

    extract.__name__ = f"extract_{pipeline_id}"
    return extract


def _make_quality_check(pipeline_id: int, user_id: int, source_type: str):
    """Return a PythonOperator callable that runs quality checks for one pipeline."""

    def quality_check(**context):
        conn = _get_meta_conn()
        cur  = conn.cursor()
        run_id     = context["run_id"]
        schema     = f"user_{user_id}_bronze"
        table_name = f"raw_{source_type}"
        full_table = f"{schema}.{table_name}"

        checks_passed = 0
        total_checks  = 2

        # Check 1: row count > 0
        try:
            cur.execute(f"SELECT COUNT(*) FROM {full_table}")
            row_count = cur.fetchone()[0]
            check1_passed = row_count > 0
        except Exception as exc:
            log.error("quality_check row-count query failed: %s", exc)
            check1_passed = False
            row_count = 0

        if check1_passed:
            checks_passed += 1

        cur.execute(
            """
            INSERT INTO meta.quality_runs
                (table_name, check_name, passed, score, details, run_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
            """,
            (
                full_table,
                "row_count_nonzero",
                check1_passed,
                1.0 if check1_passed else 0.0,
                json.dumps({"run_id": run_id, "pipeline_id": pipeline_id, "count": row_count}),
            ),
        )

        # Check 2: no null payloads
        try:
            cur.execute(f"SELECT COUNT(*) FROM {full_table} WHERE payload IS NULL")
            null_count = cur.fetchone()[0]
            check2_passed = null_count == 0
        except Exception as exc:
            log.error("quality_check null-payload query failed: %s", exc)
            check2_passed = False
            null_count = -1

        if check2_passed:
            checks_passed += 1

        cur.execute(
            """
            INSERT INTO meta.quality_runs
                (table_name, check_name, passed, score, details, run_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
            """,
            (
                full_table,
                "no_null_payloads",
                check2_passed,
                1.0 if check2_passed else 0.0,
                json.dumps({"run_id": run_id, "pipeline_id": pipeline_id, "null_count": null_count}),
            ),
        )

        conn.commit()
        cur.close()
        conn.close()

        overall_score = checks_passed / total_checks
        log.info(
            "Pipeline %d quality score: %.2f (%d/%d checks passed)",
            pipeline_id, overall_score, checks_passed, total_checks,
        )
        context["ti"].xcom_push(key="quality_score", value=overall_score)

    quality_check.__name__ = f"quality_check_{pipeline_id}"
    return quality_check


def _make_update_run(pipeline_id: int, extract_task_id: str):
    """Return a PythonOperator callable that finalises the pipeline_run record."""

    def update_run(**context):
        conn = _get_meta_conn()
        cur  = conn.cursor()
        run_id = context["run_id"]
        dag_id = context["dag"].dag_id

        rows_processed = (
            context["ti"].xcom_pull(task_ids=extract_task_id, key="rows_processed") or 0
        )

        # Determine final status from upstream task states.
        # If all tasks succeeded we reach here, so default to 'success'.
        # If the extract task raised, it would have already set 'failed' before
        # re-raising, but we still try to mark success from here (idempotent).
        cur.execute(
            """
            INSERT INTO meta.pipeline_runs
                (run_id, dag_id, status, started_at, finished_at, rows_processed)
            VALUES (%s, %s, 'success', %s, NOW(), %s)
            ON CONFLICT (run_id)
            DO UPDATE SET
                status         = 'success',
                finished_at    = NOW(),
                rows_processed = EXCLUDED.rows_processed
            """,
            (run_id, dag_id, context["dag_run"].start_date, rows_processed),
        )
        conn.commit()
        cur.close()
        conn.close()

    update_run.__name__ = f"update_run_{pipeline_id}"
    return update_run


# ---------------------------------------------------------------------------
# Factory: read configs and register DAGs
# ---------------------------------------------------------------------------

def _load_pipeline_configs():
    """
    Connect to PostgreSQL and return all enabled user pipeline rows.
    Returns an empty list on any connection error so Airflow does not crash.
    Only rows with a non-null user_id are returned — the three demo DAGs
    (user_id IS NULL) are intentionally excluded.
    """
    try:
        conn = _get_meta_conn()
        cur  = conn.cursor()
        cur.execute(
            """
            SELECT id, user_id, name, dag_id, source_type,
                   connection_config, schedule
            FROM   meta.pipeline_configs
            WHERE  enabled = true
              AND  user_id IS NOT NULL
            ORDER BY id
            """
        )
        cols = ["id", "user_id", "name", "dag_id", "source_type", "connection_config", "schedule"]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        cur.close()
        conn.close()
        return rows
    except Exception as exc:
        log.error(
            "dag_factory: failed to load pipeline_configs from PostgreSQL — "
            "zero user DAGs will be registered. Error: %s",
            exc,
        )
        return []


def _build_dag(row: dict) -> DAG:
    """Construct and return one Airflow DAG for a single pipeline_configs row."""
    pipeline_id = row["id"]
    user_id     = row["user_id"]
    source_type = row["source_type"] or "unknown"
    raw_config  = row["connection_config"] or {}
    schedule    = row["schedule"] or "@daily"
    dag_id      = row["dag_id"]

    # Task IDs must be unique within the DAG; embed pipeline_id to be explicit.
    extract_task_id = f"extract_{pipeline_id}"
    dbt_task_id     = f"dbt_transform_{pipeline_id}"
    quality_task_id = f"quality_check_{pipeline_id}"
    update_task_id  = f"update_run_{pipeline_id}"

    default_args = {
        "owner":       f"user_{user_id}",
        "retries":     1,
        "retry_delay": timedelta(minutes=5),
    }

    dag = DAG(
        dag_id=dag_id,
        schedule_interval=schedule,
        start_date=datetime(2024, 1, 1),
        catchup=False,
        is_paused_upon_creation=False,
        tags=["user_pipeline", f"user_{user_id}"],
        default_args=default_args,
        description=f"Auto-generated DAG for pipeline '{row['name']}' (id={pipeline_id})",
    )

    with dag:
        task_extract = PythonOperator(
            task_id=extract_task_id,
            python_callable=_make_extract(pipeline_id, user_id, source_type, raw_config),
            provide_context=True,
        )

        # dbt transform — runs the staging model.  --vars passes user/pipeline
        # context so dbt models can filter to the right schema if needed.
        dbt_vars = json.dumps({"user_id": user_id, "pipeline_id": pipeline_id})
        task_dbt = BashOperator(
            task_id=dbt_task_id,
            bash_command=(
                "mkdir -p ${DBT_LOG_PATH:-/tmp/dbt_logs} ${DBT_TARGET_PATH:-/tmp/dbt_target} && "
                "cd /opt/airflow/dbt && "
                "dbt run "
                "  --profiles-dir . "
                "  --log-path ${DBT_LOG_PATH:-/tmp/dbt_logs} "
                "  --target-path ${DBT_TARGET_PATH:-/tmp/dbt_target} "
                f" --vars '{dbt_vars}' "
                "  --select stg_orders"
            ),
        )

        task_quality = PythonOperator(
            task_id=quality_task_id,
            python_callable=_make_quality_check(pipeline_id, user_id, source_type),
            provide_context=True,
        )

        task_update = PythonOperator(
            task_id=update_task_id,
            python_callable=_make_update_run(pipeline_id, extract_task_id),
            provide_context=True,
            trigger_rule="all_done",  # run even if upstream tasks failed
        )

        task_extract >> task_dbt >> task_quality >> task_update

    return dag


# ---------------------------------------------------------------------------
# Module-level execution — this runs every DAG-scan cycle
# ---------------------------------------------------------------------------

_configs = _load_pipeline_configs()

for _row in _configs:
    try:
        _dag = _build_dag(_row)
        globals()[_dag.dag_id] = _dag
        log.info(
            "dag_factory: registered DAG '%s' for user_id=%s pipeline_id=%s",
            _dag.dag_id, _row["user_id"], _row["id"],
        )
    except Exception as _exc:
        log.error(
            "dag_factory: failed to build DAG for pipeline_id=%s ('%s'): %s",
            _row.get("id"), _row.get("name"), _exc,
        )

log.info(
    "dag_factory: scan complete — %d user pipeline(s) registered out of %d config(s) loaded",
    sum(1 for r in _configs if r["dag_id"] in globals()),
    len(_configs),
)
