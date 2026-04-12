import os
import uuid
import random
import json
from datetime import datetime
import psycopg2
from faker import Faker

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator

fake = Faker()

def get_db_connection():
    # Derive connection from Airflow's own DB URL (same host/user/password, different database).
    # AIRFLOW__DATABASE__SQL_ALCHEMY_CONN is set in docker-compose with correct ${POSTGRES_PASSWORD}
    # substitution, so it reflects the actual password even if the default "postgres" was overridden.
    airflow_conn = os.environ.get(
        "AIRFLOW__DATABASE__SQL_ALCHEMY_CONN",
        "postgresql+psycopg2://postgres:postgres@postgres:5432/airflow"
    )
    db_url = airflow_conn.replace("+psycopg2", "").rsplit("/", 1)[0] + "/pipelinepulse"
    return psycopg2.connect(db_url)

def generate_orders(**context):
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Generate 200 users
    users = []
    for _ in range(200):
        country = random.choices(["US", "UK", "IN", "DE", "BR"], weights=[40, 20, 20, 10, 10])[0]
        plan = random.choices(["free", "pro", "enterprise"], weights=[60, 30, 10])[0]
        users.append({
            "user_id": str(uuid.uuid4()),
            "country": country,
            "plan": plan,
            "created_at": fake.date_time_between(start_date="-7d", end_date="now").isoformat()
        })
    cur.executemany(
        "INSERT INTO bronze.raw_users (payload) VALUES (%s)",
        [(json.dumps(u),) for u in users]
    )

    # Generate 500 orders
    orders = []
    statuses = ["completed", "pending", "returned"]
    weights = [70, 20, 10]
    for _ in range(500):
        user = random.choice(users)
        orders.append({
            "order_id": str(uuid.uuid4()),
            "user_id": user["user_id"],
            "amount": round(random.uniform(10.0, 500.0), 2),
            "status": random.choices(statuses, weights=weights)[0],
            "created_at": fake.date_time_between(start_date="-7d", end_date="now").isoformat()
        })
    cur.executemany(
        "INSERT INTO bronze.raw_orders (payload) VALUES (%s)",
        [(json.dumps(o),) for o in orders]
    )
    
    conn.commit()
    cur.close()
    conn.close()
    
    context['ti'].xcom_push(key='rows_processed', value=len(orders))

def run_quality_checks(**context):
    conn = get_db_connection()
    cur = conn.cursor()
    run_id = context['run_id']

    cur.execute("SELECT COUNT(*) FROM silver.stg_orders WHERE order_id IS NULL OR user_id IS NULL")
    null_count = cur.fetchone()[0]
    pass_a = (null_count == 0)

    cur.execute("SELECT COUNT(*) FROM silver.stg_orders WHERE amount <= 0")
    amt_count = cur.fetchone()[0]
    pass_b = (amt_count == 0)

    cur.execute("SELECT COUNT(*) FROM silver.stg_orders WHERE status NOT IN ('completed', 'pending', 'returned')")
    stat_count = cur.fetchone()[0]
    pass_c = (stat_count == 0)

    cur.execute("SELECT COUNT(*) FROM silver.stg_orders")
    total_count = cur.fetchone()[0]
    pass_d = (total_count >= 400)

    # Column names match the alembic 001_initial_schema.sql definition:
    #   table_name, check_name, passed, score, details (JSONB), run_at
    # run_id is stored in details so it is queryable without a schema change.
    insert_sql = """
    INSERT INTO meta.quality_runs (table_name, check_name, passed, score, details, run_at)
    VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
    """
    checks = [
        ("null_check_order_user_id", pass_a, null_count),
        ("amount_positive_check",    pass_b, amt_count),
        ("status_allowed_check",     pass_c, stat_count),
        ("min_row_count_check",      pass_d, total_count),
    ]
    for check_name, passed, detail_value in checks:
        details = json.dumps({"run_id": run_id, "count": detail_value})
        score = 1.0 if passed else 0.0
        cur.execute(insert_sql, ('stg_orders', check_name, passed, score, details))

    conn.commit()
    cur.close()
    conn.close()

def update_pipeline_run(**context):
    conn = get_db_connection()
    cur = conn.cursor()
    dag_id = context['dag'].dag_id
    run_id = context['run_id']
    rows_processed = context['ti'].xcom_pull(task_ids='generate_orders', key='rows_processed') or 0
    started_at = context['dag_run'].start_date

    cur.execute("""
    INSERT INTO meta.pipeline_runs (run_id, dag_id, status, started_at, finished_at, rows_processed)
    VALUES (%s, %s, 'success', %s, NOW(), %s)
    ON CONFLICT (run_id)
    DO UPDATE SET status = 'success', started_at = EXCLUDED.started_at, finished_at = NOW(), rows_processed = %s
    """, (run_id, dag_id, started_at, rows_processed, rows_processed))
    
    conn.commit()
    cur.close()
    conn.close()

with DAG(
    dag_id="orders_ingest_dag",
    schedule_interval="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False
) as dag:
    
    task_generate_orders = PythonOperator(
        task_id="generate_orders",
        python_callable=generate_orders,
        provide_context=True
    )
    
    task_run_dbt = BashOperator(
        task_id="run_dbt_transform",
        # Run the two existing staging models.  The generate_schema_name macro in
        # dbt/macros/ ensures models land in the declared schema (silver), not
        # the prefixed form (public_silver) that dbt uses by default.
        bash_command="mkdir -p ${DBT_LOG_PATH:-/tmp/dbt_logs} ${DBT_TARGET_PATH:-/tmp/dbt_target} && cd /opt/airflow/dbt && dbt run --profiles-dir . --log-path ${DBT_LOG_PATH:-/tmp/dbt_logs} --target-path ${DBT_TARGET_PATH:-/tmp/dbt_target} --select stg_orders stg_users kpi_revenue_daily"
    )
    
    task_quality = PythonOperator(
        task_id="run_quality_checks",
        python_callable=run_quality_checks,
        provide_context=True
    )
    
    task_update_run = PythonOperator(
        task_id="update_pipeline_run",
        python_callable=update_pipeline_run,
        provide_context=True
    )
    
    task_generate_orders >> task_run_dbt >> task_quality >> task_update_run
