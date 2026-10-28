from pydantic import field_validator, model_validator
from app.schemas.base import APIModel as BaseModel
from app.utils.timezone import incoming_datetime
from typing import Optional, List
from datetime import datetime


class ReminderInEvent(BaseModel):
    remind_before_minutes: int
    channel: str = "web"


class EventCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime
    end_time: datetime
    priority: str = "normal"
    color: Optional[str] = "#3B82F6"
    reminders: Optional[List[ReminderInEvent]] = []

    @field_validator("start_time", "end_time")
    @classmethod
    def normalize_datetime(cls, value: datetime) -> datetime:
        return incoming_datetime(value)

    @model_validator(mode="after")
    def check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class EventUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    color: Optional[str] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def normalize_datetime(cls, value: Optional[datetime]) -> Optional[datetime]:
        return incoming_datetime(value) if value is not None else None


class ReminderResponse(BaseModel):
    id: int
    event_id: int
    remind_before_minutes: int
    channel: str
    is_sent: bool
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EventResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    priority: str
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    reminders: List[ReminderResponse] = []

    model_config = {"from_attributes": True}
