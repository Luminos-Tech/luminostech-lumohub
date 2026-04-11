from app.db.session import engine, Base
from app.models import user, event, reminder, notification, system_log, user_session, admin_action, device, event_button, push_subscription  # noqa: F401


def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created.")
