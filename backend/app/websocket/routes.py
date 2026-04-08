from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.websocket.manager import manager

router = APIRouter()


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
