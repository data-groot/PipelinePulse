import pytest

pytestmark = pytest.mark.asyncio


async def test_signup_login_me_logout(client):
    resp = await client.post(
        "/auth/signup", json={"email": "user@example.com", "password": "password123"}
    )
    assert resp.status_code == 201
    assert resp.json()["email"] == "user@example.com"

    resp = await client.get("/auth/me")
    assert resp.status_code == 200

    resp = await client.post("/auth/logout")
    assert resp.status_code == 204

    resp = await client.get("/auth/me")
    assert resp.status_code == 401

    resp = await client.post(
        "/auth/login", json={"email": "user@example.com", "password": "password123"}
    )
    assert resp.status_code == 200
    resp = await client.get("/auth/me")
    assert resp.status_code == 200


async def test_duplicate_signup_rejected(client):
    body = {"email": "dupe@example.com", "password": "password123"}
    assert (await client.post("/auth/signup", json=body)).status_code == 201
    assert (await client.post("/auth/signup", json=body)).status_code == 409


async def test_wrong_password_rejected(client):
    await client.post("/auth/signup", json={"email": "a@example.com", "password": "password123"})
    resp = await client.post("/auth/login", json={"email": "a@example.com", "password": "wrongpass1"})
    assert resp.status_code == 401


async def test_short_password_rejected(client):
    resp = await client.post("/auth/signup", json={"email": "b@example.com", "password": "short"})
    assert resp.status_code == 422


async def test_protected_routes_require_auth(client):
    for path in ["/api/pipelines", "/api/runs", "/api/quality/scores", "/api/metrics/overview"]:
        assert (await client.get(path)).status_code == 401, path
