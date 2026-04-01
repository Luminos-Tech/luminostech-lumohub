from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.reminder import Reminder
from app.models.event import Event
from app.crud.reminder import mark_reminder_sent
from app.crud.notification import create_notification
from app.websocket.manager import manager
from datetime import datetime, timezone
from sqlalchemy import select, and_
import json


scheduler = AsyncIOScheduler()


async def check_reminders():
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        rows = db.execute(
            select(Reminder, Event)
            .join(Event, Reminder.event_id == Event.id)
            .where(
                and_(
                    Reminder.is_sent == False,
                    Event.start_time - (Reminder.remind_before_minutes * 60) <= now.timestamp(),
                )
            )
        ).all()

        # Simpler approach: find reminders where event start is within remind window
        rows = db.execute(
            select(Reminder).join(Reminder.event)
            .where(Reminder.is_sent == False)
        ).scalars().all()

        triggered = []
        for reminder in rows:
            event = reminder.event
            from datetime import timedelta
            remind_at = event.start_time.replace(tzinfo=timezone.utc) - timedelta(minutes=reminder.remind_before_minutes)
            if now >= remind_at:
                triggered.append(reminder)

        for reminder in triggered:
            event = reminder.event
            user_id = event.user_id

            # Create notification
            title = f"⏰ Nhắc lịch: {event.title}"
            content = (
                f"Sự kiện '{event.title}' sẽ bắt đầu lúc "
                f"{event.start_time.strftime('%H:%M %d/%m/%Y')}."
            )
            create_notification(db, user_id=user_id, title=title,
                                content=content, event_id=event.id,
                                channel=reminder.channel)

            # Send via WebSocket if channel = lumo
            if reminder.channel == "lumo":
                await manager.send_reminder(user_id, {
                    "type": "reminder",
                    "event_id": event.id,
                    "title": event.title,
                    "message": content,
                    "start_time": event.start_time.isoformat(),
                })

            mark_reminder_sent(db, reminder)
            print(f"📬 Reminder sent for event [{event.id}] {event.title} → user {user_id}")

    except Exception as e:
        print(f"❌ Reminder scheduler error: {e}")
    finally:
        db.close()


async def cleanup_expired_sessions():
    db: Session = SessionLocal()
    try:
        from app.models.user_session import UserSession
        now = datetime.now(timezone.utc)
        expired = db.execute(
            select(UserSession).where(UserSession.expires_at <= now)
        ).scalars().all()
        for s in expired:
            db.delete(s)
        if expired:
            db.commit()
            print(f"🧹 Cleaned {len(expired)} expired sessions.")
    except Exception as e:
        print(f"❌ Session cleanup error: {e}")
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(check_reminders, IntervalTrigger(minutes=1), id="check_reminders", replace_existing=True)
    scheduler.add_job(cleanup_expired_sessions, IntervalTrigger(hours=1), id="cleanup_sessions", replace_existing=True)
    scheduler.start()
    print("⏱️  Scheduler started.")


def stop_scheduler():
    scheduler.shutdown()
