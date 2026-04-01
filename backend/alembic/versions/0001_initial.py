"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-03-31 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("full_name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("role", sa.String(30), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "events",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("start_time", sa.TIMESTAMP, nullable=False),
        sa.Column("end_time", sa.TIMESTAMP, nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="scheduled"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("color", sa.String(30), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_events_user_id", "events", ["user_id"])

    op.create_table(
        "reminders",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("event_id", sa.BigInteger, sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("remind_before_minutes", sa.Integer, nullable=False),
        sa.Column("channel", sa.String(30), nullable=False, server_default="web"),
        sa.Column("is_sent", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("sent_at", sa.TIMESTAMP, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_id", sa.BigInteger, sa.ForeignKey("events.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("channel", sa.String(30), nullable=False, server_default="web"),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
        sa.Column("read_at", sa.TIMESTAMP, nullable=True),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    op.create_table(
        "system_logs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("target_id", sa.BigInteger, nullable=True),
        sa.Column("details", sa.Text, nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.Text, nullable=False, unique=True),
        sa.Column("expires_at", sa.TIMESTAMP, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "admin_actions",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("admin_user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("target_id", sa.BigInteger, nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("admin_actions")
    op.drop_table("user_sessions")
    op.drop_table("system_logs")
    op.drop_table("notifications")
    op.drop_table("reminders")
    op.drop_table("events")
    op.drop_table("users")
