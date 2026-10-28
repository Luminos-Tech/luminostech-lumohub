from fastapi import APIRouter, Depends, HTTPException, Query, Request  # type: ignore
from fastapi.responses import Response  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from sqlalchemy.sql import func
from app.db.session import get_db
from app.schemas.device import (
    DeviceCommandRequest,
    DeviceCommandResponse,
    DeviceControlStatus,
    DeviceCreateRequest,
    DeviceTelemetryRequest,
    DeviceUpdateRequest,
    DeviceResponse,
    DeviceLogsResponse,
    DeviceLogTarget,
)
from app.crud.device import (
    get_device_by_id,
    get_device_by_code,
    upsert_device,
    update_device,
    delete_device_by_id,
    get_devices_by_user,
    get_device_log_targets,
)
from app.crud.log import log_action
from app.services.deps import get_current_active_user
from app.models.user import User
from app.core.config import settings
from app.websocket.manager import manager
import asyncio
import qrcode  # type: ignore
import io
import json

router = APIRouter(prefix="/devices", tags=["Devices"])


def require_control_device(db: Session, device_id: int, user: User):
    device = get_device_by_id(db, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    if not device.is_active:
        raise HTTPException(status_code=409, detail="Device is inactive")
    # Legacy schema permits the same code in different users' device rows.
    # A duplicate registration must not grant access to somebody else's Hub.
    canonical = get_device_by_code(db, user_id=None, device_code=device.device_id)
    if canonical is None or canonical.id != device.id:
        raise HTTPException(status_code=409, detail="Device code belongs to another registration")
    return device


@router.get("/{device_id}/control", response_model=DeviceControlStatus)
def device_control_status(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    device = require_control_device(db, device_id, current_user)
    return manager.control_status(device.device_id)


@router.post("/{device_id}/commands", response_model=DeviceCommandResponse)
async def send_device_command(
    device_id: int,
    body: DeviceCommandRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    device = require_control_device(db, device_id, current_user)
    state = manager.control_status(device.device_id)
    if not state["connected"]:
        raise HTTPException(status_code=409, detail="Device is offline")
    if not state["audio_control"]:
        raise HTTPException(status_code=409, detail="Firmware does not support audio control")
    # Copy ORM values before awaiting the device response.
    code = device.device_id
    owner_id = current_user.id
    log_action(
        db, action="device_command", user_id=owner_id, target_type="device",
        target_id=device_id, ip_address=request.client.host if request.client else None,
        details=f"action={body.action}, sound={body.sound}",
    )
    try:
        result = await manager.execute_command(code, body.action, body.sound)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Device did not confirm the command")
    except (ConnectionError, RuntimeError, OSError):
        raise HTTPException(status_code=409, detail="Device disconnected")
    if result["status"] == "busy":
        raise HTTPException(status_code=409, detail="Device speaker is busy")
    if result["status"] == "error":
        raise HTTPException(status_code=502, detail="Device could not execute the command")
    return result


def require_device_logs_enabled():
    if not settings.DEVICE_LOGS_ENABLED:
        raise HTTPException(status_code=403, detail="Device log viewing is temporarily disabled")


@router.get("/log-targets", response_model=list[DeviceLogTarget])
def list_log_targets(
    response: Response,
    _logs_enabled: None = Depends(require_device_logs_enabled),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    response.headers["Cache-Control"] = "no-store"
    return get_device_log_targets(db)


@router.get("/{device_id}/logs", response_model=DeviceLogsResponse)
async def device_logs(
    device_id: int,
    response: Response,
    after: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    _logs_enabled: None = Depends(require_device_logs_enabled),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    device = get_device_by_id(db, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    response.headers["Cache-Control"] = "no-store"
    return {
        **manager.logs.read(device.device_id, after, limit),
        "connected": device.device_id in manager.active_connections,
        "supported": "device_logs_v1" in manager.device_info.get(device.device_id, {}).get("capabilities", []),
    }


@router.get("", response_model=list[DeviceResponse])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_devices_by_user(db, current_user.id)


@router.get("/qr")
def generate_user_qr(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate QR code image for device pairing.
    """
    payload = {"user_id": current_user.id}
    json_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(json_text)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf)
    buf.seek(0)

    return Response(content=buf.getvalue(), media_type="image/png")


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
    existing = get_device_by_code(db, user_id=None, device_code=body.device_id)
    if existing is not None and existing.user_id != current_user.id:
        raise HTTPException(status_code=409, detail="Device is already registered to another user")
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


@router.patch("/{device_id}/telemetry", response_model=DeviceResponse)
def update_device_telemetry(
    device_id: int,
    body: DeviceTelemetryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Hub / wearable pushes last-known telemetry (battery, fall, activity)."""
    device = get_device_by_id(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No telemetry fields supplied")
    payload["telemetry_updated_at"] = func.now()

    updated = update_device(db, device, **payload)
    log_action(
        db,
        action="update_device_telemetry",
        user_id=current_user.id,
        target_type="device",
        target_id=device.id,
        ip_address=request.client.host if request.client else None,
    )
    return updated
