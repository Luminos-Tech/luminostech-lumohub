from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.reminder import ReminderCreateRequest, ReminderUpdateRequest, ReminderResponse
from app.crud.reminder import (create_reminder, get_reminder,
                                update_reminder, delete_reminder, get_reminders_by_user)
from app.crud.event import get_event
from app.services.deps import get_current_active_user
from app.models.user import User

router = APIRouter(tags=["Reminders"])


@router.get("/reminders", response_model=List[ReminderResponse])
def list_my_reminders(db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_active_user)):
    return get_reminders_by_user(db, current_user.id)


@router.post("/events/{event_id}/reminders", response_model=ReminderResponse, status_code=201)
def add_reminder(event_id: int, body: ReminderCreateRequest,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_active_user)):
    event = get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return create_reminder(db, event_id=event_id,
                            remind_before_minutes=body.remind_before_minutes,
                            channel=body.channel)


@router.patch("/reminders/{reminder_id}", response_model=ReminderResponse)
def edit_reminder(reminder_id: int, body: ReminderUpdateRequest,
                   db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_active_user)):
    reminder = get_reminder(db, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    if reminder.event.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return update_reminder(db, reminder, **body.model_dump(exclude_none=True))


@router.delete("/reminders/{reminder_id}", status_code=204)
def remove_reminder(reminder_id: int, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_active_user)):
    reminder = get_reminder(db, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    if reminder.event.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    delete_reminder(db, reminder)
