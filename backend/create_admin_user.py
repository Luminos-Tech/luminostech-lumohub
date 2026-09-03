"""
Create or update the admin user admin@luminostech.tech directly in the database.

Why this script exists:
- The default seed in `backend/app/db/seed.py` creates `admin@lumohub.com`
  / `Demo@123`. When a teammate logs in with `admin@luminostech.tech` they
  receive a 401 ("Invalid email or password"), which surfaces in the
  frontend as a generic "Lỗi máy chủ" toast.
- Run this script once after `docker compose up` (or against an existing
  PostgreSQL) to make sure the canonical admin account exists with the
  expected password.

Usage:
    cd backend
    python create_admin_user.py
"""

import sys
from pathlib import Path

# Allow running the script from anywhere; add the backend folder to sys.path.
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.crud.user import get_user_by_email  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402

ADMIN_EMAIL = "admin@luminostech.tech"
ADMIN_PASSWORD = "Admin@123"
ADMIN_FULL_NAME = "Admin LuminosTech"
ADMIN_ROLE = "admin"


def main() -> int:
    if not settings.DATABASE_URL:
        print("❌ DATABASE_URL is not set. Did you copy backend/.env.example to backend/.env?")
        return 1

    print(f"🔌 Connecting to: {_safe_url(settings.DATABASE_URL)}")

    db = SessionLocal()
    try:
        existing = get_user_by_email(db, ADMIN_EMAIL)

        if existing:
            print(f"⚠️  User {ADMIN_EMAIL} already exists (id={existing.id}).")
            print("    Updating password_hash, full_name, role, is_active to ensure they match.")
            existing.password_hash = get_password_hash(ADMIN_PASSWORD)
            existing.full_name = ADMIN_FULL_NAME
            existing.role = ADMIN_ROLE
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            print(f"✅ Updated user {existing.email} (id={existing.id}, role={existing.role}).")
        else:
            print(f"ℹ️  No existing user for {ADMIN_EMAIL}. Creating new admin row.")
            user = User(
                full_name=ADMIN_FULL_NAME,
                email=ADMIN_EMAIL,
                password_hash=get_password_hash(ADMIN_PASSWORD),
                role=ADMIN_ROLE,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Created user {user.email} (id={user.id}, role={user.role}).")

        print()
        print("🔑 You can now log in with:")
        print(f"   email:    {ADMIN_EMAIL}")
        print(f"   password: {ADMIN_PASSWORD}")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"❌ Failed to create admin user: {exc}")
        return 1
    finally:
        db.close()


def _safe_url(url: str) -> str:
    """Hide credentials when printing the DATABASE_URL."""
    try:
        scheme, rest = url.split("://", 1)
        if "@" in rest:
            _, host_part = rest.split("@", 1)
            return f"{scheme}://***@{host_part}"
    except ValueError:
        pass
    return url


if __name__ == "__main__":
    raise SystemExit(main())
