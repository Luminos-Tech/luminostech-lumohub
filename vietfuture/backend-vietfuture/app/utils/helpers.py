from datetime import datetime, timezone
from app.utils.timezone import as_local


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def format_vn_datetime(dt: datetime) -> str:
    """Format datetime in Vietnamese style."""
    return as_local(dt).strftime("%H:%M ngày %d/%m/%Y")


def safe_int(val, default: int = 0) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default
