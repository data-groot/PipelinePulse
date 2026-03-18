import os
import httpx
from pydantic import BaseModel
from typing import List, Optional, Any

class AirflowTriggerResponse(BaseModel):
    conf: dict
    dag_id: str
    dag_run_id: str
    logical_date: str
    state: str

class AirflowClient:
    def __init__(self):
        self.base_url = os.getenv("AIRFLOW_URL", "http://localhost:8080/api/v1")
        self.username = os.getenv("AIRFLOW_USERNAME", "airflow")
        self.password = os.getenv("AIRFLOW_PASSWORD", "airflow")
        
    def _auth(self):
        return httpx.BasicAuth(self.username, self.password)

    async def trigger_dag(self, dag_id: str) -> AirflowTriggerResponse:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/dags/{dag_id}/dagRuns",
                auth=self._auth(),
                json={"conf": {}}
            )
            response.raise_for_status()
            return AirflowTriggerResponse(**response.json())

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
