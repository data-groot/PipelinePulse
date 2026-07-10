import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.routers import auth, internal, metrics, pipelines, quality, runs

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="PipelinePulse API", version="2.0.0", lifespan=lifespan)

# Local dev only — in production the Next.js rewrite proxy makes requests same-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(pipelines.router)
app.include_router(runs.router)
app.include_router(quality.router)
app.include_router(metrics.router)
app.include_router(internal.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
