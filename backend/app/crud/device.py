from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Optional
from app.models.device import Device


def normalize_device_code(code: str) -> str:
    s = code.strip()
    if s.isdigit() and len(s) <= 4:
        return s.zfill(4)
    return s


def get_device_by_id(db: Session, device_id: int) -> Device | None:
    return db.get(Device, device_id)


def get_device_by_code(db: Session, user_id: Optional[int], device_code: str) -> Device | None:
    code = normalize_device_code(device_code)
    if user_id is not None:
        return db.execute(
            select(Device).where(Device.user_id == user_id, Device.device_id == code)
        ).scalar_one_or_none()
    return db.execute(
        select(Device).where(Device.device_id == code).limit(1)
    ).scalar_one_or_none()


def get_devices_by_user(db: Session, user_id: int) -> list[Device]:
    return list(
        db.execute(
            select(Device)
            .where(Device.user_id == user_id)
            .order_by(Device.created_at.desc())
        ).scalars().all()
    )


def create_device(db: Session, user_id: int, device_id: str) -> Device:
    device = Device(user_id=user_id, device_id=device_id)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def upsert_device(db: Session, user_id: int, device_id: str) -> Device:
    existing = get_device_by_code(db, user_id, device_id)
    if existing:
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing
    return create_device(db, user_id, device_id)


def update_device(db: Session, device: Device, **kwargs) -> Device:
    for key, value in kwargs.items():
        if value is not None and hasattr(device, key):
            setattr(device, key, value)
    db.commit()
    db.refresh(device)
    return device


def delete_device_by_id(db: Session, device_id: int, user_id: int) -> bool:
    device = db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == user_id)
    ).scalar_one_or_none()
    if not device:
        return False
    db.delete(device)
    db.commit()
    return True
