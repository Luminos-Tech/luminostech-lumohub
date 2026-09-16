from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Elderly profile + SOS contacts (0.12.0)
    address: Optional[str] = None
    elderly_count: int = 1
    elderly_name: Optional[str] = None
    elderly_name_2: Optional[str] = None
    elderly_phone: Optional[str] = None
    elderly_phone_2: Optional[str] = None
    neighbor_name: Optional[str] = None
    neighbor_phone: Optional[str] = None

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

    # Elderly profile + SOS contacts (0.12.0)
    address: Optional[str] = Field(default=None, max_length=255)
    elderly_count: Optional[int] = Field(default=None, ge=1, le=2)
    elderly_name: Optional[str] = Field(default=None, max_length=150)
    elderly_name_2: Optional[str] = Field(default=None, max_length=150)
    elderly_phone: Optional[str] = Field(default=None, max_length=20)
    elderly_phone_2: Optional[str] = Field(default=None, max_length=20)
    neighbor_name: Optional[str] = Field(default=None, max_length=150)
    neighbor_phone: Optional[str] = Field(default=None, max_length=20)


class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str


class AdminUserUpdateRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
