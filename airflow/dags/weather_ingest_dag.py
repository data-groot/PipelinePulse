import os
import json
import logging
import httpx
from datetime import datetime
import psycopg2

from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator, ShortCircuitOperator
from airflow.operators.bash import BashOperator

def get_db_connection():
    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/pipelinepulse")
    db_url = db_url.replace("+asyncpg", "")
    return psycopg2.connect(db_url)

def check_api_key(**context):
    api_key = Variable.get("OPENWEATHER_API_KEY", default_var=None)
    if not api_key:
        logging.warning("OPENWEATHER_API_KEY is not set. Skipping the rest of the DAG.")
        return False
    return True

def fetch_weather(**context):
    api_key = Variable.get("OPENWEATHER_API_KEY")
    cities = ["London", "New York", "Tokyo", "Sydney", "Mumbai"]
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    inserted_count = 0
    with httpx.Client() as client:
        for city in cities:
            try:
                url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
                resp = client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    cur.execute(
                        "INSERT INTO bronze.raw_weather (city, payload, ingested_at) VALUES (%s, %s, NOW())",
                        (city, json.dumps(data))
                    )
                    inserted_count += 1
                else:
                    logging.error(f"Failed to fetch {city}: {resp.text}")
            except Exception as e:
                logging.error(f"Exception fetching {city}: {str(e)}")
                
    conn.commit()
    cur.close()
    conn.close()
    
    context['ti'].xcom_push(key='rows_processed', value=inserted_count)

def run_quality_checks(**context):
    conn = get_db_connection()
    cur = conn.cursor()
    run_id = context['run_id']
    
    cur.execute("SELECT COUNT(DISTINCT city) FROM silver.stg_weather")
    city_count = cur.fetchone()[0]
    pass_a = (city_count >= 5)
    
    cur.execute("SELECT COUNT(*) FROM silver.stg_weather WHERE temp_c < -90 OR temp_c > 60")
    temp_fails = cur.fetchone()[0]
    pass_b = (temp_fails == 0)
    
    cur.execute("SELECT COUNT(*) FROM silver.stg_weather WHERE humidity < 0 OR humidity > 100")
    hum_fails = cur.fetchone()[0]
    pass_c = (hum_fails == 0)
    
    cur.execute("SELECT COUNT(*) FROM silver.stg_weather WHERE city IS NULL")
    null_city_fails = cur.fetchone()[0]
    pass_d = (null_city_fails == 0)
    
    checks = [
        ("all_cities_present", pass_a, f"Found {city_count} distinct cities"),
        ("temp_range_check", pass_b, f"Found {temp_fails} rows with invalid temp"),
        ("humidity_range_check", pass_c, f"Found {hum_fails} rows with invalid humidity"),
        ("city_not_null", pass_d, f"Found {null_city_fails} rows with null city")
    ]
    
    insert_sql = """
    INSERT INTO meta.quality_runs (run_id, table_name, test_name, passed, error_message, checked_at)
    VALUES (%s, 'silver.stg_weather', %s, %s, %s, NOW())
    """
    for test_name, passed, error_msg in checks:
        cur.execute(insert_sql, (run_id, test_name, passed, error_msg if not passed else None))
        
    conn.commit()
    cur.close()
    conn.close()

def update_pipeline_run(**context):
    conn = get_db_connection()
    cur = conn.cursor()
    dag_id = context['dag'].dag_id
    run_id = context['run_id']
    rows_processed = context['ti'].xcom_pull(task_ids='fetch_weather', key='rows_processed') or 0
    
    cur.execute("""
    INSERT INTO meta.pipeline_runs (run_id, dag_id, status, finished_at, rows_processed)
    VALUES (%s, %s, 'success', NOW(), %s)
    ON CONFLICT (run_id) 
    DO UPDATE SET status = 'success', finished_at = NOW(), rows_processed = %s
    """, (run_id, dag_id, rows_processed, rows_processed))
    
    conn.commit()
    cur.close()
    conn.close()

with DAG("weather_ingest_dag", schedule_interval="@hourly", start_date=datetime(2024, 1, 1), catchup=False) as dag:
    
    task_check_key = ShortCircuitOperator(
        task_id="check_api_key",
        python_callable=check_api_key
    )
    
    task_fetch = PythonOperator(
        task_id="fetch_weather",
        python_callable=fetch_weather,
        provide_context=True
    )
    
    task_run_dbt = BashOperator(
        task_id="run_dbt_transform",
        bash_command="cd /opt/airflow/dbt && dbt run --select staging.stg_weather marts.kpi_weather_daily"
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
    
    task_check_key >> task_fetch >> task_run_dbt >> task_quality >> task_update_run
