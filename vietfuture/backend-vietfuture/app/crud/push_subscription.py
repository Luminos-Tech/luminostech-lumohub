"""CRUD 操作 - Push Subscription"""
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from app.models.push_subscription import PushSubscription
from app.models.user import User
from typing import List, Optional
from datetime import datetime, timezone


def upsert_subscription(
    db: Session,
    user_id: int,
    endpoint: str,
    p256dh: str,
    auth: str,
) -> PushSubscription:
    """
    创建或更新 Push 订阅记录。
    同一个 endpoint 只属于一个用户，如果 endpoint 已存在则更新 user_id。
    """
    existing = db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).scalars().first()

    now = datetime.now(timezone.utc)
    if existing:
        existing.user_id = user_id
        existing.p256dh = p256dh
        existing.auth = auth
        existing.is_active = True
        existing.last_used_at = now
        db.commit()
        db.refresh(existing)
        return existing

    sub = PushSubscription(
        user_id=user_id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        is_active=True,
        last_used_at=now,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def deactivate_subscription(db: Session, endpoint: str) -> bool:
    """根据 endpoint 取消订阅（用户主动取消推送）"""
    sub = db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).scalars().first()
    if not sub:
        return False
    sub.is_active = False
    db.commit()
    return True


def get_user_subscriptions(db: Session, user_id: int) -> List[PushSubscription]:
    """获取用户所有活跃的订阅"""
    return list(db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.is_active == True,
        )
    ).scalars().all())


def delete_user_subscriptions(db: Session, user_id: int) -> int:
    """删除用户所有订阅（用于用户登出/账号删除场景）"""
    subs = db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    ).scalars().all()
    count = len(subs)
    for s in subs:
        db.delete(s)
    db.commit()
    return count


def get_all_active_subscriptions(db: Session) -> List[PushSubscription]:
    """获取所有活跃订阅（用于管理员广播通知）"""
    return list(db.execute(
        select(PushSubscription).where(PushSubscription.is_active == True)
    ).scalars().all())
