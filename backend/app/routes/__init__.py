from fastapi import APIRouter
from app.routes import auth, users, events, calendar, reminders, notifications, admin, lumo, devices, event_buttons

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(events.router)
api_router.include_router(calendar.router)
api_router.include_router(reminders.router)
api_router.include_router(notifications.router)
api_router.include_router(admin.router)
api_router.include_router(lumo.router)
api_router.include_router(devices.router)
api_router.include_router(event_buttons.router)
