"""End-to-end engine test: create pipeline -> trigger -> bronze/silver/gold + quality."""

import pytest
import respx
from httpx import Response

pytestmark = pytest.mark.asyncio

FAKE_ORDERS = {
    "carts": [
        {"id": 1, "total": 100.0, "date": "2026-07-01T10:00:00Z"},
        {"id": 2, "total": 50.0, "date": "2026-07-01T12:00:00Z"},
        {"id": 3, "total": 200.0, "date": "2026-07-02T09:00:00Z"},
        {"id": 3, "total": 200.0, "date": "2026-07-02T09:00:00Z"},  # duplicate
    ]
}


async def _create_rest_pipeline(auth_client, **overrides):
    body = {
        "name": "Orders",
        "source_type": "rest_api",
        "schedule": "daily",
        "connection_config": {"url": "https://fake-api.test/orders"},
        "timestamp_field": "date",
        "metric_field": "total",
    }
    body.update(overrides)
    resp = await auth_client.post("/api/pipelines", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


@respx.mock
async def test_full_run_produces_medallion_and_quality(auth_client):
    respx.get("https://fake-api.test/orders").mock(return_value=Response(200, json=FAKE_ORDERS))

    pipeline = await _create_rest_pipeline(auth_client)
    resp = await auth_client.post(f"/api/pipelines/{pipeline['id']}/trigger")
    assert resp.status_code == 200, resp.text
    run = resp.json()
    assert run["status"] == "success", run["error_message"]
    assert run["rows_processed"] == 3  # 4 bronze rows, 1 duplicate dropped

    # Bronze preview
    preview = (await auth_client.get(f"/api/pipelines/{pipeline['id']}/preview")).json()
    assert len(preview["rows"]) == 4

    # Gold: two days aggregated from the timestamp field
    daily = (await auth_client.get(f"/api/metrics/daily?pipeline_id={pipeline['id']}")).json()
    assert len(daily) == 2
    by_day = {d["day"]: d for d in daily}
    assert by_day["2026-07-01"]["row_count"] == 2
    assert by_day["2026-07-01"]["metric_sum"] == 150.0
    assert by_day["2026-07-02"]["metric_avg"] == 200.0

    # Quality: 4 checks recorded, row_count and null checks pass
    scores = (await auth_client.get("/api/quality/scores")).json()
    by_check = {s["check_name"]: s for s in scores}
    assert len(by_check) == 4
    assert by_check["row_count_nonzero"]["passed"] is True
    assert by_check["no_null_payloads"]["passed"] is True

    # Run feed
    runs = (await auth_client.get("/api/runs")).json()
    assert len(runs) == 1
    assert runs[0]["pipeline_name"] == "Orders"

    # Overview KPIs
    overview = (await auth_client.get("/api/metrics/overview")).json()
    assert overview["total_pipelines"] == 1
    assert overview["healthy_pipelines"] == 1


@respx.mock
async def test_failed_extract_records_failed_run(auth_client):
    respx.get("https://fake-api.test/orders").mock(return_value=Response(500))

    pipeline = await _create_rest_pipeline(auth_client)
    run = (await auth_client.post(f"/api/pipelines/{pipeline['id']}/trigger")).json()
    assert run["status"] == "failed"
    assert run["error_message"]

    overview = (await auth_client.get("/api/metrics/overview")).json()
    assert overview["healthy_pipelines"] == 0


async def test_csv_upload_and_run(auth_client):
    pipeline = await _create_rest_pipeline(
        auth_client, name="CSV Pipe", source_type="csv", connection_config={},
        timestamp_field=None, metric_field="amount",
    )
    csv_content = b"order_id,amount\n1,10.5\n2,20.0\n"
    resp = await auth_client.post(
        f"/api/pipelines/{pipeline['id']}/upload",
        files={"file": ("orders.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 201
    assert resp.json()["rows_ingested"] == 2

    run = (await auth_client.post(f"/api/pipelines/{pipeline['id']}/trigger")).json()
    assert run["status"] == "success"
    assert run["rows_processed"] == 2

    daily = (await auth_client.get(f"/api/metrics/daily?pipeline_id={pipeline['id']}")).json()
    assert len(daily) == 1
    assert daily[0]["metric_sum"] == 30.5


@respx.mock
async def test_scheduler_tick_runs_due_pipelines(auth_client):
    respx.get("https://fake-api.test/orders").mock(return_value=Response(200, json=FAKE_ORDERS))
    pipeline = await _create_rest_pipeline(auth_client, schedule="5min")

    # Force the pipeline to be due
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import update

    from app.core.database import async_session
    from app.models import Pipeline

    async with async_session() as db:
        await db.execute(
            update(Pipeline)
            .where(Pipeline.id == pipeline["id"])
            .values(next_run_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        )
        await db.commit()

    # Wrong secret rejected
    resp = await auth_client.post(
        "/internal/scheduler/tick", headers={"X-Scheduler-Secret": "wrong"}
    )
    assert resp.status_code == 403

    resp = await auth_client.post(
        "/internal/scheduler/tick", headers={"X-Scheduler-Secret": "test-scheduler-secret"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["due"] == 1
    assert body["runs"][0]["status"] == "success"

    runs = (await auth_client.get("/api/runs")).json()
    assert runs[0]["trigger"] == "scheduled"


@respx.mock
async def test_tenant_isolation(client):
    respx.get("https://fake-api.test/orders").mock(return_value=Response(200, json=FAKE_ORDERS))

    await client.post("/auth/signup", json={"email": "alice@example.com", "password": "password123"})
    pipeline = await _create_rest_pipeline(client)
    await client.post(f"/api/pipelines/{pipeline['id']}/trigger")

    # Switch to a second user (new signup overwrites the cookie)
    await client.post("/auth/signup", json={"email": "bob@example.com", "password": "password123"})
    assert (await client.get("/api/pipelines")).json() == []
    assert (await client.get("/api/runs")).json() == []
    assert (await client.get("/api/quality/scores")).json() == []
    assert (await client.get(f"/api/pipelines/{pipeline['id']}/preview")).status_code == 404
    assert (await client.post(f"/api/pipelines/{pipeline['id']}/trigger")).status_code == 404
