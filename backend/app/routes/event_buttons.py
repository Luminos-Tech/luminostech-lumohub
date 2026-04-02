from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.event_button import (
    EventButtonCreateRequest,
    EventButtonResponse,
    TodayButtonStatusResponse,
)
from app.crud.event_button import (
    create_event_button,
    get_events_by_user,
    get_today_status,
)
from app.crud.device import get_device_by_code
from app.crud.log import log_action
from app.services.deps import get_current_active_user
from app.models.user import User
from app.models.device import Device

router = APIRouter(prefix="/event-buttons", tags=["EventButtons"])


@router.post("", response_model=EventButtonResponse, status_code=201)
def record_button_click(
    body: EventButtonCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    device = get_device_by_code(db, user_id=None, device_code=body.device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.is_active:
        raise HTTPException(status_code=403, detail="Device is inactive")

    event = create_event_button(
        db,
        user_id=device.user_id,
        device_id=device.id,
        time_button_click=body.time_button_click,
    )
    log_action(
        db,
        action="button_click",
        user_id=device.user_id,
        target_type="event_button",
        target_id=event.id,
        ip_address=request.client.host if request.client else None,
    )
    return EventButtonResponse(
        id=event.id,
        device_id=event.device_id,
        device_code=device.device_id,
        user_id=event.user_id,
        time_button_click=event.time_button_click,
        created_at=event.created_at,
    )


@router.get("", response_model=list[EventButtonResponse])
def list_button_events(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    events = get_events_by_user(db, current_user.id, limit)
    return [
        EventButtonResponse(
            id=e.id,
            device_id=e.device_id,
            device_code=e.device.device_id if e.device else str(e.device_id),
            user_id=e.user_id,
            time_button_click=e.time_button_click,
            created_at=e.created_at,
        )
        for e in events
    ]


@router.get("/today", response_model=TodayButtonStatusResponse)
def today_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    clicked, last_click, total = get_today_status(db, current_user.id)
    return TodayButtonStatusResponse(
        clicked_today=clicked,
        last_click_at=last_click,
        total_today=total,
    )
