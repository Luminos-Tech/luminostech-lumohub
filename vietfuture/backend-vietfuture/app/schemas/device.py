from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class DeviceCreateRequest(BaseModel):
    device_id: str  # exactly 4 digits


class DeviceUpdateRequest(BaseModel):
    is_active: bool | None = None


class DeviceTelemetryRequest(BaseModel):
    """Used by the Hub / wearable to push last-known telemetry.
    All fields optional; only the ones supplied are written."""

    battery_level: Optional[int] = Field(default=None, ge=0, le=100)
    fall_detected: Optional[bool] = None
    last_fall_at: Optional[datetime] = None
    activity_minutes_today: Optional[int] = Field(default=None, ge=0)
    last_activity_at: Optional[datetime] = None


class DeviceResponse(BaseModel):
    id: int
    user_id: int
    device_id: str  # exactly 4 digits
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Telemetry (0.12.0) - older backends may omit these
    battery_level: Optional[int] = None
    fall_detected: Optional[bool] = None
    last_fall_at: Optional[datetime] = None
    activity_minutes_today: Optional[int] = None
    last_activity_at: Optional[datetime] = None
    telemetry_updated_at: Optional[datetime] = None

    # Device check-in timestamp (0.13.0) - device-owned, independent of user
    # Thời điểm người dùng bấm nút vật lý trên Hub lần cuối cùng.
    last_checkin_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
