from datetime import datetime
from sqlalchemy import BigInteger, CheckConstraint, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class CheckNoti(Base):
    __tablename__ = "check_noti"
    __table_args__ = (
        UniqueConstraint("device", name="uq_check_noti_device"),
        Index("ix_check_noti_device", "device"),
        CheckConstraint("state >= 1 AND state <= 30", name="ck_check_noti_state_range"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    state: Mapped[int] = mapped_column(BigInteger, nullable=False)
    date: Mapped[datetime] = mapped_column(nullable=False)
