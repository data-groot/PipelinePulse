#!/usr/bin/env python3
"""Run migration upgrade() directly without alembic scaffolding to expose errors."""
import os, sys

db_url = os.environ.get("DATABASE_URL", "NOT SET")
print(f"DATABASE_URL = {db_url}", flush=True)

# Manually invoke just the upgrade function with a real connection
import psycopg2

dsn = db_url
for prefix in ("postgresql+asyncpg://", "postgresql+psycopg2://"):
    if dsn.startswith(prefix):
        dsn = "postgresql://" + dsn[len(prefix):]
        break

print(f"Connecting: {dsn}", flush=True)

sql_path = "/app/alembic/versions/001_initial_schema.sql"
with open(sql_path) as f:
    sql = f.read()
print(f"SQL length: {len(sql)}", flush=True)

try:
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    with conn.cursor() as cur:
        print("Executing SQL...", flush=True)
        cur.execute(sql)
        print("SQL executed OK", flush=True)
    conn.close()
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}", flush=True)
    sys.exit(1)

# Verify
conn2 = psycopg2.connect(dsn)
with conn2.cursor() as cur:
    cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('bronze','silver','gold','meta') ORDER BY 1;")
    schemas = cur.fetchall()
    print(f"Schemas: {schemas}", flush=True)
    cur.execute("SELECT count(*) FROM pg_tables WHERE schemaname IN ('bronze','silver','gold','meta');")
    print(f"Total tables: {cur.fetchone()[0]}", flush=True)
conn2.close()
print("DONE", flush=True)
