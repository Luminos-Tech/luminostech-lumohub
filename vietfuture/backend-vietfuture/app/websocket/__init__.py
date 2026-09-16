from fastapi import APIRouter
from app.websocket.manager import manager
from app.websocket.tts_stream import router as ws_router

api_router = APIRouter()  # no prefix here; prefix set in main
api_router.include_router(ws_router)

__all__ = ["manager", "api_router"]
