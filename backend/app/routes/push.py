"""Web Push 通知路由 - Admin 发送 Push 通知给用户"""
import json
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.crud.notification import create_notification
from app.crud.push_subscription import (
    get_user_subscriptions,
    get_all_active_subscriptions,
    upsert_subscription,
    deactivate_subscription,
)
from app.crud.user import get_user_by_id
from app.services.deps import get_current_active_user, get_current_admin
from app.models.user import User
from app.websocket.notification_manager import (
    NOTIFICATION_EVENT_VERSION,
    notification_manager,
)

router = APIRouter(prefix="/push", tags=["Push Notifications"])


# =============================================================================
# Pydantic Schemas
# =============================================================================

class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: dict  # 包含 p256dh 和 auth


class AdminPushRequest(BaseModel):
    user_id: int | None = None
    title: str
    body: str
    tag: str = "lumohub-admin"


# =============================================================================
# VAPID helpers - pywebpush yêu cầu string base64url cho vapid_private_key
# =============================================================================

def _get_vapid_keys_for_pywebpush():
    """
    Lấy VAPID keys dạng string base64url cho pywebpush.
    Vapid.from_string() nhận chuỗi base64url và tự decode.
    """
    pub = settings.VAPID_PUBLIC_KEY
    priv = settings.VAPID_PRIVATE_KEY

    if not pub or not priv:
        return None, None

    # Trả về string base64url trực tiếp (không decode)
    # pywebpush sẽ tự decode bên trong Vapid.from_string()
    return pub, priv


def get_vapid_public_key() -> str:
    """Trả về VAPID public key (base64url) cho frontend"""
    from app.core.config import settings
    return settings.VAPID_PUBLIC_KEY


# =============================================================================
# Gửi Web Push
# =============================================================================

async def _send_web_push(subscription, title: str, body: str, tag: str = "lumohub-notif"):
    """Gửi một Web Push notification"""
    try:
        from pywebpush import webpush
    except ImportError:
        return False

    pub_key, priv_key = _get_vapid_keys_for_pywebpush()
    if not pub_key or not priv_key:
        print("⚠️ VAPID keys not available, skipping push")
        return False

    try:
        payload = json.dumps({
            "title": title,
            "body": body,
            "tag": tag,
        })

        # pywebpush nhận vapid_private_key dạng string base64url
        # Vapid.from_string() sẽ tự decode và validate
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh,
                    "auth": subscription.auth,
                }
            },
            data=payload,
            vapid_private_key=priv_key,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=3600,
        )
        return True
    except Exception as e:
        print(f"❌ WebPush failed for {subscription.endpoint[:60]}...: {e}")
        return False


async def _notify_subscriptions(subscriptions, title: str, body: str, tag: str):
    """Gửi push đến nhiều subscription"""
    results = []
    for sub in subscriptions:
        sent = await _send_web_push(sub, title, body, tag)
        results.append((sub.endpoint, sent))
    return results


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/public-key")
def get_public_key():
    return {"publicKey": get_vapid_public_key()}


@router.post("/subscribe")
def subscribe_push(
    body: PushSubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not body.keys.get("p256dh") or not body.keys.get("auth"):
        raise HTTPException(status_code=400, detail="Missing encryption keys")

    upsert_subscription(
        db,
        user_id=current_user.id,
        endpoint=body.endpoint,
        p256dh=body.keys["p256dh"],
        auth=body.keys["auth"],
    )
    return {"subscribed": True}


@router.delete("/subscribe")
def unsubscribe_push(
    body: PushSubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    deactivated = deactivate_subscription(db, body.endpoint)
    return {"unsubscribed": deactivated}


@router.post("/send")
async def send_push(
    body: AdminPushRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if body.user_id is not None:
        user = get_user_by_id(db, body.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        target_users = [user]
        subs = get_user_subscriptions(db, body.user_id)
        target_label = f"user_id={body.user_id}"
    else:
        target_users = list(db.execute(
            select(User).where(User.is_active.is_(True))
        ).scalars().all())
        subs = get_all_active_subscriptions(db)
        target_label = "all users"

    realtime_delivered = 0
    for user in target_users:
        notification = create_notification(
            db,
            user_id=user.id,
            title=body.title,
            content=body.body,
            channel="push",
        )
        realtime_delivered += await notification_manager.publish_notification(notification)

    if not subs:
        return {
            "created": len(target_users),
            "realtime_delivered": realtime_delivered,
            "event_version": NOTIFICATION_EVENT_VERSION,
            "sent": 0,
            "total": 0,
            "target": target_label,
            "message": "Notification saved; no active browser subscriptions",
        }

    results = await _notify_subscriptions(subs, body.title, body.body, body.tag)
    sent_count = sum(1 for _, ok in results if ok)

    print(f"📬 Push sent: {sent_count}/{len(subs)} to {target_label}")

    return {
        "created": len(target_users),
        "realtime_delivered": realtime_delivered,
        "event_version": NOTIFICATION_EVENT_VERSION,
        "sent": sent_count,
        "total": len(subs),
        "target": target_label,
    }


@router.get("/status")
def push_status(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    all_subs = get_all_active_subscriptions(db)
    users_with_subs = len(set(s.user_id for s in all_subs))
    return {
        "total_subscriptions": len(all_subs),
        "users_with_push": users_with_subs,
    }
