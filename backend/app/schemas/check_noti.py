from datetime import datetime
from pydantic import BaseModel, Field


class CheckNotiCreateRequest(BaseModel):
    device: int
    state: int = Field(..., ge=1, le=30)


class CheckNotiUpdateRequest(BaseModel):
    state: int = Field(..., ge=1, le=30)


class CheckNotiResponse(BaseModel):
    device: int
    state: int
    date: datetime

    model_config = {"from_attributes": True}
