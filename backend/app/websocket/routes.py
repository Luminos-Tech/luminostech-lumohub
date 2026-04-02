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
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(device_id)
