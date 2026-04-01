from sqlalchemy import BigInteger, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_time: Mapped[object] = mapped_column(TIMESTAMP, nullable=False)
    end_time: Mapped[object] = mapped_column(TIMESTAMP, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="scheduled")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    color: Mapped[str | None] = mapped_column(String(30), nullable=True, default="#3B82F6")
    created_at: Mapped[object] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at: Mapped[object] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="events")
    reminders = relationship("Reminder", back_populates="event", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="event")
