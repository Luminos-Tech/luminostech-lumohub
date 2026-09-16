from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from datetime import datetime, timezone


def seed():
    db: Session = SessionLocal()
    try:
        if db.query(User).filter(User.email == "admin@lumohub.com").first():
            print("⚠️ Seed data already exists. Skipping.")
            return

        admin = User(
            full_name="Admin LumoHub",
            email="admin@lumohub.com",
            password_hash=get_password_hash("Admin@123"),
            role="admin",
            is_active=True,
        )
        demo_user = User(
            full_name="Demo User",
            email="demo@lumohub.com",
            password_hash=get_password_hash("Demo@123"),
            role="user",
            is_active=True,
        )
        db.add_all([admin, demo_user])
        db.commit()
        print("✅ Seed data inserted.")
        print("   admin@lumohub.com / Admin@123")
        print("   demo@lumohub.com  / Demo@123")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
