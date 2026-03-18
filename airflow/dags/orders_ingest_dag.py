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
    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/pipelinepulse")
    db_url = db_url.replace("+asyncpg", "")
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
    dag_id = context['dag'].dag_id
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
    
    checks = [
        ("null_check_order_user_id", pass_a, f"Found {null_count} null rows" if not pass_a else None),
        ("amount_positive_check", pass_b, f"Found {amt_count} rows with amount <= 0" if not pass_b else None),
        ("status_allowed_check", pass_c, f"Found {stat_count} rows with invalid status" if not pass_c else None),
        ("min_row_count_check", pass_d, f"Found {total_count} rows, expected >= 400" if not pass_d else None)
    ]
    
    insert_sql = """
    INSERT INTO meta.quality_runs (run_id, table_name, test_name, passed, error_message, checked_at)
    VALUES (%s, %s, %s, %s, %s, NOW())
    """
    for test_name, passed, error_msg in checks:
        cur.execute(insert_sql, (run_id, 'stg_orders', test_name, passed, error_msg))
        
    conn.commit()
    cur.close()
    conn.close()

def update_pipeline_run(**context):
    conn = get_db_connection()
    cur = conn.cursor()
    dag_id = context['dag'].dag_id
    run_id = context['run_id']
    rows_processed = context['ti'].xcom_pull(task_ids='generate_orders', key='rows_processed') or 0
    
    cur.execute("""
    INSERT INTO meta.pipeline_runs (run_id, dag_id, status, finished_at, rows_processed)
    VALUES (%s, %s, 'success', NOW(), %s)
    ON CONFLICT (run_id) 
    DO UPDATE SET status = 'success', finished_at = NOW(), rows_processed = %s
    """, (run_id, dag_id, rows_processed, rows_processed))
    
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
        bash_command="cd /opt/airflow/dbt && dbt run --select staging.stg_orders staging.stg_users marts.kpi_revenue_daily"
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
