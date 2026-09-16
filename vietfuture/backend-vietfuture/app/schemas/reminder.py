from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ReminderCreateRequest(BaseModel):
    remind_before_minutes: int
    channel: str = "web"


class ReminderUpdateRequest(BaseModel):
    remind_before_minutes: Optional[int] = None
    channel: Optional[str] = None


class ReminderResponse(BaseModel):
    id: int
    event_id: int
    remind_before_minutes: int
    channel: str
    is_sent: bool
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
