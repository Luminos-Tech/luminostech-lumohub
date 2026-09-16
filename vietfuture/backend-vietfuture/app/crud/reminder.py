from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.reminder import Reminder
from typing import Optional, List
from datetime import datetime


def get_reminder(db: Session, reminder_id: int) -> Optional[Reminder]:
    return db.get(Reminder, reminder_id)


def get_reminders_by_event(db: Session, event_id: int) -> List[Reminder]:
    return list(db.execute(select(Reminder).where(Reminder.event_id == event_id)).scalars().all())


def get_reminders_by_user(db: Session, user_id: int) -> List[Reminder]:
    return list(db.execute(
        select(Reminder).join(Reminder.event).where(Reminder.event.has(user_id=user_id))
    ).scalars().all())


def create_reminder(db: Session, event_id: int, remind_before_minutes: int, channel: str = "web") -> Reminder:
    reminder = Reminder(
        event_id=event_id,
        remind_before_minutes=remind_before_minutes,
        channel=channel,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


def update_reminder(db: Session, reminder: Reminder, **kwargs) -> Reminder:
    for key, value in kwargs.items():
        if value is not None and hasattr(reminder, key):
            setattr(reminder, key, value)
    db.commit()
    db.refresh(reminder)
    return reminder


def delete_reminder(db: Session, reminder: Reminder) -> None:
    db.delete(reminder)
    db.commit()


def get_due_reminders(db: Session, now: datetime) -> List[Reminder]:
    """Get reminders that are due and not yet sent."""
    from app.models.event import Event
    from sqlalchemy import and_
    from sqlalchemy.sql.expression import func as sqlfunc

    results = db.execute(
        select(Reminder)
        .join(Reminder.event)
        .where(
            and_(
                Reminder.is_sent == False,
                Event.start_time <= sqlfunc.now(),
            )
        )
    ).scalars().all()
    return list(results)


def mark_reminder_sent(db: Session, reminder: Reminder) -> Reminder:
    from datetime import timezone
    reminder.is_sent = True
    reminder.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reminder)
    return reminder
