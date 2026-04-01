from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.notification import NotificationResponse
from app.crud.notification import (get_notifications_by_user, get_notification,
                                    mark_read, mark_all_read)
from app.services.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationResponse])
def list_notifications(skip: int = 0, limit: int = 50,
                        db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_active_user)):
    return get_notifications_by_user(db, current_user.id, skip=skip, limit=limit)


@router.patch("/{notif_id}/read", response_model=NotificationResponse)
def read_notification(notif_id: int, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_active_user)):
    notif = get_notification(db, notif_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return mark_read(db, notif)


@router.patch("/read-all", status_code=200)
def read_all(db: Session = Depends(get_db),
              current_user: User = Depends(get_current_active_user)):
    count = mark_all_read(db, current_user.id)
    return {"marked_read": count}
