from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SystemLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminActionResponse(BaseModel):
    id: int
    admin_user_id: int
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
