from sqlalchemy import BigInteger, Boolean, Integer, String, TIMESTAMP, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    remind_before_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[str] = mapped_column(String(30), nullable=False, default="web")
    is_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sent_at: Mapped[object | None] = mapped_column(TIMESTAMP, nullable=True)
    created_at: Mapped[object] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())

    # Relationships
    event = relationship("Event", back_populates="reminders")
