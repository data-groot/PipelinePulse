import os
import json
import logging
import asyncio
import httpx
from datetime import datetime, timedelta
import psycopg2

from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator

def get_db_connection():
    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/pipelinepulse")
    db_url = db_url.replace("+asyncpg", "")
    return psycopg2.connect(db_url)

async def async_fetch_commits(repo, token, since_iso):
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
        
    url = f"https://api.github.com/repos/{repo}/commits"
    params = {"per_page": 100, "since": since_iso}
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, params=params)
        resp.raise_for_status()
        return resp.json()

def fetch_commits(**context):
    token = Variable.get("GITHUB_TOKEN", default_var=None)
    repo = Variable.get("GITHUB_REPO", default_var="apache/airflow")
    
    yesterday_iso = (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z"
    
    commits = asyncio.run(async_fetch_commits(repo, token, yesterday_iso))
    
    conn = get_db_connection()
    cur = conn.cursor()
    for commit in commits:
        cur.execute(
            "INSERT INTO bronze.raw_commits (repo, payload, ingested_at) VALUES (%s, %s, NOW())",
            (repo, json.dumps(commit))
        )
    conn.commit()
    cur.close()
    conn.close()
    
    context['ti'].xcom_push(key='commits_processed', value=len(commits))

async def async_fetch_prs(repo, token):
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
        
    url = f"https://api.github.com/repos/{repo}/pulls"
    params = {"state": "closed", "sort": "updated", "per_page": 50}
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, params=params)
        resp.raise_for_status()
        return resp.json()

def fetch_prs(**context):
    token = Variable.get("GITHUB_TOKEN", default_var=None)
    repo = Variable.get("GITHUB_REPO", default_var="apache/airflow") 
    
    prs = asyncio.run(async_fetch_prs(repo, token))
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    for pr in prs:
        try:
            created_at = datetime.strptime(pr['created_at'], "%Y-%m-%dT%H:%M:%SZ")
            merged_at = pr.get('merged_at')
            if merged_at:
                merged_at = datetime.strptime(merged_at, "%Y-%m-%dT%H:%M:%SZ")
                cycle_time_hrs = (merged_at - created_at).total_seconds() / 3600.0
                pr['cycle_time_hrs'] = cycle_time_hrs
        except Exception:
            pass
            
        cur.execute(
            "INSERT INTO bronze.raw_prs (repo, payload, ingested_at) VALUES (%s, %s, NOW())",
            (repo, json.dumps(pr))
        )
    conn.commit()
    cur.close()
    conn.close()
    
    context['ti'].xcom_push(key='prs_processed', value=len(prs))
    
def run_quality_checks(**context):
    conn = get_db_connection()
    cur = conn.cursor()
    run_id = context['run_id']
    
    cur.execute("""
    SELECT COUNT(*) FROM (
        SELECT sha, COUNT(*) FROM silver.stg_commits GROUP BY sha HAVING COUNT(*) > 1
    ) dupes
    """)
    dupe_sha_fails = cur.fetchone()[0]
    pass_a = (dupe_sha_fails == 0)
    
    cur.execute("SELECT COUNT(*) FROM silver.stg_commits WHERE author IS NULL")
    null_author_fails = cur.fetchone()[0]
    pass_b = (null_author_fails == 0)
    
    cur.execute("SELECT COUNT(*) FROM silver.stg_commits WHERE committed_at IS NULL")
    null_date_fails = cur.fetchone()[0]
    pass_c = (null_date_fails == 0)
    
    cur.execute("SELECT COUNT(*) FROM silver.stg_commits WHERE committed_at >= NOW() - INTERVAL '30 days'")
    fresh_count = cur.fetchone()[0]
    pass_d = (fresh_count > 0)
    
    checks = [
        ("sha_uniqueness", pass_a, f"Found {dupe_sha_fails} duplicated shas"),
        ("author_not_null", pass_b, f"Found {null_author_fails} null authors"),
        ("committed_at_not_null", pass_c, f"Found {null_date_fails} null commit dates"),
        ("freshness_30_days", pass_d, "No commits in the last 30 days")
    ]
    
    insert_sql = """
    INSERT INTO meta.quality_runs (run_id, table_name, test_name, passed, error_message, checked_at)
    VALUES (%s, 'silver.stg_commits', %s, %s, %s, NOW())
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
    c_processed = context['ti'].xcom_pull(task_ids='fetch_commits', key='commits_processed') or 0
    p_processed = context['ti'].xcom_pull(task_ids='fetch_prs', key='prs_processed') or 0
    total = c_processed + p_processed
    
    cur.execute("""
    INSERT INTO meta.pipeline_runs (run_id, dag_id, status, finished_at, rows_processed)
    VALUES (%s, %s, 'success', NOW(), %s)
    ON CONFLICT (run_id) 
    DO UPDATE SET status = 'success', finished_at = NOW(), rows_processed = %s
    """, (run_id, dag_id, total, total))
    
    conn.commit()
    cur.close()
    conn.close()

with DAG("github_ingest_dag", schedule_interval="@daily", start_date=datetime(2024, 1, 1), catchup=False) as dag:
    
    task_commits = PythonOperator(
        task_id="fetch_commits",
        python_callable=fetch_commits,
        provide_context=True
    )
    
    task_prs = PythonOperator(
        task_id="fetch_prs",
        python_callable=fetch_prs,
        provide_context=True
    )
    
    task_run_dbt = BashOperator(
        task_id="run_dbt_transform",
        bash_command="cd /opt/airflow/dbt && dbt run --select staging.stg_commits staging.stg_prs marts.kpi_dev_velocity"
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
    
    [task_commits, task_prs] >> task_run_dbt >> task_quality >> task_update_run
