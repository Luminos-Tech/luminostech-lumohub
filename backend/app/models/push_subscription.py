"""Push Subscription 模型 - 存储 Web Push VAPID 订阅信息"""
from sqlalchemy import BigInteger, String, Boolean, TIMESTAMP, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.db.session import Base


class PushSubscription(Base):
    """Web Push 订阅记录表"""
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # VAPID subscription 的 endpoint URL（唯一标识符）
    endpoint: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    # p256dh key（用于加密）
    p256dh: Mapped[str] = mapped_column(String(256), nullable=False)
    # Auth secret（用于加密）
    auth: Mapped[str] = mapped_column(String(128), nullable=False)
    # 订阅是否有效
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # 创建时间
    created_at: Mapped[object] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())
    # 最后使用时间
    last_used_at: Mapped[object] = mapped_column(TIMESTAMP, nullable=True)

    __table_args__ = (
        # 同一个用户可以有多个订阅（多设备）
        Index("ix_push_subs_user_active", "user_id", "is_active"),
    )
