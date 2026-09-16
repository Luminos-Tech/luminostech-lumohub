from pydantic import BaseModel
from datetime import datetime


class EventButtonCreateRequest(BaseModel):
    device_id: str  # 4-digit code string, e.g. "1234"
    time_button_click: datetime


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
