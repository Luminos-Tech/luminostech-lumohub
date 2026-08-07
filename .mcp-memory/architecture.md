# Architecture

Backend entry point is `backend/app/main.py`; REST routes mount under `/api/v1`, WebSockets under `/ws`. SQLAlchemy models/migrations are in `backend/app/models` and `backend/alembic`. APScheduler checks reminders every minute and cleans expired sessions hourly. Next.js calls the same-origin `/api/v1` proxy, which forwards to `INTERNAL_API_URL`. ESP32 modules are under `Lumo/Lumo-LuminosTech/main`.
