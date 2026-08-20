# LUMO Hub

LUMO Hub is an assistive-technology project by Luminos Tech. The product vision is an AI companion ecosystem for older adults and people with disabilities: simple voice interaction, calendar and reminder support, family connection, and privacy-conscious safety monitoring without cameras.

This repository contains the current software platform and an ESP32 Hub prototype. The project proposal also describes future hardware, wearable fall detection, private AI infrastructure, care-organization pilots, and insurance distribution. Those proposal items are marked as roadmap items below and must not be presented as completed features.

## Current Status

Implemented in this repository:

- FastAPI REST API with PostgreSQL/SQLAlchemy models, Alembic migrations, JWT authentication, and admin operations.
- Events, calendar views, reminders, in-app notifications, Web Push subscriptions, devices, and physical event-button records.
- AI text/audio endpoints and LUMO WebSockets for text, STT, LLM, and TTS flows.
- Next.js dashboard for calendar, events, notifications, devices, settings, and administration.
- ESP-IDF firmware for the current ESP32 Hub prototype, including Wi-Fi, microphone/recording, OLED, I2S audio, buttons, and HTTP integration.

Roadmap or proposal-level capabilities include the production 4G Hub, nRF52840 + MPU6050 BLE fall-detection wearable, activity trend analytics, abnormal-silence escalation, self-hosted private LLM infrastructure, clinical validation, and insurance integration.

## Product Direction

The intended experience is voice-first and accessible: an older adult should not need to learn a complex application or carry a smartphone for the core interaction. A physical check-in button, scheduled family voice recordings, reminders, and conversational prompts are designed to support independence and reduce isolation.

The proposal's planned wearable uses a six-axis IMU and a three-phase fall-detection algorithm (free fall -> impact -> prolonged immobility). Its targets are BLE 5.0, a CR2450 battery lasting one to three years, IP67 protection, and a lightweight non-medical design. These are targets requiring hardware validation, pilot data, certification, and production testing.

The proposal positions the product for B2C, B2B, and B2B2C distribution through families, nursing homes, disability support organizations, and insurance add-on services. The proposal prices are planning assumptions, not audited commercial commitments.

## Architecture

```text
ESP32 LUMO Hub / future wearable
          | WebSocket, HTTP, BLE (roadmap)
          v
FastAPI backend :8000 ---- PostgreSQL :5432
          |
          +-- REST API (/api/v1)
          +-- LUMO AI and audio pipelines
          +-- WebSockets (/ws/lumo, /ws/stream)
          +-- APScheduler reminder/session jobs
          +-- Web Push and device delivery
          ^
Next.js frontend :3000
  same-origin /api/v1 proxy -> INTERNAL_API_URL
```

Backend entry point: `backend/app/main.py` (`app.main:app`). The application creates database tables and starts APScheduler in its lifespan.

Firmware entry point: `Lumo/Lumo-LuminosTech/main/Lumo-LuminosTech.c` with modules under `main/{wifi,http_api,mic,record,audio,oled,button}`.

## Repository Layout

