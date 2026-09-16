from fastapi import WebSocket
from typing import Dict
import json


class LumoConnectionManager:
    def __init__(self):
        # device_id (str) -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, device_id: str, websocket: WebSocket):
        # Không gọi accept() ở đây — route /ws/lumo đã accept 1 lần rồi.
        # Gọi accept() 2 lần sẽ làm lỗi và đóng kết nối bất thường.
        self.active_connections[device_id] = websocket
        print(f"🔌 LUMO connected: device_id={device_id}")

    def disconnect(self, device_id: str):
        if device_id in self.active_connections:
            del self.active_connections[device_id]
            print(f"❌ LUMO disconnected: device_id={device_id}")

    async def send_reminder(self, device_id: str, message: dict):
        ws = self.active_connections.get(device_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
                return True
            except Exception as e:
                print(f"⚠️ Failed to send to device {device_id}: {e}")
                self.disconnect(device_id)
        return False

    async def send_text(self, device_id: str, text: str) -> bool:
        """Forward raw text đến thiết bị qua WebSocket đang kết nối."""
        ws = self.active_connections.get(device_id)
        if ws:
            try:
                await ws.send_text(text)
                return True
            except Exception as e:
                print(f"⚠️ Failed to send to device {device_id}: {e}")
                self.disconnect(device_id)
        return False

    async def send_bytes(self, device_id: str, data: bytes) -> bool:
        """Forward PCM (binary) tới thiết bị /ws/lumo."""
        ws = self.active_connections.get(device_id)
        if ws:
            try:
                await ws.send_bytes(data)
                return True
            except Exception as e:
                print(f"⚠️ Failed to send bytes to device {device_id}: {e}")
                self.disconnect(device_id)
        return False

    async def broadcast(self, message: dict):
        disconnected = []
        for device_id, ws in self.active_connections.items():
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                disconnected.append(device_id)
        for did in disconnected:
            self.disconnect(did)


manager = LumoConnectionManager()
