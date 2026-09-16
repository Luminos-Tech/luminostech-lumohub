"""add event_buttons table

Revision ID: 0003_add_event_buttons
Revises: 0002_add_devices
Create Date: 2026-04-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "0003_add_event_buttons"
down_revision = "0002_add_devices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "event_buttons",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "device_id",
            sa.BigInteger,
            sa.ForeignKey("devices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.BigInteger,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("time_button_click", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_event_buttons_device_id", "event_buttons", ["device_id"])
    op.create_index("ix_event_buttons_user_id", "event_buttons", ["user_id"])
    op.create_index(
        "ix_event_buttons_user_date",
        "event_buttons",
        ["user_id", "time_button_click"],
    )


def downgrade() -> None:
    op.drop_index("ix_event_buttons_user_date", table_name="event_buttons")
    op.drop_index("ix_event_buttons_user_id", table_name="event_buttons")
    op.drop_index("ix_event_buttons_device_id", table_name="event_buttons")
    op.drop_table("event_buttons")