<<<<<<< HEAD
```text
backend/                         FastAPI application
  app/routes/                    REST routes
  app/models/                    SQLAlchemy models
  app/schemas/                   Pydantic schemas
  app/crud/                      Database operations
  app/tasks/scheduler.py        Reminder and session jobs
  app/websocket/                 Device and TTS WebSockets
  alembic/                       Database migrations
frontend-web/                    Next.js application
  src/app/                       App Router pages and proxy routes
  src/features/                  API modules
  src/store/                     Zustand stores
  src/components/                UI components
Lumo/Lumo-LuminosTech/           ESP-IDF firmware
docs/                            Technical notes and library documentation
docker-compose.yml               Production-like local stack
docker-compose.dev.yml           Hot-reload development stack
AGENTS.md                        Agent and architecture guidance
MCP_LUMOHUB_SETUP.md             Project MCP setup
=======
## Công nghệ sử dụng

### Backend

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| Python | 3.12 | Ngôn ngữ lập trình |
| FastAPI | 0.111.0 | Web framework, hỗ trợ async |
| Uvicorn | 0.29.0 | ASGI server |
| SQLAlchemy | 2.0.30 | ORM |
| PostgreSQL | 16 | Cơ sở dữ liệu |
| Alembic | 1.13.1 | Database migration |
| Pydantic | 2.7.1 | Validation & serialization |
| python-jose | 3.3.0 | JWT token (HS256) |
| passlib[bcrypt] | 1.7.4 | Password hashing |
| google-genai | 1.11.0 | Gemini API (LLM + TTS) |
| groq | ≥0.12.0 | Groq API (Whisper STT) |
| APScheduler | 3.10.4 | Task scheduling |
| httpx | 0.28.1 | HTTP client |

### Frontend

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| Next.js | 14.2.29 | React framework (App Router) |
| React | 18.3.1 | UI library |
| TypeScript | 5.4.5 | Type-safe JavaScript |
| Tailwind CSS | 3.4.3 | CSS framework |
| Zustand | 4.5.2 | State management |
| react-hook-form | 7.51.5 | Form handling |
| zod | 3.23.8 | Schema validation |
| @fullcalendar | 6.1.11 | Calendar UI |
| axios | 1.7.2 | HTTP client |
| lucide-react | 0.383.0 | Icons |
| sonner | 2.0.7 | Toast notifications |
| date-fns | 3.6.0 | Date utilities |

### Infrastructure

- Docker & Docker Compose
- PostgreSQL 16 Alpine

---

## Cấu trúc dự án

```
lumohub/
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── main.py              # Entry point
│   │   ├── core/                # Config & security
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── crud/                # Database operations
│   │   │   ├── user.py
│   │   │   ├── event.py
│   │   │   ├── reminder.py
│   │   │   ├── notification.py
│   │   │   ├── device.py
│   │   │   ├── event_button.py
│   │   │   ├── session.py
│   │   │   └── log.py
│   │   ├── db/                  # Database setup
│   │   │   ├── session.py
│   │   │   ├── init_db.py
│   │   │   └── seed.py
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── event.py
│   │   │   ├── reminder.py
│   │   │   ├── notification.py
│   │   │   ├── device.py
│   │   │   ├── event_button.py
│   │   │   ├── user_session.py
│   │   │   ├── system_log.py
│   │   │   └── admin_action.py
│   │   ├── routes/              # API endpoints
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── events.py
│   │   │   ├── reminders.py
│   │   │   ├── notifications.py
│   │   │   ├── calendar.py
│   │   │   ├── devices.py
│   │   │   ├── event_buttons.py
│   │   │   ├── admin.py
│   │   │   └── lumo.py
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/            # Dependencies
│   │   ├── tasks/               # Background tasks
│   │   │   └── scheduler.py
│   │   ├── utils/               # Utilities
│   │   └── websocket/           # WebSocket handlers
│   │       ├── manager.py
│   │       ├── routes.py
│   │       └── tts_stream.py
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
│
├── frontend-web/                # Next.js frontend
│   ├── src/
│   │   ├── app/                 # App Router
│   │   │   ├── (auth)/          # Login & register
│   │   │   ├── (dashboard)/     # Protected pages
│   │   │   │   ├── dashboard/   # Health summary, check-in, calendar
│   │   │   │   ├── calendar/    # FullCalendar view
│   │   │   │   ├── events/      # Event list & details
│   │   │   │   ├── notifications/
│   │   │   │   ├── settings/    # Profile, devices, event-buttons
│   │   │   │   └── admin/       # User management, logs, WS test
│   │   │   ├── api/             # API proxy & server routes
│   │   │   └── globals.css      # All component & layout styles
│   │   ├── components/          # Reusable UI components
│   │   │   ├── layout/          # Topbar, Sidebar, BottomNav, Footer
│   │   │   ├── calendar/        # CalendarView, EventFormModal, AI Import
│   │   │   ├── devices/         # AddDeviceModal
│   │   │   ├── notifications/   # Bell, modal, push prompt
│   │   │   ├── auth/            # Login/Register forms, AuthModal
│   │   │   ├── admin/           # User management modals
│   │   │   ├── common/          # Button, Input, Modal, Spinner
│   │   │   ├── profile/         # Avatar, ProfileForm
│   │   │   ├── icons/           # LumoDeviceIcons
│   │   │   └── ui/              # LoadingSpinner
│   │   ├── features/            # API call functions by domain
│   │   ├── hooks/               # useLumoWebSocket
│   │   ├── lib/                 # api client, env, utils, push, voice
│   │   ├── store/               # Zustand stores (auth, events, devices, etc.)
│   │   └── types/               # TypeScript type definitions
│   ├── public/                  # Static assets & PWA manifest
│   ├── package.json
│   └── tailwind.config.js
│
├── Lumo/                        # ESP32 firmware
│   └── Lumo-LuminosTech/
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── test_audio.py                # Audio pipeline test
├── test_ws.py                   # WebSocket test
└── README.md
```

## Backend API

All REST routes use the `/api/v1` prefix and Bearer JWT authentication unless noted.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` |
| Users | `GET/PATCH /users/me`; `PATCH /users/me/password` |
| Events | CRUD `/events`; `GET /calendar`; `POST /events/extract` |
| Reminders | `GET /reminders`; CRUD reminder routes under `/events/{event_id}/reminders` and `/reminders/{reminder_id}` |
| Notifications | `GET /notifications`; read-one and read-all patches |
| Devices | CRUD `/devices`; `GET /devices/qr` |
| Event buttons | `POST/GET /event-buttons`; `GET /event-buttons/today` |
| Push | `/push/public-key`, subscribe/unsubscribe, send, and status |
| Admin | User, password, lock, role, logs, events, and device commands under `/admin` |
| LUMO | `/lumo/`, `version1`, `version2`, `version3`, wake-word verification, and `/lumo/audio/` |
| Check notifications | CRUD `/check-noti` |

