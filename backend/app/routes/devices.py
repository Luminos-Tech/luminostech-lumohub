from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.device import DeviceCreateRequest, DeviceUpdateRequest, DeviceResponse
from app.crud.device import (
    get_device_by_id,
    upsert_device,
    update_device,
    delete_device_by_id,
    get_devices_by_user,
)
from app.crud.log import log_action
from app.services.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("", response_model=list[DeviceResponse])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_devices_by_user(db, current_user.id)


@router.get("/{device_id}", response_model=DeviceResponse)
def get_one_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    device = get_device_by_id(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return device


@router.post("", response_model=DeviceResponse, status_code=201)
def register_device(
    body: DeviceCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    device = upsert_device(db, user_id=current_user.id, device_id=body.device_id)
    log_action(
        db,
        action="register_device",
        user_id=current_user.id,
        target_type="device",
        target_id=device.id,
        ip_address=request.client.host if request.client else None,
    )
    return device


@router.patch("/{device_id}", response_model=DeviceResponse)
def update_one_device(
    device_id: int,
    body: DeviceUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    device = get_device_by_id(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    updated = update_device(db, device, is_active=body.is_active)
    log_action(
        db,
        action="update_device",
        user_id=current_user.id,
        target_type="device",
        target_id=device.id,
    )
    return updated


@router.delete("/{device_id}", status_code=204)
def delete_one_device(
    device_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    deleted = delete_device_by_id(db, device_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Device not found")
    log_action(
        db,
        action="delete_device",
        user_id=current_user.id,
        target_type="device",
        target_id=device_id,
    )
