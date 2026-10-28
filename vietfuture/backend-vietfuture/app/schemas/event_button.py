from pydantic import field_validator
from app.schemas.base import APIModel as BaseModel
from app.utils.timezone import incoming_datetime
from datetime import datetime


class EventButtonCreateRequest(BaseModel):
    device_id: str  # 4-digit code string, e.g. "1234"
    time_button_click: datetime

    @field_validator("time_button_click")
    @classmethod
    def normalize_datetime(cls, value: datetime) -> datetime:
        return incoming_datetime(value)


class EventButtonResponse(BaseModel):
    id: int
    device_id: int
    device_code: str
    user_id: int
    time_button_click: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class TodayButtonStatusResponse(BaseModel):
    clicked_today: bool
    last_click_at: datetime | None
    total_today: int
