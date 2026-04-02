from pydantic import BaseModel
from datetime import datetime


class DeviceCreateRequest(BaseModel):
    device_id: str  # exactly 4 digits


class DeviceUpdateRequest(BaseModel):
    is_active: bool | None = None


class DeviceResponse(BaseModel):
    id: int
    user_id: int
    device_id: str  # exactly 4 digits
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
