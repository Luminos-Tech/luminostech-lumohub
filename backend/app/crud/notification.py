from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.notification import Notification
from typing import Optional, List
from datetime import datetime, timezone


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    content: str,
    event_id: Optional[int] = None,
    channel: str = "web",
) -> Notification:
    notif = Notification(
        user_id=user_id,
        event_id=event_id,
        title=title,
        content=content,
        channel=channel,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def get_notifications_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 50) -> List[Notification]:
    return list(db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(skip).limit(limit)
    ).scalars().all())


def get_notification(db: Session, notif_id: int) -> Optional[Notification]:
    return db.get(Notification, notif_id)


def mark_read(db: Session, notif: Notification) -> Notification:
    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notif)
    return notif


def mark_all_read(db: Session, user_id: int) -> int:
    notifs = db.execute(
        select(Notification).where(Notification.user_id == user_id, Notification.is_read == False)
    ).scalars().all()
    now = datetime.now(timezone.utc)
    for n in notifs:
        n.is_read = True
        n.read_at = now
    db.commit()
    return len(notifs)
