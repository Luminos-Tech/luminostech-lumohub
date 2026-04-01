from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from app.db.session import get_db
from app.schemas.event import EventResponse
from app.crud.event import get_events_by_user
from app.services.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.get("", response_model=List[EventResponse])
def view_calendar(
    view: str = "month",
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return events for calendar view filtered by date range."""
    return get_events_by_user(db, current_user.id, start=start, end=end, limit=500)
