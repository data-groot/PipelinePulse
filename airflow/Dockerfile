FROM apache/airflow:2.9.0-python3.12

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

USER airflow

COPY requirements.txt /opt/airflow/requirements.txt

# Pin protobuf to a range compatible with both Airflow 2.9 (<5.0) and dbt-core 1.8.x (>=4.21.7).
# dbt-core 1.11+ requires protobuf>=6 and cannot coexist with Airflow 2.9 — use dbt-postgres 1.8.2.
RUN pip install --no-cache-dir "protobuf>=4.25,<5.0" && \
    pip install --no-cache-dir -r /opt/airflow/requirements.txt && \
    pip install --no-cache-dir "dbt-postgres==1.8.2"
