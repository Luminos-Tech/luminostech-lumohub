from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.check_noti import (
    CheckNotiCreateRequest,
    CheckNotiUpdateRequest,
    CheckNotiResponse,
)
from app.crud.check_noti import (
    upsert_check_noti,
    get_check_noti_by_device,
    get_all_check_noti,
)
from app.services.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/check-noti", tags=["CheckNoti"])


@router.post("", response_model=CheckNotiResponse, status_code=201)
def create_or_update(
    body: CheckNotiCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    record = upsert_check_noti(db, device=body.device, state=body.state)
    return CheckNotiResponse.model_validate(record)


@router.patch("/{device}", response_model=CheckNotiResponse)
def update_by_device(
    device: int,
    body: CheckNotiUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    record = upsert_check_noti(db, device=device, state=body.state)
    return CheckNotiResponse.model_validate(record)


@router.get("/{device}", response_model=CheckNotiResponse)
def get_by_device(
    device: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    record = get_check_noti_by_device(db, device)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return CheckNotiResponse.model_validate(record)


@router.get("", response_model=list[CheckNotiResponse])
def list_all(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    records = get_all_check_noti(db, skip, limit)
    return [CheckNotiResponse.model_validate(r) for r in records]
