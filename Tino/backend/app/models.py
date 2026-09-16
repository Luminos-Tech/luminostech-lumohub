"""SQLAlchemy ORM models for the sample app."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.db import Base


class Item(Base):
    """A simple record used by the /items CRUD endpoints."""

    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
