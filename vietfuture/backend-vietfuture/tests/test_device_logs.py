import unittest
from unittest.mock import MagicMock

from app.websocket.device_logs import DeviceLogBuffer
from app.websocket.manager import LumoConnectionManager


class DeviceLogBufferTests(unittest.TestCase):
    def test_optional_disable_switch_clears_existing_logs_and_stops_collection(self):
        enabled = [True]
        logs = DeviceLogBuffer(enabled=lambda: enabled[0])
        logs.append("0001", "I", "HUB", "Before")
        enabled[0] = False
        logs.append("0001", "I", "HUB", "Hidden")
        self.assertFalse(logs.buffers)
        self.assertEqual(logs.read("0001")["entries"], [])
        enabled[0] = True
        logs.append("0001", "I", "HUB", "After")
        self.assertEqual([entry["message"] for entry in logs.read("0001")["entries"]], ["After"])

    def test_history_is_bounded_and_cursor_does_not_repeat_entries(self):
        logs = DeviceLogBuffer()
        for index in range(250):
            logs.append("0001", "I", "HUB", f"Event {index}")
        first = logs.read("0001", limit=100)
        second = logs.read("0001", after=first["cursor"], limit=100)
        self.assertEqual(len(first["entries"]) + len(second["entries"]), 200)
        self.assertEqual(first["entries"][0]["message"], "Event 50")
        self.assertEqual(logs.read("0001", second["cursor"])["entries"], [])

    def test_expired_logs_are_removed_from_memory(self):
        now = [100.0]
        logs = DeviceLogBuffer(clock=lambda: now[0])
        logs.append("0001", "W", "WIFI", "Disconnected")
        now[0] += 901
        logs.expire()
        self.assertEqual(logs.read("0001")["entries"], [])
        self.assertNotIn("0001", logs.buffers)

    def test_credentials_and_control_characters_are_not_exposed(self):
        logs = DeviceLogBuffer()
        for text in ("Password=private-value", "Authorization: Bearer private-value", "API_KEY=private-value"):
            logs.append("0001", "I", "HTTP", text)
        logs.append("0001", "I", "HUB", "Line\nwithout\x00controls")
        data = logs.read("0001")["entries"]
        self.assertTrue(all("private-value" not in entry["message"] for entry in data))
        self.assertEqual(data[-1]["message"], "Line without controls")

    def test_rate_limit_and_invalid_messages_do_not_grow_buffer(self):
        logs = DeviceLogBuffer(clock=lambda: 10.0)
        entry = {"level": "I", "tag": "HUB", "message": "Heartbeat", "uptime_ms": 1000}
        for _ in range(5):
            logs.append_batch("0001", [entry] * 8)
        self.assertEqual(len(logs.read("0001")["entries"]), 10)
        for invalid in (None, "bad", [{"level": []}], [{"level": "I", "tag": None, "message": 1}]):
            logs.append_batch("0002", invalid)
        self.assertEqual(logs.read("0002")["entries"], [])

    def test_total_number_of_buffered_devices_is_bounded(self):
        logs = DeviceLogBuffer()
        for number in range(100):
            logs.append(f"{number:04}", "I", "HUB", "Connected")
        self.assertEqual(len(logs.buffers), 64)
        self.assertNotIn("0000", logs.buffers)

    def test_stale_connection_cannot_submit_logs_for_current_hub(self):
        manager = LumoConnectionManager()
        current, stale = MagicMock(), MagicMock()
        manager.active_connections["0001"] = current
        manager.receive_logs("0001", stale, [{"level": "I", "tag": "HUB", "message": "Stale"}])
        self.assertEqual(manager.logs.read("0001")["entries"], [])
