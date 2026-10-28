import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.crud.event import get_events_by_user, update_event
from app.crud.event_button import get_today_status
from app.db.session import Base
from app.models import Device, Event, EventButton, User
from app.schemas.device import DeviceTelemetryRequest
from app.schemas.event import EventCreateRequest, EventResponse
from app.schemas.event_button import EventButtonCreateRequest, EventButtonResponse
from app.schemas.notification import NotificationResponse
from app.tasks import scheduler as scheduler_module
from app.utils.timezone import (
    VIETNAM_TIMEZONE,
    as_local,
    database_datetime,
    incoming_datetime,
    today_bounds,
)
from app.websocket.notification_manager import NotificationConnectionManager


class TimezoneTests(unittest.TestCase):
    def test_input_offsets_preserve_the_same_instant(self):
        for text in ("2026-10-29T08:00:00", "2026-10-29T08:00:00+07:00",
                     "2026-10-29T01:00:00+00:00", "2026-10-28T21:00:00-04:00"):
            with self.subTest(text=text):
                value = datetime.fromisoformat(text)
                self.assertEqual(
                    incoming_datetime(value),
                    datetime(2026, 10, 29, 1, tzinfo=timezone.utc),
                )
                self.assertEqual(database_datetime(value), datetime(2026, 10, 29, 1))

    def test_legacy_utc_and_aware_values_serialize_without_double_shift(self):
        expected = "2026-10-29T08:00:00+07:00"
        for value in (datetime(2026, 10, 29, 1),
                      datetime(2026, 10, 29, 1, tzinfo=timezone.utc),
                      datetime(2026, 10, 29, 8, tzinfo=VIETNAM_TIMEZONE)):
            response = EventButtonResponse(
                id=1, device_id=1, device_code="0001", user_id=1,
                time_button_click=value, created_at=value,
            )
            self.assertEqual(response.model_dump(mode="json")["time_button_click"], expected)
            self.assertIsInstance(response.model_dump()["created_at"], datetime)

    def test_local_midnight_bounds_cross_utc_date(self):
        start, end = today_bounds(datetime(2026, 10, 28, 17, tzinfo=timezone.utc))
        self.assertEqual(start.isoformat(), "2026-10-29T00:00:00+07:00")
        self.assertEqual(start.astimezone(timezone.utc).hour, 17)
        self.assertEqual(end - start, timedelta(days=1))

    def test_request_with_mixed_offsets_can_compare_event_times(self):
        request = EventCreateRequest(
            title="Morning", start_time="2026-10-29T08:00:00",
            end_time="2026-10-29T02:00:00Z",
        )
        self.assertEqual(request.end_time - request.start_time, timedelta(hours=1))

    def test_telemetry_and_firmware_utc_inputs(self):
        telemetry = DeviceTelemetryRequest(last_activity_at="2026-10-29T08:00:00")
        click = EventButtonCreateRequest(
            device_id="0001", time_button_click="2026-10-29T01:00:00Z",
        )
        self.assertEqual(telemetry.last_activity_at, click.time_button_click)

    def test_nested_response_and_fastapi_json_use_local_offset(self):
        value = datetime(2026, 10, 29, 1)
        response = EventResponse(
            id=1, user_id=1, title="Morning", start_time=value,
            end_time=value + timedelta(hours=1), status="scheduled",
            priority="normal", created_at=value, updated_at=value,
            reminders=[{
                "id": 2, "event_id": 1, "remind_before_minutes": 5,
                "channel": "web", "is_sent": False, "created_at": value,
            }],
        )
        app = FastAPI()

        @app.get("/event", response_model=EventResponse)
        def event():
            return response

        data = TestClient(app).get("/event").json()
        self.assertEqual(data["start_time"], "2026-10-29T08:00:00+07:00")
        self.assertEqual(data["reminders"][0]["created_at"], data["created_at"])
        self.assertIsNone(data["reminders"][0]["sent_at"])

    def test_notification_websocket_matches_rest_timestamp(self):
        notification = SimpleNamespace(
            id=1, user_id=1, event_id=None, title="LUMO Hub",
            content="người dùng ấn nút", channel="push", notification_type="normal",
            is_read=False, created_at=datetime(2026, 10, 28, 17), read_at=None,
        )
        socket = MagicMock()
        socket.send_json = AsyncMock()
        manager = NotificationConnectionManager()
        manager.connect(1, socket)
        self.assertEqual(asyncio.run(manager.publish_notification(notification)), 1)
        data = socket.send_json.call_args.args[0]["data"]
        expected = NotificationResponse.model_validate(
            notification, from_attributes=True
        ).model_dump(mode="json")
        self.assertEqual(data, expected)
        self.assertEqual(data["created_at"], "2026-10-29T00:00:00+07:00")


