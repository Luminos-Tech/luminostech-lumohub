from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from app.websocket.manager import manager
from app.core.security import decode_token

router = APIRouter()


@router.websocket("/ws/lumo/{user_id}")
async def lumo_websocket(
    websocket: WebSocket,
    user_id: int,
    token: str = Query(...),
):
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001)
        return
    if str(user_id) != str(payload.get("sub")):
        await websocket.close(code=4003)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo ping/pong for keepalive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id)
