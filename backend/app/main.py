from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import pipelines, metrics, quality, websocket
from app.routers import runs
from app.routers.auth import router as auth_router
from app.websocket.router import router as ws_router
from app.core.database import get_db
from app.services.seed import seed_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed database
    async for db in get_db():
        await seed_database(db)
        break
    yield
    # Shutdown: cleanup if needed
    pass

app = FastAPI(title="PipelinePulse API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(pipelines.router)
app.include_router(metrics.router)
app.include_router(quality.router)
app.include_router(websocket.router)
app.include_router(runs.router)
app.include_router(ws_router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "db": "connected"}
