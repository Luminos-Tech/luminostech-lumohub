from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from app.models.event import Event
from app.models.reminder import Reminder
from typing import Optional, List
from datetime import datetime


def get_event(db: Session, event_id: int) -> Optional[Event]:
    return db.execute(
        select(Event).options(selectinload(Event.reminders)).where(Event.id == event_id)
    ).scalar_one_or_none()


def get_events_by_user(
    db: Session,
    user_id: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Event]:
    q = select(Event).options(selectinload(Event.reminders)).where(Event.user_id == user_id)
    if start:
        q = q.where(Event.end_time >= start)
    if end:
        q = q.where(Event.start_time <= end)
    q = q.order_by(Event.start_time).offset(skip).limit(limit)
    return list(db.execute(q).scalars().all())


def create_event(
    db: Session,
    user_id: int,
    title: str,
    start_time: datetime,
    end_time: datetime,
    description: Optional[str] = None,
    location: Optional[str] = None,
    priority: str = "normal",
    color: Optional[str] = "#3B82F6",
    reminders_data: Optional[list] = None,
) -> Event:
    event = Event(
        user_id=user_id,
        title=title,
        description=description,
        location=location,
        start_time=start_time,
        end_time=end_time,
        priority=priority,
        color=color,
    )
    db.add(event)
    db.flush()

    if reminders_data:
        for r in reminders_data:
            reminder = Reminder(
                event_id=event.id,
                remind_before_minutes=r.remind_before_minutes,
                channel=r.channel,
            )
            db.add(reminder)

    db.commit()
    db.refresh(event)
    return event


def update_event(db: Session, event: Event, **kwargs) -> Event:
    for key, value in kwargs.items():
        if value is not None and hasattr(event, key):
            setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, event: Event) -> None:
    db.delete(event)
    db.commit()


def get_all_events(db: Session, skip: int = 0, limit: int = 100) -> List[Event]:
    return list(db.execute(
        select(Event).options(selectinload(Event.reminders)).order_by(Event.start_time).offset(skip).limit(limit)
    ).scalars().all())
