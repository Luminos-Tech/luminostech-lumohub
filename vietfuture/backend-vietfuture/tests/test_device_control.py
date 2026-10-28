import asyncio
from threading import Event
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.db.session import get_db
from app.routes import devices
from app.services.deps import get_current_active_user
from app.websocket import routes
from app.websocket.manager import LumoConnectionManager


class DeviceControlTests(unittest.TestCase):
    def setUp(self):
        self.manager = LumoConnectionManager()
        self.user = SimpleNamespace(id=10, role="user")
        self.device = SimpleNamespace(
            id=1, user_id=10, device_id="0001", is_active=True,
            created_at=datetime(2026, 10, 29, tzinfo=timezone.utc),
            updated_at=datetime(2026, 10, 29, tzinfo=timezone.utc),
        )
        self.db = MagicMock()
        self.patches = [
            patch.object(devices, "manager", self.manager),
            patch.object(routes, "manager", self.manager),
            patch.object(devices, "get_device_by_id", return_value=self.device),
            patch.object(devices, "get_device_by_code", return_value=self.device),
            patch.object(devices, "get_device_log_targets", return_value=[{"id": 1, "device_id": "0001"}]),
            patch.object(routes, "get_device_by_code", return_value=self.device),
            patch.object(routes, "SessionLocal", return_value=MagicMock()),
            patch.object(devices, "log_action"),
        ]
        for item in self.patches:
            item.start()
        app = FastAPI()
        app.include_router(devices.router, prefix="/api/v1")
        app.include_router(routes.router)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_active_user] = lambda: self.user
        self.app = app
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        for item in reversed(self.patches):
            item.stop()

    def hello(self, websocket):
        websocket.send_json({
            "type": "hello", "device_id": "0001",
            "firmware_version": "test", "capabilities": ["audio_control_v1"],
        })
        self.assertEqual(websocket.receive_json()["type"], "ready")

    def test_offline_is_not_reported_as_success(self):
        self.assertFalse(self.client.get("/api/v1/devices/1/control").json()["connected"])
        response = self.client.post("/api/v1/devices/1/commands", json={"action": "play_sound", "sound": "beep"})
        self.assertEqual(response.status_code, 409)

    def test_all_authenticated_accounts_can_view_logs(self):
        self.manager.logs.append("0001", "I", "HUB", "Heartbeat")
        response = self.client.get("/api/v1/devices/1/logs")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertTrue(response.json()["entries"][0]["received_at"].endswith("+07:00"))
        self.user.id = 99
        self.assertEqual(self.client.get("/api/v1/devices/1/logs").status_code, 200)
        self.user.role = "admin"
        self.assertEqual(self.client.get("/api/v1/devices/1/logs").status_code, 200)
        self.app.dependency_overrides.pop(get_current_active_user)
        self.assertEqual(self.client.get("/api/v1/devices/1/logs").status_code, 401)

    def test_viewing_logs_does_not_grant_hardware_control(self):
        self.user.id = 99
        self.assertEqual(self.client.get("/api/v1/devices/1/logs").status_code, 200)
        self.assertEqual(self.client.post("/api/v1/devices/1/commands", json={"action": "stop_audio"}).status_code, 403)

    def test_non_owner_can_find_log_targets_without_private_owner_fields(self):
        self.user.id = 99
        response = self.client.get("/api/v1/devices/log-targets")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{"id": 1, "device_id": "0001"}])
        self.app.dependency_overrides.pop(get_current_active_user)
        self.assertEqual(self.client.get("/api/v1/devices/log-targets").status_code, 401)

    def test_firmware_logs_reach_authenticated_web_with_incremental_cursor(self):
        with self.client.websocket_connect("/ws/lumo?device_id=0001") as websocket:
            websocket.send_json({
                "type": "hello", "device_id": "0001", "firmware_version": "test",
                "capabilities": ["audio_control_v1", "device_logs_v1"],
            })
            self.assertEqual(websocket.receive_json()["type"], "ready")
            websocket.send_json({
                "type": "device_logs", "entries": [{
                    "level": "I", "tag": "BUTTON", "message": "Physical button pressed", "uptime_ms": 1234,
                }],
            })
            websocket.send_text("ping")
            self.assertEqual(websocket.receive_text(), "pong")
            response = self.client.get("/api/v1/devices/1/logs").json()
            self.assertTrue(response["connected"])
            self.assertTrue(response["supported"])
            self.assertEqual(response["entries"][-1]["message"], "Physical button pressed")
            self.assertEqual(response["entries"][-1]["uptime_ms"], 1234)
            following = self.client.get(f"/api/v1/devices/1/logs?after={response['cursor']}").json()
            self.assertEqual(following["entries"], [])

    def test_log_cursor_and_limit_are_validated(self):
        for query in ("after=-1", "limit=0", "limit=1000"):
            self.assertEqual(self.client.get(f"/api/v1/devices/1/logs?{query}").status_code, 422)

    def test_registration_normalizes_numeric_code_before_saving(self):
        with patch.object(devices, "upsert_device", return_value=self.device) as upsert:
            response = self.client.post("/api/v1/devices", json={"device_id": " 1 "})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["device_id"], "0001")
        upsert.assert_called_once_with(self.db, user_id=10, device_id="0001")

    def test_registration_rejects_invalid_numeric_codes(self):
        with patch.object(devices, "upsert_device") as upsert:
            for code in ("", "abc", "12345", "-1", "١٢٣", "1 2"):
                with self.subTest(code=code):
                    response = self.client.post("/api/v1/devices", json={"device_id": code})
                    self.assertEqual(response.status_code, 422)
            upsert.assert_not_called()

    def test_numeric_code_cannot_claim_another_users_device(self):
        other = SimpleNamespace(id=2, user_id=99, device_id="0001")
        with (
            patch.object(devices, "get_device_by_code", return_value=other),
            patch.object(devices, "upsert_device") as upsert,
        ):
            response = self.client.post("/api/v1/devices", json={"device_id": "1"})
        self.assertEqual(response.status_code, 409)
        upsert.assert_not_called()

    def test_other_users_cannot_control_or_observe_device(self):
        self.user.id = 99
        self.assertEqual(self.client.get("/api/v1/devices/1/control").status_code, 403)
        self.assertEqual(self.client.post("/api/v1/devices/1/commands", json={"action": "stop_audio"}).status_code, 403)

    def test_commands_require_authentication(self):
        self.app.dependency_overrides.pop(get_current_active_user)
        self.assertEqual(self.client.post("/api/v1/devices/1/commands", json={"action": "stop_audio"}).status_code, 401)

    def test_only_fixed_commands_and_sounds_are_accepted(self):
        for payload in (
            {"action": "reboot"},
            {"action": "play_sound", "sound": "../../other.wav"},
            {"action": "play_sound"},
            {"action": "stop_audio", "sound": "beep"},
        ):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post("/api/v1/devices/1/commands", json=payload).status_code, 422)

    def test_browser_ping_does_not_mark_hardware_online(self):
        with self.client.websocket_connect("/ws/lumo?device_id=0001") as websocket:
            websocket.send_text("ping")
            with self.assertRaises(WebSocketDisconnect):
                websocket.receive_json()
        self.assertFalse(self.manager.control_status("0001")["connected"])

    def test_disconnect_clears_online_state(self):
        disconnected = Event()
        original = self.manager.disconnect

        def on_disconnect(*args, **kwargs):
            original(*args, **kwargs)
            disconnected.set()

        with patch.object(self.manager, "disconnect", side_effect=on_disconnect):
            with self.client.websocket_connect("/ws/lumo?device_id=0001") as websocket:
                self.hello(websocket)
            self.assertTrue(disconnected.wait(timeout=2))
        self.assertFalse(self.manager.control_status("0001")["connected"])

    def test_firmware_acknowledges_real_command_before_http_success(self):
        with self.client.websocket_connect("/ws/lumo?device_id=0001") as websocket:
            self.hello(websocket)
            state = self.client.get("/api/v1/devices/1/control").json()
            self.assertTrue(state["connected"])
            self.assertTrue(state["audio_control"])
            with ThreadPoolExecutor(max_workers=1) as pool:
                pending = pool.submit(
                    self.client.post, "/api/v1/devices/1/commands",
                    json={"action": "play_sound", "sound": "greeting"},
                )
                message = websocket.receive_json()
                self.assertEqual(message["action"], "play_sound")
                self.assertEqual(message["sound"], "greeting")
                self.assertFalse(pending.done())
                websocket.send_json({
                    "type": "command_result", "request_id": message["request_id"],
                    "status": "completed",
                })
                response = pending.result(timeout=5)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"request_id": message["request_id"], "status": "completed"})
        self.assertFalse(self.manager.pending_commands)

    def test_duplicate_device_registration_does_not_grant_control(self):
        canonical = SimpleNamespace(id=99, user_id=99, device_id="0001")
        with patch.object(devices, "get_device_by_code", return_value=canonical):
            response = self.client.post("/api/v1/devices/1/commands", json={"action": "stop_audio"})
        self.assertEqual(response.status_code, 409)

    def test_device_busy_and_errors_are_returned_to_web(self):
        for result_status, expected_http in (("busy", 409), ("error", 502), ("stopped", 200)):
            with self.subTest(status=result_status):
                with self.client.websocket_connect("/ws/lumo?device_id=0001") as websocket:
                    self.hello(websocket)
                    with ThreadPoolExecutor(max_workers=1) as pool:
                        pending = pool.submit(
                            self.client.post, "/api/v1/devices/1/commands",
                            json={"action": "stop_audio"},
                        )
                        message = websocket.receive_json()
                        websocket.send_json({
                            "type": "command_result", "request_id": message["request_id"],
                            "status": result_status,
                        })
                        self.assertEqual(pending.result(timeout=5).status_code, expected_http)


