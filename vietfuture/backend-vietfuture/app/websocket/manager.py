from fastapi import WebSocket
from typing import Dict
import asyncio
import json
from uuid import uuid4
from app.websocket.device_logs import DeviceLogBuffer
from app.core.config import settings


class LumoConnectionManager:
    def __init__(self):
        # device_id (str) -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        self.device_info: dict[str, dict] = {}
        self.pending_commands: dict[str, tuple[str, WebSocket, asyncio.Future]] = {}
        self.logs = DeviceLogBuffer(enabled=lambda: settings.DEVICE_LOGS_ENABLED)

    async def connect(self, device_id: str, websocket: WebSocket, info: dict | None = None):
        # Không gọi accept() ở đây — route /ws/lumo đã accept 1 lần rồi.
        # Gọi accept() 2 lần sẽ làm lỗi và đóng kết nối bất thường.
        previous = self.active_connections.get(device_id)
        if previous is not None and previous is not websocket:
            self.disconnect(device_id, previous)
            try:
                await previous.close(code=1012)
            except (RuntimeError, OSError):
                pass
        self.active_connections[device_id] = websocket
        self.device_info[device_id] = info or {}
        self.logs.append(device_id, "I", "SERVER", "Hub connected and registration accepted")
        print(f"🔌 LUMO connected: device_id={device_id}")

    def disconnect(self, device_id: str, websocket: WebSocket | None = None):
        current = self.active_connections.get(device_id)
        if current is not None and (websocket is None or current is websocket):
            self.active_connections.pop(device_id, None)
            self.device_info.pop(device_id, None)
            self.logs.append(device_id, "W", "SERVER", "Hub disconnected")
            for command_id, (target, connection, future) in list(self.pending_commands.items()):
                if target == device_id and connection is current and not future.done():
                    future.set_exception(ConnectionError("Device disconnected"))
            print(f"❌ LUMO disconnected: device_id={device_id}")

    def control_status(self, device_id: str) -> dict:
        info = self.device_info.get(device_id, {})
        return {
            "connected": device_id in self.active_connections,
            "audio_control": "audio_control_v1" in info.get("capabilities", []),
            "firmware_version": info.get("firmware_version"),
            "logs_enabled": settings.DEVICE_LOGS_ENABLED,
        }

    def acknowledge(self, device_id: str, websocket: WebSocket, message: dict) -> None:
        command_id = message.get("request_id")
        if not isinstance(command_id, str):
            return
        pending = self.pending_commands.get(command_id)
        if pending is None:
            return
        target, connection, future = pending
        if target == device_id and connection is websocket and not future.done():
            if message.get("status") in {"completed", "stopped", "busy", "error"}:
                status = message["status"]
                self.logs.append(device_id, "E" if status == "error" else "W" if status == "busy" else "I",
                                 "SERVER", f"Device command result: {status}")
                future.set_result(message)

    def receive_logs(self, device_id: str, websocket: WebSocket, entries) -> None:
        if self.active_connections.get(device_id) is websocket:
            self.logs.append_batch(device_id, entries)

    async def execute_command(self, device_id: str, action: str, sound: str | None = None) -> dict:
        websocket = self.active_connections.get(device_id)
        if websocket is None:
            raise ConnectionError("Device is offline")
        command_id = uuid4().hex
        future = asyncio.get_running_loop().create_future()
        self.pending_commands[command_id] = (device_id, websocket, future)
        message = {"type": "command", "request_id": command_id, "action": action}
        if sound is not None:
            message["sound"] = sound
        try:
            self.logs.append(device_id, "I", "SERVER", f"Command sent: {action}" + (f" ({sound})" if sound else ""))
            try:
                await websocket.send_json(message)
            except Exception as exc:
                future.cancel()
                self.disconnect(device_id, websocket)
                raise ConnectionError("Device disconnected") from exc
            return await asyncio.wait_for(future, timeout=20)
        except asyncio.TimeoutError:
            self.logs.append(device_id, "W", "SERVER", "Device did not confirm the command within 20 seconds")
            raise
        finally:
            self.pending_commands.pop(command_id, None)
            if not future.done():
                future.cancel()

    async def send_reminder(self, device_id: str, message: dict):
        ws = self.active_connections.get(device_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
                return True
            except Exception as e:
                print(f"⚠️ Failed to send to device {device_id}: {e}")
                self.disconnect(device_id, ws)
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
                self.disconnect(device_id, ws)
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
                self.disconnect(device_id, ws)
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
