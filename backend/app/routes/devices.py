from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
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
import qrcode
import io
import json

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


# =============================================================================
# QR Code 生成接口 - 用于设备配对（让设备扫描）
# 返回格式: PNG 图片, 内容为 JSON: {"user_id": 123}
# 设备扫描后提取 user_id，然后发送 {device_id, user_id} 到后端完成配对
# =============================================================================
@router.get("/qr")
def generate_user_qr(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    生成用户配对用的 QR 码图片。

    返回 PNG 格式的 QR 码图片，内容为 {"user_id": <当前用户ID>}。
    LUMO 设备扫描此二维码后，提取 user_id，
    然后将 {device_id, user_id} 发回后端 /api/v1/devices 完成配对注册。
    """
    # 构造配对数据：只需要 user_id，设备扫描后自行附加 device_id
    payload = {"user_id": current_user.id}
    json_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    # 生成 QR 码
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(json_text)
    qr.make(fit=True)

    # 渲染为图片
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return Response(content=buf.getvalue(), media_type="image/png")
