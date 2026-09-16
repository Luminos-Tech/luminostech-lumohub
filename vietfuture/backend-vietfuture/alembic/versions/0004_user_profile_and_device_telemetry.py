"""user profile + device telemetry

Revision ID: 0004_user_profile_and_device_telemetry
Revises: 001_create_check_noti
Create Date: 2026-09-03 10:00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0004_user_profile_and_device_telemetry"
down_revision: Union[str, None] = "001_create_check_noti"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users - 8 cột mới cho hồ sơ người cao tuổi và SOS
    op.add_column(
        "users",
        sa.Column(
            "elderly_count",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )
    op.add_column("users", sa.Column("elderly_name", sa.String(150), nullable=True))
    op.add_column("users", sa.Column("elderly_name_2", sa.String(150), nullable=True))
    op.add_column("users", sa.Column("elderly_phone", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("elderly_phone_2", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("neighbor_name", sa.String(150), nullable=True))
    op.add_column("users", sa.Column("neighbor_phone", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("address", sa.String(255), nullable=True))

    # Devices - 6 cột mới cho telemetry Hub / wearable
    op.add_column("devices", sa.Column("battery_level", sa.SmallInteger(), nullable=True))
    op.add_column(
        "devices",
        sa.Column(
            "fall_detected",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column("devices", sa.Column("last_fall_at", sa.TIMESTAMP(), nullable=True))
    op.add_column(
        "devices",
        sa.Column("activity_minutes_today", sa.Integer(), nullable=True),
    )
    op.add_column(
        "devices", sa.Column("last_activity_at", sa.TIMESTAMP(), nullable=True)
    )
    op.add_column(
        "devices", sa.Column("telemetry_updated_at", sa.TIMESTAMP(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("devices", "telemetry_updated_at")
    op.drop_column("devices", "last_activity_at")
    op.drop_column("devices", "activity_minutes_today")
    op.drop_column("devices", "last_fall_at")
    op.drop_column("devices", "fall_detected")
    op.drop_column("devices", "battery_level")
    op.drop_column("users", "address")
    op.drop_column("users", "neighbor_phone")
    op.drop_column("users", "neighbor_name")
    op.drop_column("users", "elderly_phone_2")
    op.drop_column("users", "elderly_phone")
    op.drop_column("users", "elderly_name_2")
    op.drop_column("users", "elderly_name")
    op.drop_column("users", "elderly_count")
