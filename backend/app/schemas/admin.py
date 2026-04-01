from pydantic import BaseModel, EmailStr
from datetime import datetime


class AdminCreateUserRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "user"


class AdminResetPasswordRequest(BaseModel):
    new_password: str


class SystemLogResponse(BaseModel):
    id: int
    user_id: int | None
    action: str
    target_type: str | None
    target_id: int | None
    details: str | None
    ip_address: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminActionResponse(BaseModel):
    id: int
    admin_user_id: int
    action: str
    target_type: str | None
    target_id: int | None
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True