class ManagerSessionTests(unittest.IsolatedAsyncioTestCase):
    async def test_send_failure_clears_connection_and_pending_command(self):
        manager = LumoConnectionManager()
        socket = MagicMock()
        socket.send_json = AsyncMock(side_effect=RuntimeError("closed"))
        await manager.connect("0001", socket)
        with self.assertRaises(ConnectionError):
            await manager.execute_command("0001", "stop_audio")
        self.assertFalse(manager.pending_commands)
        self.assertFalse(manager.control_status("0001")["connected"])

    async def test_stale_disconnect_cannot_remove_replacement_connection(self):
        manager = LumoConnectionManager()
        old = MagicMock()
        old.close = AsyncMock()
        new = MagicMock()
        await manager.connect("0001", old)
        await manager.connect("0001", new)
        manager.disconnect("0001", old)
        self.assertIs(manager.active_connections["0001"], new)

    async def test_ack_from_other_connection_cannot_complete_command(self):
        manager = LumoConnectionManager()
        socket = MagicMock()
        socket.send_json = AsyncMock()
        await manager.connect("0001", socket)
        command = asyncio.create_task(manager.execute_command("0001", "stop_audio"))
        await asyncio.sleep(0)
        request_id = socket.send_json.call_args.args[0]["request_id"]
        manager.acknowledge("0001", MagicMock(), {"request_id": request_id, "status": "completed"})
        self.assertFalse(command.done())
        manager.acknowledge("0001", socket, {"request_id": request_id, "status": "stopped"})
        self.assertEqual((await command)["status"], "stopped")
        self.assertFalse(manager.pending_commands)


if __name__ == "__main__":
    unittest.main()
