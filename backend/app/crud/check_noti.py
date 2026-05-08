from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.check_noti import CheckNoti


def upsert_check_noti(db: Session, device: int, state: int) -> CheckNoti:
    now = datetime.now(timezone.utc)
    existing = db.execute(select(CheckNoti).where(CheckNoti.device == device)).scalars().first()
    if existing:
        existing.state = state
        existing.date = now
        db.commit()
        db.refresh(existing)
    else:
        existing = CheckNoti(device=device, state=state, date=now)
        db.add(existing)
        db.commit()
        db.refresh(existing)
    return existing


def get_check_noti_by_device(db: Session, device: int) -> CheckNoti | None:
    return db.execute(select(CheckNoti).where(CheckNoti.device == device)).scalars().first()


def get_all_check_noti(db: Session, skip: int = 0, limit: int = 100) -> list[CheckNoti]:
    return list(
        db.execute(select(CheckNoti).order_by(CheckNoti.date.desc()).offset(skip).limit(limit))
        .scalars()
        .all()
    )
