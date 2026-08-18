from collections import defaultdict
from datetime import datetime

from fastapi import WebSocket


NOTIFICATION_EVENT_VERSION = 1


class NotificationConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[int, set[WebSocket]] = defaultdict(set)

    def connect(self, user_id: int, websocket: WebSocket) -> None:
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        connections = self.active_connections.get(user_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(user_id, None)

    async def publish_notification(self, notification) -> int:
        created_at = notification.created_at
        read_at = notification.read_at
        payload = {
            "type": "notification.created",
            "version": NOTIFICATION_EVENT_VERSION,
            "data": {
                "id": notification.id,
                "user_id": notification.user_id,
                "event_id": notification.event_id,
                "title": notification.title,
                "content": notification.content,
                "channel": notification.channel,
                "is_read": notification.is_read,
                "created_at": self._serialize_datetime(created_at),
                "read_at": self._serialize_datetime(read_at),
            },
        }

        delivered = 0
        stale: list[WebSocket] = []
        for websocket in list(self.active_connections.get(notification.user_id, set())):
            try:
                await websocket.send_json(payload)
                delivered += 1
            except Exception:
                stale.append(websocket)

        for websocket in stale:
            self.disconnect(notification.user_id, websocket)
        return delivered

    @staticmethod
    def _serialize_datetime(value) -> str | None:
        return value.isoformat() if isinstance(value, datetime) else None


notification_manager = NotificationConnectionManager()
