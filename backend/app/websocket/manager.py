from fastapi import WebSocket
from typing import Dict
import json


class LumoConnectionManager:
    def __init__(self):
        # user_id -> WebSocket
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(f"🔌 LUMO connected for user {user_id}")

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            print(f"❌ LUMO disconnected for user {user_id}")

    async def send_reminder(self, user_id: int, message: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
                return True
            except Exception as e:
                print(f"⚠️ Failed to send to user {user_id}: {e}")
                self.disconnect(user_id)
        return False

    async def broadcast(self, message: dict):
        disconnected = []
        for user_id, ws in self.active_connections.items():
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                disconnected.append(user_id)
        for uid in disconnected:
            self.disconnect(uid)


manager = LumoConnectionManager()
