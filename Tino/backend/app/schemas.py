"""Pydantic v2 schemas (request/response payloads)."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)


class ItemOut(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    # Pydantic v2 — read ORM objects directly
    model_config = ConfigDict(from_attributes=True)
