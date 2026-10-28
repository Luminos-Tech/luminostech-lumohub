from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

connect_args = {}
if make_url(settings.DATABASE_URL).get_backend_name() == "postgresql":
    # Legacy TIMESTAMP columns store UTC without an offset. Keep database
    # defaults and casts in UTC even when the application container uses UTC+7.
    connect_args["options"] = "-c timezone=UTC"
engine = create_engine(
    settings.DATABASE_URL, echo=False, pool_pre_ping=True, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
