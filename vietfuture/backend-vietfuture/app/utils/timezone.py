"""Vietnam time at API boundaries; UTC for existing database timestamps."""

from datetime import datetime, timedelta, timezone


VIETNAM_TIMEZONE = timezone(timedelta(hours=7), name="Asia/Ho_Chi_Minh")


def local_now() -> datetime:
    return datetime.now(VIETNAM_TIMEZONE)


def as_utc(value: datetime) -> datetime:
    """Read a stored datetime. Legacy naive database values represent UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def as_local(value: datetime) -> datetime:
    return as_utc(value).astimezone(VIETNAM_TIMEZONE)


def incoming_datetime(value: datetime) -> datetime:
    """An API timestamp without an offset is Vietnam local time."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=VIETNAM_TIMEZONE)
    return value.astimezone(timezone.utc)


def database_datetime(value: datetime) -> datetime:
    """Normalize API input for legacy TIMESTAMP WITHOUT TIME ZONE columns."""
    return incoming_datetime(value).replace(tzinfo=None)


def today_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    start = as_local(now if now is not None else local_now()).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return start, start + timedelta(days=1)
