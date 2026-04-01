from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from app.db.session import get_db
from app.schemas.event import EventCreateRequest, EventUpdateRequest, EventResponse
from app.crud.event import (get_event, get_events_by_user, create_event,
                             update_event, delete_event)
from app.crud.log import log_action
from app.services.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/events", tags=["Events"])


@router.get("", response_model=List[EventResponse])
def list_events(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_events_by_user(db, current_user.id, start=start, end=end, skip=skip, limit=limit)


@router.get("/{event_id}", response_model=EventResponse)
def get_one_event(event_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_active_user)):
    event = get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return event


@router.post("", response_model=EventResponse, status_code=201)
def create_new_event(body: EventCreateRequest, request: Request,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_active_user)):
    event = create_event(
        db,
        user_id=current_user.id,
        title=body.title,
        description=body.description,
        location=body.location,
        start_time=body.start_time,
        end_time=body.end_time,
        priority=body.priority,
        color=body.color,
        reminders_data=body.reminders,
    )
    log_action(db, action="create_event", user_id=current_user.id,
               target_type="event", target_id=event.id,
               ip_address=request.client.host if request.client else None)
    return event


@router.patch("/{event_id}", response_model=EventResponse)
def update_one_event(event_id: int, body: EventUpdateRequest, request: Request,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_active_user)):
    event = get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    updated = update_event(db, event, **body.model_dump(exclude_none=True))
    log_action(db, action="update_event", user_id=current_user.id, target_type="event", target_id=event.id)
    return updated


@router.delete("/{event_id}", status_code=204)
def delete_one_event(event_id: int, request: Request,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_active_user)):
    event = get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    log_action(db, action="delete_event", user_id=current_user.id, target_type="event", target_id=event.id)
    delete_event(db, event)