class DatabaseTimezoneTests(unittest.TestCase):
    def setUp(self):
        # Only this independent, in-memory database is accessed by these tests.
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(User(id=1, full_name="Test", email="test@example.com", password_hash="test"))
        self.db.add(Device(id=1, user_id=1, device_id="0001"))
        self.db.add(Event(
            id=1, user_id=1, title="Morning",
            start_time=datetime(2026, 10, 29, 1),
            end_time=datetime(2026, 10, 29, 2),
        ))
        for index, instant in enumerate((
            datetime(2026, 10, 28, 16, 59, 59),
            datetime(2026, 10, 28, 17),
            datetime(2026, 10, 29, 16, 59, 59),
            datetime(2026, 10, 29, 17),
        ), start=1):
            self.db.add(EventButton(
                id=index, user_id=1, device_id=1, time_button_click=instant,
            ))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_today_includes_local_midnight_and_excludes_next_midnight(self):
        with patch("app.utils.timezone.local_now",
                   return_value=datetime(2026, 10, 29, 8, tzinfo=VIETNAM_TIMEZONE)):
            clicked, last_click, count = get_today_status(self.db, 1)
        self.assertTrue(clicked)
        self.assertEqual(count, 2)
        self.assertEqual(as_local(last_click).isoformat(), "2026-10-29T23:59:59+07:00")

    def test_calendar_filter_and_update_preserve_utc_storage(self):
        events = get_events_by_user(
            self.db, 1, start=datetime(2026, 10, 29, 8),
            end=datetime(2026, 10, 29, 9),
        )
        self.assertEqual([event.id for event in events], [1])
        event = update_event(self.db, events[0], start_time=datetime(2026, 10, 29, 8, 30))
        self.assertEqual(event.start_time, datetime(2026, 10, 29, 1, 30))


class SchedulerTimezoneTests(unittest.TestCase):
    def test_due_reminder_preserves_offset_and_displays_vietnam_time(self):
        # 08:00 +07:00 is still in the future at 00:30 UTC.
        future = SimpleNamespace(
            event=SimpleNamespace(start_time=datetime(2026, 10, 29, 8, tzinfo=VIETNAM_TIMEZONE)),
            remind_before_minutes=0,
        )
        # 07:00 +07:00 is due, while treating it as UTC would delay it seven hours.
        due = SimpleNamespace(
            event=SimpleNamespace(
                id=1, user_id=1, title="Morning",
                start_time=datetime(2026, 10, 29, 7, tzinfo=VIETNAM_TIMEZONE),
            ),
            remind_before_minutes=0, channel="lumo",
        )
        db = MagicMock()
        db.execute.return_value.scalars.return_value.all.return_value = [future, due]
        with (
            patch.object(scheduler_module, "SessionLocal", return_value=db),
            patch.object(scheduler_module, "datetime") as clock,
            patch.object(scheduler_module, "create_notification") as create,
            patch.object(scheduler_module, "mark_reminder_sent") as mark_sent,
            patch.object(scheduler_module.notification_manager, "publish_notification", new_callable=AsyncMock),
            patch.object(scheduler_module.manager, "send_reminder", new_callable=AsyncMock) as send,
        ):
            clock.now.return_value = datetime(2026, 10, 29, 0, 30, tzinfo=timezone.utc)
            asyncio.run(scheduler_module.check_reminders())
            create.assert_called_once()
            self.assertIn("07:00 29/10/2026", create.call_args.kwargs["content"])
            mark_sent.assert_called_once_with(db, due)
            self.assertEqual(send.call_args.args[1]["start_time"], "2026-10-29T07:00:00+07:00")
        self.assertEqual(scheduler_module.scheduler.timezone.utcoffset(None), timedelta(hours=7))


if __name__ == "__main__":
    unittest.main()