Health check: `GET /health` returns `{"status":"ok","service":"LumoHub API"}`.

## Reminder Flow

1. A user creates an event and optional reminder.
2. `check_reminders` runs every minute and evaluates `event.start_time - remind_before_minutes`.
3. A triggered reminder creates a notification and is marked sent.
4. `lumo` reminders are forwarded through the WebSocket manager to connected devices.
5. `cleanup_expired_sessions` removes expired refresh sessions hourly.

## LUMO WebSocket Protocol

Basic device connection:

```text
ws://localhost:8000/ws/lumo?device_id=<device-id>
```

Audio/TTS stream:

```text
ws://localhost:8000/ws/stream?device_id=<device-id>
```

The stream accepts JSON text or binary UTF-8 frames:

```json
{"action":"tts","text":"Your reminder text"}
{"action":"stt_tts","audio_b64":"<base64 WAV>"}
```

Responses include binary WAV audio and JSON messages such as `{"type":"done"}` or `{"type":"error","message":"..."}`. The current implementation uses a 24 kHz mono 16-bit WAV output for TTS.

## Technology

Backend: Python, FastAPI 0.111, Uvicorn, SQLAlchemy 2, PostgreSQL 16, Alembic, Pydantic 2, JWT, bcrypt, APScheduler, Google GenAI, Groq, HTTPX, pywebpush, Pillow, and qrcode.

Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, Axios, FullCalendar, Zod, react-hook-form, Sonner, Lucide React, date-fns, and html5-qrcode.

Firmware: ESP-IDF/C, FreeRTOS, Wi-Fi, HTTP client/server, I2S audio, OLED, GPIO buttons, SNTP, and cJSON. The planned wearable is based on nRF52840 + MPU6050, but it is not part of the current firmware tree.

## Configuration

Backend variables are documented in `backend/.env.example`:

```env
DATABASE_URL=postgresql://lumohub:lumohub123@localhost:5432/lumohub_db
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
GEMINI_API_KEY=
GROQ_API_KEY=
PERPLEXITY_API_KEY=
GOOGLE_API_KEY=
TAVILY_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

The frontend proxy uses `INTERNAL_API_URL`; see `frontend-web/.env.local.example`. WebSocket clients use `NEXT_PUBLIC_WS_URL` when configured.

Never commit `.env` files or real credentials.

## Running with Docker

```bash
docker compose up --build
```

Open `http://localhost:3000`, backend docs at `http://localhost:8000/docs`, and health at `http://localhost:8000/health`.

For hot reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Running Without Docker

Backend (PowerShell):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend-web
npm ci
Copy-Item .env.local.example .env.local
npm run dev
```

PostgreSQL must be available and `DATABASE_URL` must point to it. The application creates tables at startup; use Alembic explicitly when applying migrations to an existing database.

## Validation

```powershell
python -m compileall -q backend\app
cd frontend-web
npm run lint
npm run build
```

Firmware requires an installed ESP-IDF toolchain and the correct board configuration. API-dependent AI, Web Push, database, and device tests require their respective services and credentials.

## Security and Product Limits

- Passwords are hashed with bcrypt; JWT access and refresh sessions are stored and validated by the backend.
- Admin routes require admin authorization; user routes are scoped to the current user.
- Pydantic validation, SQLAlchemy parameters, and configured CORS provide baseline protections, not a complete security review.
- Current AI routes call external providers. Do not describe the current deployment as fully self-hosted or third-party-free.
- LUMO Hub is a prototype and is not currently a certified medical device, emergency-response service, or diagnostic system.
- Any fall-detection accuracy, battery life, IP67 rating, cognitive analysis, or insurance savings claim requires measured evidence and appropriate regulatory review.

## MCP and Agent Setup

See [MCP_LUMOHUB_SETUP.md](MCP_LUMOHUB_SETUP.md) for the project-local MCP configuration and progressive memory files. See [AGENTS.md](AGENTS.md) for source-verified architecture, roadmap boundaries, and coding-agent rules.

## License

Copyright 2026 Luminos Tech. All rights reserved unless a separate license is provided.
