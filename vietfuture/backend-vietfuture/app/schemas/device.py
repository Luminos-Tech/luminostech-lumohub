from pydantic import Field, field_validator
from app.schemas.base import APIModel as BaseModel
from app.utils.timezone import incoming_datetime
from datetime import datetime
from typing import Optional
from typing import Literal
from pydantic import model_validator
import re


class DeviceCreateRequest(BaseModel):
    device_id: str  # exactly 4 digits

    @field_validator("device_id")
    @classmethod
    def normalize_device_id(cls, value: str) -> str:
        code = value.strip()
        if re.fullmatch(r"[0-9]{1,4}", code) is None:
            raise ValueError("Device code must contain 1 to 4 digits")
        return code.zfill(4)


class DeviceUpdateRequest(BaseModel):
    is_active: bool | None = None


class DeviceCommandRequest(BaseModel):
    action: Literal["play_sound", "stop_audio"]
    sound: Literal["beep", "greeting", "checkin"] | None = None

    @model_validator(mode="after")
    def check_sound(self):
        if self.action == "play_sound" and self.sound is None:
            raise ValueError("sound is required for play_sound")
        if self.action == "stop_audio" and self.sound is not None:
            raise ValueError("stop_audio does not accept a sound")
        return self


class DeviceControlStatus(BaseModel):
    connected: bool
    audio_control: bool
    firmware_version: str | None = None
    logs_enabled: bool = False


class DeviceCommandResponse(BaseModel):
    request_id: str
    status: Literal["completed", "stopped"]


class DeviceLogEntry(BaseModel):
    sequence: int
    received_at: datetime
    level: Literal["I", "W", "E"]
    tag: str
    message: str
    uptime_ms: int | None = None


class DeviceLogTarget(BaseModel):
    id: int
    device_id: str


class DeviceLogsResponse(BaseModel):
    stream_id: str
    cursor: int
    connected: bool
    supported: bool
    entries: list[DeviceLogEntry]


class DeviceTelemetryRequest(BaseModel):
    """Used by the Hub / wearable to push last-known telemetry.
    All fields optional; only the ones supplied are written."""

    battery_level: Optional[int] = Field(default=None, ge=0, le=100)
    fall_detected: Optional[bool] = None
    last_fall_at: Optional[datetime] = None
    activity_minutes_today: Optional[int] = Field(default=None, ge=0)
    last_activity_at: Optional[datetime] = None

    @field_validator("last_fall_at", "last_activity_at")
    @classmethod
    def normalize_datetime(cls, value: Optional[datetime]) -> Optional[datetime]:
        return incoming_datetime(value) if value is not None else None


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
