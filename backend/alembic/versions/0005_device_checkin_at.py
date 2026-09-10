"""device check-in timestamp

Revision ID: 0005_device_checkin_at
Revises: 0004_user_profile_and_device_telemetry
Create Date: 2026-09-08 23:20:00

Thêm 1 cột trên bảng `devices` để ghi nhận mốc điểm danh gần nhất
(check-in) của thiết bị Hub:

- `last_checkin_at`: thời điểm người dùng nhấn nút vật lý trên Hub lần
  cuối cùng. Thuộc về device, không phụ thuộc vào user sở hữu.

Khi firmware bấm nút, nó POST lên backend để cập nhật timestamp này.
Không đếm số lần — chỉ ghi nhận "lần cuối cùng user tương tác với
thiết bị là khi nào", phục vụ kiểm tra thiết bị còn hoạt động và
phát hiện bất thường (abnormal silence) trong tương lai.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0005_device_checkin_at"
down_revision: Union[str, None] = "0004_user_profile_and_device_telemetry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column("last_checkin_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("devices", "last_checkin_at")
