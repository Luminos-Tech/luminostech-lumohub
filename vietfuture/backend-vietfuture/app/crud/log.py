from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.system_log import SystemLog
from app.models.admin_action import AdminAction
from typing import Optional, List


def log_action(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> SystemLog:
    entry = SystemLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_system_logs(db: Session, skip: int = 0, limit: int = 100) -> List[SystemLog]:
    return list(db.execute(
        select(SystemLog).order_by(SystemLog.created_at.desc()).offset(skip).limit(limit)
    ).scalars().all())


def log_admin_action(
    db: Session,
    admin_user_id: int,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    note: Optional[str] = None,
) -> AdminAction:
    entry = AdminAction(
        admin_user_id=admin_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        note=note,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
