from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.routes import api_router
from app.websocket.routes import router as ws_router
from app.websocket import api_router as ws_api_router
from app.tasks.scheduler import start_scheduler, stop_scheduler
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="LumoHub API",
    description="Backend for LumoHub calendar & event management system",
    version="0.9.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)
app.include_router(ws_api_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "LumoHub API"}
