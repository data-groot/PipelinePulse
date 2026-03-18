from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import pipelines, metrics, quality, websocket
from app.auth import router as auth_router

app = FastAPI(title="PipelinePulse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(pipelines.router)
app.include_router(metrics.router)
app.include_router(quality.router)
app.include_router(websocket.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "db": "connected"}
