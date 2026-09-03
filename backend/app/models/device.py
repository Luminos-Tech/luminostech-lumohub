from sqlalchemy import BigInteger, Boolean, Integer, SmallInteger, String, TIMESTAMP, UniqueConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("user_id", "device_id", name="uq_user_device"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[str] = mapped_column(String(4), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[object] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at: Mapped[object] = mapped_column(
        TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Telemetry (Hub + wearable) - added in 0.12.0
    battery_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 0-100
    fall_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    last_fall_at: Mapped[object | None] = mapped_column(TIMESTAMP, nullable=True)
    activity_minutes_today: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_activity_at: Mapped[object | None] = mapped_column(TIMESTAMP, nullable=True)
    telemetry_updated_at: Mapped[object | None] = mapped_column(TIMESTAMP, nullable=True)

    event_buttons: Mapped[list["EventButton"]] = relationship("EventButton", back_populates="device")
