import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import decode_token
from app.crud.user import get_user_by_id
from app.db.session import SessionLocal
from app.websocket.manager import manager
from app.websocket.notification_manager import (
    NOTIFICATION_EVENT_VERSION,
    notification_manager,
)

router = APIRouter()


@router.websocket("/ws/notifications")
async def notification_websocket(websocket: WebSocket):
    await websocket.accept()
    user_id: int | None = None

    try:
        auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        token = auth_message.get("token") if auth_message.get("type") == "auth" else None
        payload = decode_token(token) if token else None
        if not payload or payload.get("type") != "access" or not payload.get("sub"):
            await websocket.send_json({
                "type": "error",
                "version": NOTIFICATION_EVENT_VERSION,
                "code": "unauthorized",
            })
            await websocket.close(code=1008)
            return

        user_id = int(payload["sub"])
        with SessionLocal() as db:
            user = get_user_by_id(db, user_id)
            is_active = bool(user and user.is_active)
        if not is_active:
            await websocket.close(code=1008)
            return

        notification_manager.connect(user_id, websocket)
        await websocket.send_json({
            "type": "ready",
            "version": NOTIFICATION_EVENT_VERSION,
        })

        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "version": NOTIFICATION_EVENT_VERSION,
                })
    except (WebSocketDisconnect, asyncio.TimeoutError, ValueError, TypeError):
        pass
    finally:
        if user_id is not None:
            notification_manager.disconnect(user_id, websocket)


@router.websocket("/ws/lumo")
async def lumo_websocket(
    websocket: WebSocket,
    device_id: str = Query(...),
):
    await websocket.accept()
    print(f"🔌 LUMO connected: device_id={device_id}")

    await manager.connect(device_id, websocket)
    try:
        while True:
            incoming = await websocket.receive()
            if incoming["type"] != "websocket.receive":
                break
            if "text" in incoming:
                data = incoming["text"]
                if data == "ping":
                    await websocket.send_text("pong")
                else:
                    await websocket.send_text("ok")
            elif "bytes" in incoming:
                # Client có thể gửi binary (relay cũ / firmware); ack để giữ kết nối
                await websocket.send_text("ok")
    except WebSocketDisconnect:
        manager.disconnect(device_id)
    except Exception as e:
        print(f"[WS] Error with LUMO device '{device_id}': {e}")
        manager.disconnect(device_id)
        try:
            await websocket.close()
        except Exception:
            pass
