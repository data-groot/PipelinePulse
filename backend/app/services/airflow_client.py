import asyncio
import logging
import os
import httpx
from pydantic import BaseModel
from typing import List, Optional, Any

logger = logging.getLogger(__name__)


class AirflowTriggerResponse(BaseModel):
    conf: dict
    dag_id: str
    dag_run_id: str
    logical_date: str
    state: str


class AirflowClient:
    def __init__(self):
        self.base_url = os.getenv("AIRFLOW_URL", "http://airflow-webserver:8080/api/v1")
        self.username = os.getenv("AIRFLOW_USERNAME", "admin")
        self.password = os.getenv("AIRFLOW_PASSWORD", "admin")

    def _auth(self):
        return httpx.BasicAuth(self.username, self.password)

    async def trigger_dag(self, dag_id: str, *, retries: int = 2, retry_delay: float = 5.0) -> AirflowTriggerResponse:
        """Trigger an Airflow DAG run.

        Retries up to `retries` times on 404 to handle the window between
        pipeline creation and the dag_factory scanning the new DAG file.
        """
        url = f"{self.base_url}/dags/{dag_id}/dagRuns"
        last_exc: Exception | None = None

        for attempt in range(retries + 1):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    response = await client.post(url, auth=self._auth(), json={"conf": {}})

                if response.status_code == 404 and attempt < retries:
                    logger.warning(
                        "DAG %s not found in Airflow (attempt %d/%d); "
                        "waiting %.0fs for dag_factory to scan…",
                        dag_id, attempt + 1, retries + 1, retry_delay,
                    )
                    await asyncio.sleep(retry_delay)
                    continue

                response.raise_for_status()
                return AirflowTriggerResponse(**response.json())

            except httpx.HTTPStatusError as exc:
                last_exc = exc
                status_code = exc.response.status_code
                body = exc.response.text[:300]
                logger.error("Airflow trigger failed: HTTP %s — %s", status_code, body)
                # Surface the Airflow error detail upstream instead of a bare 500
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=502,
                    detail=f"Airflow returned HTTP {status_code} for DAG '{dag_id}': {body}",
                ) from exc
            except httpx.RequestError as exc:
                logger.error("Airflow connection error: %s", exc)
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=503,
                    detail=f"Could not reach Airflow at {self.base_url}: {exc}",
                ) from exc

        # Exhausted retries (only reachable on repeated 404s)
        from fastapi import HTTPException
        raise HTTPException(
            status_code=404,
            detail=f"DAG '{dag_id}' was not found in Airflow after {retries + 1} attempts. "
                   "The dag_factory may not have scanned the new pipeline yet — wait a moment and retry.",
        )

    async def get_dag_runs(self, dag_id: str, limit: int = 10):
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/dags/{dag_id}/dagRuns?limit={limit}",
                auth=self._auth()
            )
            response.raise_for_status()
            return response.json()

    async def get_dag(self, dag_id: str):
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/dags/{dag_id}",
                auth=self._auth()
            )
            response.raise_for_status()
            return response.json()

    async def pause_dag(self, dag_id: str):
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.base_url}/dags/{dag_id}",
                auth=self._auth(),
                json={"is_paused": True}
            )
            response.raise_for_status()
            return response.json()

    async def unpause_dag(self, dag_id: str):
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.base_url}/dags/{dag_id}",
                auth=self._auth(),
                json={"is_paused": False}
            )
            response.raise_for_status()
            return response.json()
