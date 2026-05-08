"""create check_noti table

Revision ID: 001_create_check_noti
Revises:
Create Date: 2026-05-07

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_create_check_noti"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "check_noti",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device", sa.BigInteger(), nullable=False),
        sa.Column("state", sa.BigInteger(), nullable=False),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device", name="uq_check_noti_device"),
        sa.Index("ix_check_noti_device", "device"),
        sa.CheckConstraint("state >= 1 AND state <= 30", name="ck_check_noti_state_range"),
    )


def downgrade() -> None:
    op.drop_table("check_noti")
