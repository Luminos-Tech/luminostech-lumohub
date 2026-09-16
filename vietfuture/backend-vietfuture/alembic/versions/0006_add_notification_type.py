"""add notification_type to notifications

Revision ID: 0006_add_notification_type
Revises: 0005_device_checkin_at
Create Date: 2026-09-16 16:35:00.000000

Thêm cột notification_type vào bảng notifications để phân biệt
giữa thông báo cảnh báo (alert) và thông báo thường (normal).
Dùng để hiển thị toast khác nhau ở frontend.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0006_add_notification_type"
down_revision: Union[str, None] = "0005_device_checkin_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("notification_type", sa.String(30), nullable=False, server_default="normal"),
    )


def downgrade() -> None:
    op.drop_column("notifications", "notification_type")
