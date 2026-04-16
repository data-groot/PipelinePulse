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
import httpx
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
            # Each source_type branch creates its own table with the right schema.
            if source_type == "rest_api":
                cur.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS {schema}.{table} (
                        id          SERIAL PRIMARY KEY,
                        pipeline_id INTEGER,
                        payload     JSONB,
                        ingested_at TIMESTAMP DEFAULT NOW()
                    )
                    """
                )
                conn.commit()

                url     = config.get("url", "")
                api_key = config.get("api_key", "")
                if not url:
                    raise ValueError("rest_api pipeline is missing 'url' in connection_config")

                masked_url = url.split("?")[0]  # strip any existing query params for logging
                log.info("rest_api extract: calling %s (api_key present: %s)", masked_url, bool(api_key))

                all_rows = []
                next_url = url
                pages_fetched = 0
                MAX_PAGES = 5

                while next_url and pages_fetched < MAX_PAGES:
                    # Build headers and params; try Bearer first
                    headers = {"Accept": "application/json"}
                    params  = {}
                    if api_key:
                        headers["Authorization"] = f"Bearer {api_key}"

                    try:
                        resp = httpx.get(
                            next_url,
                            headers=headers,
                            params=params,
                            timeout=30,
                            follow_redirects=True,
                        )
                    except httpx.TimeoutException:
                        raise RuntimeError("API request timed out")

                    # If Bearer auth returned 401/403, retry with api_key as query param
                    if resp.status_code in (401, 403) and api_key:
                        log.info("rest_api: Bearer auth failed (%d), retrying with api_key query param", resp.status_code)
                        resp = httpx.get(
                            next_url,
                            headers={"Accept": "application/json"},
                            params={"api_key": api_key},
                            timeout=30,
                            follow_redirects=True,
                        )

                    if resp.status_code == 401 or resp.status_code == 403:
                        raise RuntimeError("Invalid API key")
                    if resp.status_code == 404:
                        raise RuntimeError("URL not found")
                    if resp.status_code == 429:
                        raise RuntimeError("Rate limited by API")
                    resp.raise_for_status()

                    content_type = resp.headers.get("content-type", "")
                    if "json" not in content_type and not resp.text.strip().startswith(("{", "[")):
                        raise RuntimeError("API did not return JSON")

                    try:
                        data = resp.json()
                    except Exception:
                        raise RuntimeError("API did not return JSON")

                    # Unwrap common envelope keys
                    if isinstance(data, dict):
                        for envelope_key in ("data", "results", "items"):
                            if envelope_key in data and isinstance(data[envelope_key], list):
                                data = data[envelope_key]
                                break

                    page_rows = data if isinstance(data, list) else [data]
                    all_rows.extend(page_rows)
                    pages_fetched += 1

                    # Pagination: look for next page indicator
                    next_url = None
                    if isinstance(data, dict):
                        for page_key in ("next_page", "next", "cursor"):
                            candidate = data.get(page_key)
                            if candidate and isinstance(candidate, str):
                                next_url = candidate
                                log.info("rest_api: following pagination key '%s' -> %s", page_key, candidate.split("?")[0])
                                break
                    # If we consumed the envelope, original `data` is now a list so no pagination object

                log.info("rest_api extract: fetched %d total rows across %d page(s)", len(all_rows), pages_fetched)

                # Bulk insert into bronze using executemany
                insert_sql = (
                    f"INSERT INTO {schema}.{table} (pipeline_id, payload) "
                    "VALUES (%s, %s::jsonb)"
                )
                cur.executemany(
                    insert_sql,
                    [(pipeline_id, json.dumps(r)) for r in all_rows],
                )
                row_count = len(all_rows)

            elif source_type == "postgresql":
                # NOTE: in production the connection_config values arrive encrypted
                # from the API and are decrypted above by _decrypt_config() using
                # FERNET_KEY.  The test pipeline inserted directly into the DB is
                # plain-text, which _decrypt_config() handles transparently.
                import psycopg2 as pg2
                import psycopg2.errors

                src_host  = config.get("host", "localhost")
                src_port  = int(config.get("port", 5432))
                src_db    = config.get("database", "")
                src_user  = config.get("username", "")   # frontend sends "username"
                src_pass  = config.get("password", "")
                src_query = config.get("query", "").strip()
                src_table = config.get("table", "").strip()

                # Determine the SQL to execute and a label for source_table column
                if src_query:
                    final_query  = src_query
                    source_label = "custom_query"
                elif src_table:
                    final_query  = f"SELECT * FROM {src_table} LIMIT 1000"
                    source_label = src_table
                else:
                    raise ValueError("No query or table specified in connection config")

                # Log enough to debug without ever logging the password
                log.info(
                    "postgresql extract: connecting to %s:%s/%s as user '%s'",
                    src_host, src_port, src_db, src_user,
                )

                # Ensure the bronze table exists with the full canonical schema
                cur.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS {schema}.raw_postgresql (
                        id           SERIAL PRIMARY KEY,
                        pipeline_id  INTEGER,
                        source_table TEXT,
                        payload      JSONB,
                        ingested_at  TIMESTAMP DEFAULT NOW()
                    )
                    """
                )
                conn.commit()

                src_conn = None
                try:
                    src_conn = pg2.connect(
                        host=src_host,
                        port=src_port,
                        dbname=src_db,
                        user=src_user,
                        password=src_pass,
                        connect_timeout=10,
                        options="-c statement_timeout=30000",  # 30-second query timeout
                    )
                    src_cur = src_conn.cursor()
                    src_cur.execute(final_query)
                    cols      = [desc[0] for desc in src_cur.description]
                    src_rows  = src_cur.fetchall()
                    src_cur.close()
                except pg2.OperationalError as exc:
                    msg = str(exc).lower()
                    if "connection refused" in msg or "could not connect" in msg or "no route" in msg:
                        raise RuntimeError(
                            f"Cannot connect to database at {src_host}:{src_port}"
                        ) from exc
                    if "password" in msg or "authentication" in msg or "invalid password" in msg:
                        raise RuntimeError("Invalid database credentials") from exc
                    raise
                except pg2.errors.QueryCanceled as exc:
                    raise RuntimeError("Query timed out after 30 seconds") from exc
                except pg2.errors.UndefinedTable as exc:
                    raise RuntimeError(
                        f"Table {src_table!r} does not exist"
                    ) from exc
                finally:
                    # Always release the source connection — never let it leak
                    if src_conn is not None:
                        try:
                            src_conn.close()
                        except Exception:
                            pass

                # Convert each row to a dict; cast non-serialisable types to str
                pg_rows = [
                    dict(zip(cols, [str(v) if v is not None else None for v in r]))
                    for r in src_rows
                ]

                log.info(
                    "postgresql extract: fetched %d row(s) from %s:%s/%s",
                    len(pg_rows), src_host, src_port, src_db,
                )

                insert_sql = (
                    f"INSERT INTO {schema}.raw_postgresql "
                    "(pipeline_id, source_table, payload) "
                    "VALUES (%s, %s, %s::jsonb)"
                )
                cur.executemany(
                    insert_sql,
                    [(pipeline_id, source_label, json.dumps(r)) for r in pg_rows],
                )
                row_count = len(pg_rows)

            elif source_type == "csv":
                upload_path = f"/tmp/uploads/{user_id}_{pipeline_id}.csv"
                if not os.path.exists(upload_path):
                    raise FileNotFoundError(
                        "No CSV file uploaded for this pipeline. "
                        "Please upload a file before triggering a run."
                    )

                # Ensure the bronze table exists with the canonical schema
                cur.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS {schema}.raw_csv (
                        id          SERIAL PRIMARY KEY,
                        pipeline_id INTEGER,
                        payload     JSONB,
                        ingested_at TIMESTAMP DEFAULT NOW()
                    )
                    """
                )
                conn.commit()

                with open(upload_path, newline="", encoding="utf-8-sig") as fh:
                    reader = csv.DictReader(fh)
                    csv_rows = list(reader)

                if not csv_rows:
                    raise ValueError("CSV file contains no data rows.")

                # Validate at least one column is present
                if not reader.fieldnames:
                    raise ValueError("CSV file has no columns.")

                log.info(
                    "csv extract: pipeline_id=%d user_id=%d path=%s rows=%d cols=%d",
                    pipeline_id, user_id, upload_path, len(csv_rows), len(reader.fieldnames),
                )

                insert_sql = (
                    f"INSERT INTO {schema}.raw_csv (pipeline_id, payload) "
                    "VALUES (%s, %s::jsonb)"
                )
                cur.executemany(
                    insert_sql,
                    [(pipeline_id, json.dumps(dict(r))) for r in csv_rows],
                )
                row_count = len(csv_rows)

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
