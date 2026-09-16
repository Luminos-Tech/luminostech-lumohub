from sqlalchemy import BigInteger, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[object] = mapped_column(TIMESTAMP, nullable=False)
    created_at: Mapped[object] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="sessions")
