import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import decode_token
from app.crud.user import get_user_by_id
from app.crud.device import get_device_by_code, normalize_device_code
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
    device_id = normalize_device_code(device_id)
    try:
        # Only a firmware handshake registers a device. Opening a browser socket
        # must never mark the real hardware online or replace its connection.
        hello = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if (
            not isinstance(hello, dict)
            or hello.get("type") != "hello"
            or hello.get("device_id") != device_id
            or not isinstance(hello.get("capabilities"), list)
        ):
            await websocket.close(code=1008)
            return
        with SessionLocal() as db:
            device = get_device_by_code(db, user_id=None, device_code=device_id)
            active = bool(device and device.is_active)
        if not active:
            await websocket.close(code=1008)
            return
        await manager.connect(device_id, websocket, {
            "capabilities": [item for item in hello["capabilities"] if isinstance(item, str)],
            "firmware_version": str(hello.get("firmware_version", ""))[:64],
        })
        await websocket.send_json({"type": "ready", "device_id": device_id})
        while True:
            incoming = await asyncio.wait_for(websocket.receive(), timeout=75)
            if incoming["type"] != "websocket.receive":
                break
            if "text" in incoming:
                data = incoming["text"]
                if len(data) > 16384:
                    await websocket.close(code=1009)
                    break
                if data == "ping":
                    await websocket.send_text("pong")
                else:
                    try:
                        message = json.loads(data)
                    except (json.JSONDecodeError, TypeError):
                        continue
                    if isinstance(message, dict) and message.get("type") == "command_result":
                        manager.acknowledge(device_id, websocket, message)
                    elif isinstance(message, dict) and message.get("type") == "device_logs":
                        manager.receive_logs(device_id, websocket, message.get("entries"))
            elif "bytes" in incoming:
                # Client có thể gửi binary (relay cũ / firmware); ack để giữ kết nối
                await websocket.send_text("ok")
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception as e:
        print(f"[WS] Error with LUMO device '{device_id}': {e}")
        try:
            await websocket.close()
        except Exception:
            pass
    finally:
        manager.disconnect(device_id, websocket)
        try:
            await websocket.close()
        except RuntimeError:
            pass
