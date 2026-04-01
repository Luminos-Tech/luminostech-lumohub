from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.user_session import UserSession
from typing import Optional
from datetime import datetime, timezone, timedelta
from app.core.config import settings


def create_session(db: Session, user_id: int, token: str) -> UserSession:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    session = UserSession(user_id=user_id, token=token, expires_at=expires_at)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session_by_token(db: Session, token: str) -> Optional[UserSession]:
    return db.execute(select(UserSession).where(UserSession.token == token)).scalar_one_or_none()


def delete_session(db: Session, session: UserSession) -> None:
    db.delete(session)
    db.commit()


def delete_user_sessions(db: Session, user_id: int) -> None:
    sessions = db.execute(select(UserSession).where(UserSession.user_id == user_id)).scalars().all()
    for s in sessions:
        db.delete(s)
    db.commit()
