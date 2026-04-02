from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.user import UserResponse, AdminUserUpdateRequest
from app.schemas.admin import SystemLogResponse, AdminCreateUserRequest, AdminResetPasswordRequest
from app.schemas.event import EventResponse
from app.crud.user import get_all_users, get_user_by_id, set_user_active, set_user_role, create_user, change_password, get_user_by_email
from app.crud.log import get_system_logs, log_admin_action
from app.crud.event import get_all_events
from app.websocket.manager import manager
from app.services.deps import get_current_admin
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=List[UserResponse])
def list_users(skip: int = 0, limit: int = 50,
               db: Session = Depends(get_db),
               admin: User = Depends(get_current_admin)):
    return get_all_users(db, skip=skip, limit=limit)


@router.post("/users", response_model=UserResponse, status_code=201)
def admin_create_user(body: AdminCreateUserRequest,
                       db: Session = Depends(get_db),
                       admin: User = Depends(get_current_admin)):
    if get_user_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = create_user(db, body.full_name, body.email, body.password, body.role)
    log_admin_action(db, admin_user_id=admin.id, action="create_user",
                     target_type="user", target_id=user.id,
                     note=f"email={body.email}, role={body.role}")
    return user


@router.patch("/users/{user_id}/password", status_code=204)
def admin_reset_password(user_id: int,
                          body: AdminResetPasswordRequest,
                          db: Session = Depends(get_db),
                          admin: User = Depends(get_current_admin)):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    change_password(db, user, body.new_password)
    log_admin_action(db, admin_user_id=admin.id, action="reset_password",
                     target_type="user", target_id=user_id)


@router.patch("/users/{user_id}/lock", response_model=UserResponse)
def lock_user(user_id: int, db: Session = Depends(get_db),
               admin: User = Depends(get_current_admin)):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updated = set_user_active(db, user, False)
    log_admin_action(db, admin_user_id=admin.id, action="lock_user",
                     target_type="user", target_id=user_id)
    return updated


@router.patch("/users/{user_id}/unlock", response_model=UserResponse)
def unlock_user(user_id: int, db: Session = Depends(get_db),
                 admin: User = Depends(get_current_admin)):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updated = set_user_active(db, user, True)
    log_admin_action(db, admin_user_id=admin.id, action="unlock_user",
                     target_type="user", target_id=user_id)
    return updated


@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_role(user_id: int, body: AdminUserUpdateRequest,
                 db: Session = Depends(get_db),
                 admin: User = Depends(get_current_admin)):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not body.role:
        raise HTTPException(status_code=400, detail="role is required")
    updated = set_user_role(db, user, body.role)
    log_admin_action(db, admin_user_id=admin.id, action="update_role",
                     target_type="user", target_id=user_id,
                     note=f"new_role={body.role}")
    return updated


@router.get("/logs", response_model=List[SystemLogResponse])
def view_logs(skip: int = 0, limit: int = 100,
               db: Session = Depends(get_db),
               admin: User = Depends(get_current_admin)):
    return get_system_logs(db, skip=skip, limit=limit)


@router.get("/events", response_model=List[EventResponse])
def view_all_events(skip: int = 0, limit: int = 100,
                     db: Session = Depends(get_db),
                     admin: User = Depends(get_current_admin)):
    return get_all_events(db, skip=skip, limit=limit)


class DeviceNotificationRequest(BaseModel):
    device_id: str
    title: str
    body: str


@router.post("/device/notify")
def notify_device(body: DeviceNotificationRequest,
                  background_tasks: BackgroundTasks,
                  admin: User = Depends(get_current_admin)):
    message = {"title": body.title, "body": body.body}
    background_tasks.add_task(manager.send_reminder, body.device_id, message)
    return {"sent": True, "device_id": body.device_id}

