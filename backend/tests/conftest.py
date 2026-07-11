import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["FERNET_KEY"] = "6M9kRD2GAsMLfiCwZSbdKS1YY6GfyLTN31LhBzWEnCc="  # test-only key
os.environ["JWT_SECRET"] = "test-secret"
os.environ["SCHEDULER_SECRET"] = "test-scheduler-secret"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import Base, engine
from app.main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient):
    """Client with a signed-up user; cookie is carried automatically."""
    resp = await client.post(
        "/auth/signup", json={"email": "test@example.com", "password": "password123"}
    )
    assert resp.status_code == 201, resp.text
    return client
