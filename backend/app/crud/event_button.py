from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from datetime import datetime, timezone
from app.models.event_button import EventButton
from app.models.device import Device


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


def update_last_checkin(
    db: Session, device_id: int, checked_in_at: datetime
) -> None:
    """Cập nhật mốc điểm danh gần nhất trên bảng devices.

    Mỗi lần firmware POST lên (khi người dùng bấm nút vật lý), ta chỉ
    ghi nhận timestamp — không đếm số lần. Dữ liệu này thuộc về device,
    không phụ thuộc vào việc device đã có chủ hay chưa.
    """
    device = db.get(Device, device_id)
    if not device:
        return
    device.last_checkin_at = checked_in_at
    db.commit()


def get_device_checkin(db: Session, device_id: int) -> dict:
    """Trả về {last_checkin_at} của 1 device."""
    device = db.get(Device, device_id)
    if not device:
        return {"last_checkin_at": None}
    return {"last_checkin_at": device.last_checkin_at}


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
