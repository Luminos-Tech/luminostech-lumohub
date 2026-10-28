from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_serializer

from app.utils.timezone import as_local


class APIModel(BaseModel):
    @field_serializer("*", check_fields=False, when_used="json")
    def serialize_datetime(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return as_local(value).isoformat()
        return value
