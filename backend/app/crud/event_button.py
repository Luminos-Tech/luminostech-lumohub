from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from datetime import datetime, timezone
from app.models.event_button import EventButton


def create_event_button(
    db: Session, user_id: int, device_id: int, time_button_click: datetime
) -> EventButton:
    event = EventButton(
        user_id=user_id,
        device_id=device_id,
        time_button_click=time_button_click,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_events_by_user(
    db: Session, user_id: int, limit: int = 100
) -> list[EventButton]:
    return list(
        db.execute(
            select(EventButton)
            .where(EventButton.user_id == user_id)
            .order_by(EventButton.time_button_click.desc())
            .limit(limit)
        ).scalars().all()
    )


def get_today_status(db: Session, user_id: int) -> tuple[bool, datetime | None, int]:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start.replace(hour=23, minute=59, second=59, microsecond=999999)

    events = list(
        db.execute(
            select(EventButton)
            .where(
                and_(
                    EventButton.user_id == user_id,
                    EventButton.time_button_click >= today_start,
                    EventButton.time_button_click <= today_end,
                )
            )
            .order_by(EventButton.time_button_click.desc())
        ).scalars().all()
    )

    if not events:
        return False, None, 0
    return True, events[0].time_button_click, len(events)
