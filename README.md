# LumoHub - Smart Calendar & IoT Event Management System

<p align="center">
  <strong>Powered by Luminos Tech</strong>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
  - [User Authentication](#user-authentication)
  - [Calendar & Events](#calendar--events)
  - [Reminders & Notifications](#reminders--notifications)
  - [LUMO AI Assistant](#lumo-ai-assistant)
  - [IoT Device Integration](#iot-device-integration)
  - [Admin Dashboard](#admin-dashboard)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Users](#users)
  - [Events](#events)
  - [Reminders](#reminders)
  - [Notifications](#notifications)
  - [Calendar](#calendar)
  - [Devices](#devices)
  - [Event Buttons](#event-buttons)
  - [LUMO AI](#lumo-ai)
  - [Admin](#admin)
- [WebSocket Protocol](#websocket-protocol)
- [Database Schema](#database-schema)
- [Configuration](#configuration)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Development Setup](#development-setup)
  - [Docker Deployment](#docker-deployment)
- [Frontend Guide](#frontend-guide)
- [ESP32 IoT Device](#esp32-iot-device)
- [LUMO AI Voice Pipeline](#lumo-ai-voice-pipeline)
- [Background Tasks](#background-tasks)
- [Security](#security)
- [License](#license)

---

## Overview

**LumoHub** is a full-stack smart calendar and event management system designed for the **Lumo LuminosTech** IoT device ecosystem. It provides:

- **Calendar management** with events, recurring reminders, and multi-channel notifications
- **AI-powered voice assistant "LUMO"** built on Gemini/Groq for natural voice interactions
- **ESP32 IoT device integration** via WebSocket for real-time text-to-speech and voice communication
- **Admin dashboard** for user management, device administration, and system monitoring
- **Mobile-friendly responsive web interface** built with Next.js and Tailwind CSS

The system connects physical IoT devices with cloud-based calendar intelligence, enabling users to interact with their schedules through voice commands on their ESP32-powered smart devices.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ESP32 Device                             │
│   (OLED Display + Microphone + Speaker + Physical Button)        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket (WSS)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (Port 8000)                  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ REST API     │  │ WebSocket    │  │ Background Tasks      │  │
│  │ (Auth, CRUD) │  │ (LUMO, TTS)  │  │ (APScheduler)         │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ LUMO AI      │  │ TTS Stream   │  │ Notification Engine  │  │
│  │ (Gemini/Groq)│  │ (Google TTS)  │  │                      │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ SQLAlchemy ORM
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PostgreSQL 16 (Port 5432)                      │
│                                                                   │
│  users | events | reminders | notifications |                    │
│  devices | event_buttons | user_sessions |                      │
│  system_logs | admin_actions                                     │
└─────────────────────────────────────────────────────────────────┘
                           ▲
                           │ Next.js API Proxy
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js Frontend (Port 3000)                  │
│                                                                   │
│  Dashboard | Calendar | Events | Notifications | Settings |     │
│  Admin Dashboard | WebSocket Tester                               │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User** creates an event via the web dashboard
2. **APScheduler** detects when a reminder is due and triggers a notification
3. **Notification** is saved to the database and sent via WebSocket to all connected clients
4. **LUMO device** receives the WebSocket message and speaks the event aloud using TTS
5. **User** can interact with LUMO via voice commands (STT → Gemini → TTS)
6. **Physical button** presses on the ESP32 device are logged and displayed in the web dashboard

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.11+ | Programming language |
| **FastAPI** | 0.111.0 | Web framework with async support |
| **Uvicorn** | ASGI | ASGI server |
| **Pydantic** | 2.7.1 | Data validation and serialization |
| **SQLAlchemy** | 2.0.30 | SQL ORM toolkit |
| **Alembic** | 1.13.1 | Database migrations |
| **PostgreSQL** | 16 | Relational database |
| **python-jose** | JWT | JWT token handling (HS256) |
| **passlib[bcrypt]** | Password hashing | Secure password storage |
| **google-genai** | 1.11.0 | Gemini API for LLM and TTS |
| **groq** | 0.11.0 | Groq API for Whisper STT |
| **APScheduler** | 3.10.4 | Background job scheduling |
| **email-validator** | Email validation | Input validation |

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14 | React framework with App Router |
| **React** | 18 | UI library |
| **TypeScript** | 5 | Type-safe JavaScript |
| **Tailwind CSS** | 3.4 | Utility-first CSS framework |
| **Zustand** | 4.5 | State management |
| **react-hook-form** | Form management | Form state handling |
| **zod** | Schema validation | Runtime type validation |
| **@fullcalendar** | Calendar | Calendar UI components |
| **axios** | HTTP client | API communication |
| **Lucide React** | Icons | Icon library |
| **Sonner** | Toasts | Toast notifications |
| **date-fns** | Date utilities | Date manipulation |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **docker-compose** | Multi-container orchestration |
| **PostgreSQL 16 Alpine** | Database container |

---

## Project Structure

```
lumohub/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app entry point
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic settings from .env
│   │   │   └── security.py            # JWT create/verify, password hashing
│   │   ├── crud/
│   │   │   ├── base.py                # Generic CRUD operations
│   │   │   ├── user.py                # User CRUD
│   │   │   ├── event.py               # Event CRUD
│   │   │   ├── reminder.py             # Reminder CRUD
│   │   │   ├── notification.py         # Notification CRUD
│   │   │   ├── device.py               # Device CRUD
│   │   │   └── event_button.py         # EventButton CRUD
│   │   ├── db/
│   │   │   ├── session.py              # SQLAlchemy async session factory
│   │   │   ├── init_db.py              # Database initialization
│   │   │   └── seed.py                 # Seed default admin/demo users
│   │   ├── models/
│   │   │   ├── __init__.py             # Exports all SQLAlchemy models
│   │   │   ├── user.py                 # User model (id, email, hashed_password, role)
│   │   │   ├── event.py                 # Event model (title, description, start/end, user_id)
│   │   │   ├── reminder.py              # Reminder model (type: web/mobile/lumo, event_id)
│   │   │   ├── notification.py         # Notification model (user_id, event_id, read)
│   │   │   ├── device.py                # Device model (code, name, user_id, ws_client)
│   │   │   ├── event_button.py          # EventButton model (device_id, event_id, pressed_at)
│   │   │   ├── user_session.py          # UserSession model (refresh tokens)
│   │   │   ├── system_log.py            # SystemLog model (audit trail)
│   │   │   └── admin_action.py          # AdminAction model
│   │   ├── routes/
│   │   │   ├── __init__.py              # APIRouter aggregation
│   │   │   ├── auth.py                  # /api/v1/auth/* endpoints
│   │   │   ├── users.py                 # /api/v1/users/* endpoints
│   │   │   ├── events.py                # /api/v1/events/* endpoints
│   │   │   ├── reminders.py              # /api/v1/reminders/* endpoints
│   │   │   ├── notifications.py         # /api/v1/notifications/* endpoints
│   │   │   ├── calendar.py               # /api/v1/calendar/* endpoints
│   │   │   ├── devices.py                # /api/v1/devices/* endpoints
│   │   │   ├── event_buttons.py          # /api/v1/event-buttons/* endpoints
│   │   │   ├── admin.py                  # /api/v1/admin/* endpoints
│   │   │   └── lumo.py                   # /api/v1/lumo/* endpoints
│   │   ├── schemas/
│   │   │   ├── __init__.py              # Pydantic schema exports
│   │   │   ├── user.py                  # UserCreate, UserUpdate, UserResponse
│   │   │   ├── event.py                 # EventCreate, EventUpdate, EventResponse
│   │   │   ├── reminder.py              # ReminderCreate, ReminderUpdate
│   │   │   ├── notification.py         # NotificationResponse
│   │   │   ├── device.py                # DeviceCreate, DeviceUpdate, DeviceResponse
│   │   │   ├── event_button.py          # EventButtonCreate, EventButtonResponse
│   │   │   └── token.py                 # Token schemas (access, refresh)
│   │   ├── services/
│   │   │   └── dependencies.py         # FastAPI dependencies (get_db, get_current_user)
│   │   ├── tasks/
│   │   │   └── scheduler.py            # APScheduler: reminder checker, session cleanup
│   │   ├── utils/
│   │   │   └── helpers.py              # Utility functions
│   │   └── websocket/
│   │       ├── __init__.py             # WebSocket route registration
│   │       ├── manager.py             # WebSocket connection manager (active connections)
│   │       ├── routes.py              # WebSocket endpoints (/ws/lumo, /ws/stream)
│   │       └── tts_stream.py          # TTS streaming pipeline (Gemini → WAV chunks)
│   ├── alembic/
│   │   ├── env.py                     # Alembic migration environment
│   │   ├── script.py.mako
│   │   └── versions/
│   │       ├── 0001_initial.py        # Initial schema (users, events, reminders, notifications)
│   │       ├── 0002_add_devices.py    # Add devices, event_buttons tables
│   │       └── 0003_add_event_buttons.py # Add event_buttons table (revised)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── .env
│
├── frontend-web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx             # Root layout (html/body)
│   │   │   ├── globals.css            # Tailwind CSS imports
│   │   │   ├── page.tsx              # Root redirect → /dashboard
│   │   │   ├── (auth)/
│   │   │   │   ├── layout.tsx         # Auth layout (no sidebar)
│   │   │   │   ├── login/page.tsx    # Login page
│   │   │   │   └── register/page.tsx # Register page
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx        # ProtectedLayout: sidebar + topbar
│   │   │   │   ├── page.tsx          # /dashboard - overview with stats
│   │   │   │   ├── calendar/page.tsx # FullCalendar view
│   │   │   │   ├── events/page.tsx   # Event list + create/edit modals
│   │   │   │   ├── notifications/page.tsx # Notification list
│   │   │   │   ├── settings/
│   │   │   │   │   ├── page.tsx      # Profile & password settings
│   │   │   │   │   ├── devices/page.tsx     # Device management
│   │   │   │   │   └── event-buttons/page.tsx # Button press history
│   │   │   │   └── admin/
│   │   │   │       ├── page.tsx      # Admin dashboard
│   │   │   │       ├── users/page.tsx       # User management
│   │   │   │       └── websocket/page.tsx   # ESP32 WebSocket tester
│   │   │   └── api/
│   │   │       └── v1/
│   │   │           └── [...path]/
│   │   │               └── route.ts  # API proxy (forwards to backend)
│   │   ├── components/
│   │   │   ├── ProtectedLayout.tsx   # Auth guard component
│   │   │   ├── Sidebar.tsx           # Navigation sidebar with role check
│   │   │   ├── Topbar.tsx            # Top bar with notification bell
│   │   │   ├── Modal.tsx             # Reusable modal dialog
│   │   │   ├── CalendarView.tsx      # FullCalendar wrapper
│   │   │   ├── EventFormModal.tsx     # Create/edit event form modal
│   │   │   ├── EventDetailModal.tsx  # Event detail modal
│   │   │   ├── NotificationBell.tsx  # Notification bell with badge
│   │   │   └── NotificationList.tsx  # Notification display component
│   │   ├── features/
│   │   │   ├── auth.ts               # Auth API functions (login, register, logout)
│   │   │   ├── events.ts             # Events API functions
│   │   │   ├── reminders.ts          # Reminders API functions
│   │   │   ├── notifications.ts      # Notifications API functions
│   │   │   ├── calendar.ts           # Calendar API functions
│   │   │   ├── devices.ts            # Devices API functions
│   │   │   ├── event_buttons.ts       # EventButtons API functions
│   │   │   ├── admin.ts              # Admin API functions
│   │   │   └── lumo.ts               # LUMO AI API functions
│   │   ├── hooks/
│   │   │   ├── useAuth.ts            # Auth hook (login/logout/user)
│   │   │   └── useWebSocket.ts        # WebSocket hook for LUMO connection
│   │   ├── lib/
│   │   │   ├── api.ts                # Axios instance with auth interceptors
│   │   │   ├── utils.ts              # Utility functions
│   │   │   └── constants.ts          # App constants (API paths, etc.)
│   │   ├── store/
│   │   │   ├── authStore.ts          # Auth state (user, token, login/logout)
│   │   │   ├── eventStore.ts         # Events state with API sync
│   │   │   ├── notificationStore.ts  # Notifications + unread count
│   │   │   ├── deviceStore.ts        # Devices state
│   │   │   └── eventButtonStore.ts   # EventButtons state
│   │   └── types/
│   │       ├── index.ts              # All TypeScript interfaces
│   │       └── next-auth.d.ts        # NextAuth type extensions
│   ├── public/
│   ├── package.json
│   ├── .env.local.example
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── docker-compose.yml                # Postgres + Backend + Frontend
└── README.md
```

---

## Features

### User Authentication

- **Registration** with email, password (bcrypt hashed), and display name
- **Login** with email/password returning JWT access token (30 min) + refresh token (7 days)
- **JWT-based sessions** using HS256 algorithm with python-jose
- **Token refresh** mechanism via `/api/v1/auth/refresh`
- **Role-based access control** with `user` and `admin` roles
- **Session management** with refresh token tracking and logout revocation

### Calendar & Events

- **FullCalendar integration** supporting day, week, month, and list views
- **Event CRUD** with title, description, location, start/end datetime
- **Date range filtering** on the events list endpoint
- **Event detail modal** showing all event information including reminders
- **Today view** on the dashboard showing upcoming events and quick stats

### Reminders & Notifications

- **Three reminder types**:
  - `web` — in-app notification via WebSocket
  - `mobile` — mobile push notification (future-ready)
  - `lumo` — spoken aloud via ESP32 TTS
- **Reminder scheduling** with offset from event start time (minutes/hours/days)
- **Automatic notification creation** when reminders trigger
- **WebSocket broadcast** to all connected clients for real-time updates
- **Mark as read** individual or bulk (mark all as read)

### LUMO AI Assistant

- **Three LLM versions**:
  - **Version 1**: Gemini 2.5 with Google Search
  - **Version 2**: Gemini 3.1 with Tavily web search
  - **Version 3**: Perplexity AI
- **Full audio pipeline**: STT (Groq Whisper) → LLM → TTS (Gemini)
- **Vietnamese-speaking AI** with personality rules (short responses <25 chars, friendly tone)
- **TTS output**: 24kHz mono 16-bit WAV streamed via WebSocket
- **Kore voice** (prebuilt) used for TTS generation
- **Text-only mode**: Chat via REST API without audio

### IoT Device Integration

- **ESP32 device registration** via 4-digit pairing code
- **WebSocket connection** from ESP32 to backend at `/ws/lumo?device_id=XXXX`
- **Device naming and management** in the web dashboard
- **Real-time text messaging** to ESP32 OLED display
- **TTS streaming** to ESP32 speaker
- **Physical button press logging** with event association
- **Device connection status** tracking

### Admin Dashboard

- **User management**: create, lock/unlock, change role, reset password
- **System logs**: audit trail of all admin actions
- **Event browser**: view all events across all users
- **WebSocket tester**: test ESP32 connections and send messages directly
- **Device notification**: send notifications to specific devices

---

## API Reference

All API endpoints are prefixed with `/api/v1`. Authentication uses Bearer token in the `Authorization` header.

```
Authorization: Bearer <access_token>
```

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/register` | Register new user | No |
| `POST` | `/auth/login` | Login, returns tokens | No |
| `POST` | `/auth/refresh` | Refresh access token | No |
| `POST` | `/auth/logout` | Logout (revoke session) | Yes |
| `GET` | `/auth/me` | Get current user | Yes |

**Register Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

**Login Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/users/me` | Get current user profile | Yes |
| `PATCH` | `/users/me` | Update profile (name, phone) | Yes |
| `PATCH` | `/users/me/password` | Change password | Yes |

### Events

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/events` | List events (supports `?start=&end=` filter) | Yes |
| `GET` | `/events/{id}` | Get single event | Yes |
| `POST` | `/events` | Create event (auto-creates reminders) | Yes |
| `PATCH` | `/events/{id}` | Update event | Yes |
| `DELETE` | `/events/{id}` | Delete event | Yes |

**Create Event Request:**
```json
{
  "title": "Team Meeting",
  "description": "Weekly sync",
  "location": "Conference Room A",
  "start": "2026-04-03T10:00:00",
  "end": "2026-04-03T11:00:00",
  "reminders": [
    { "type": "lumo", "minutes_before": 5 },
    { "type": "web", "minutes_before": 15 }
  ]
}
```

### Reminders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/reminders` | List user's reminders | Yes |
| `POST` | `/events/{id}/reminders` | Add reminder to event | Yes |
| `PATCH` | `/reminders/{id}` | Update reminder | Yes |
| `DELETE` | `/reminders/{id}` | Delete reminder | Yes |

### Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/notifications` | List notifications | Yes |
| `PATCH` | `/notifications/{id}/read` | Mark as read | Yes |
| `PATCH` | `/notifications/read-all` | Mark all as read | Yes |

### Calendar

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/calendar` | Get calendar events (`?start=&end=`) | Yes |

### Devices

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/devices` | List user's devices | Yes |
| `GET` | `/devices/{id}` | Get device details | Yes |
| `POST` | `/devices` | Register device (requires 4-digit code) | Yes |
| `PATCH` | `/devices/{id}` | Update device name | Yes |
| `DELETE` | `/devices/{id}` | Delete device | Yes |

### Event Buttons

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/event-buttons` | Record button press | Yes |
| `GET` | `/event-buttons` | List button presses | Yes |
| `GET` | `/event-buttons/today` | Get today's button status | Yes |

### LUMO AI

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/lumo/version1` | Gemini 2.5 + Google Search | Yes |
| `GET` | `/lumo/version2` | Gemini 3.1 + Tavily Search | Yes |
| `GET` | `/lumo/version3` | Perplexity AI | Yes |
| `POST` | `/lumo/audio/` | Full audio pipeline (STT → LLM → TTS) | Yes |

**Text Query Parameters:** `?q=<message>`

**Audio Pipeline Request (multipart/form-data):**
```
audio: <audio_file> (audio/webm or audio/mp4)
```

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/admin/users` | List all users (paginated) | Admin |
| `POST` | `/admin/users` | Create user | Admin |
| `PATCH` | `/admin/users/{id}/password` | Reset user password | Admin |
| `PATCH` | `/admin/users/{id}/lock` | Lock user account | Admin |
| `PATCH` | `/admin/users/{id}/unlock` | Unlock user account | Admin |
| `PATCH` | `/admin/users/{id}/role` | Change user role | Admin |
| `GET` | `/admin/logs` | View system logs | Admin |
| `GET` | `/admin/events` | View all events | Admin |
| `POST` | `/admin/device/notify` | Send notification to device | Admin |
| `POST` | `/admin/device/send` | Send text to ESP32 | Admin |

---

## WebSocket Protocol

### Endpoint 1: `/ws/lumo`

ESP32 device connection for LUMO AI interactions.

**Connection:**
```
wss://api.example.com/ws/lumo?device_id=1234
```

**Device → Server Messages:**

```json
// Text-to-Speech request
{"action": "tts", "text": "Bạn có cuộc họp vào lúc 3 giờ chiều"}

// Voice pipeline (STT → LLM → TTS)
{"action": "stt_tts", "audio_b64": "UklGRl..."}

// Keepalive
"ping"
```

**Server → Device Responses:**

```json
// Error
{"type": "error", "message": "TTS service unavailable"}

// Completion
{"type": "done"}

// Binary frames
<raw WAV audio data>
```

### Endpoint 2: `/ws/stream`

TTS streaming for web clients.

**Connection:**
```
wss://api.example.com/ws/stream?token=<access_token>
```

**Client → Server:**
```json
{"action": "tts", "text": "Xin chào! Bạn khỏe không?"}
```

**Server → Client:** Binary WAV audio chunks, followed by `{"type": "done"}`.

---

## Database Schema

### Users Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| hashed_password | VARCHAR(255) | NOT NULL |
| role | VARCHAR(50) | DEFAULT 'user' |
| is_locked | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMP | DEFAULT NOW() |

### Events Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | FOREIGN KEY → users.id |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| location | VARCHAR(255) | |
| start | TIMESTAMP | NOT NULL |
| end | TIMESTAMP | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

### Reminders Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| event_id | UUID | FOREIGN KEY → events.id |
| type | VARCHAR(50) | NOT NULL (web/mobile/lumo) |
| minutes_before | INTEGER | NOT NULL |
| is_sent | BOOLEAN | DEFAULT FALSE |

### Notifications Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | FOREIGN KEY → users.id |
| event_id | UUID | FOREIGN KEY → events.id (nullable) |
| title | VARCHAR(255) | NOT NULL |
| message | TEXT | NOT NULL |
| is_read | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMP | DEFAULT NOW() |

### Devices Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| code | VARCHAR(4) | UNIQUE, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| user_id | UUID | FOREIGN KEY → users.id |
| created_at | TIMESTAMP | DEFAULT NOW() |

### EventButtons Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| device_id | UUID | FOREIGN KEY → devices.id |
| event_id | UUID | FOREIGN KEY → events.id (nullable) |
| pressed_at | TIMESTAMP | DEFAULT NOW() |

### UserSessions Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | FOREIGN KEY → users.id |
| refresh_token | VARCHAR(255) | NOT NULL |
| expires_at | TIMESTAMP | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

## Configuration

### Backend Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/lumohub

# Security
SECRET_KEY=your-super-secret-key-at-least-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=http://localhost:3000,https://your-domain.com

# AI APIs
GEMINI_API_KEY=your-google-gemini-api-key
GROQ_API_KEY=your-groq-api-key
GOOGLE_API_KEY=your-google-api-key (for Google Search)
TAVILY_API_KEY=your-tavily-api-key

# Optional: External API base URL
# API_BASE_URL=http://backend:8000
```

### Frontend Environment Variables

Create `frontend-web/.env.local` from `frontend-web/.env.local.example`:

```env
# Point to the backend API (use /api/v1 proxy in production)
INTERNAL_API_URL=http://127.0.0.1:8000

# Optional: Direct WebSocket URL (if different from frontend origin)
# NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
```

---

## Getting Started

### Prerequisites

- **Docker** and **Docker Compose** installed
- **Python 3.11+** (for local development)
- **Node.js 18+** (for local frontend development)
- API keys for Gemini, Groq, Tavily, and Google Search

### Development Setup

#### Option 1: Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/luminostech/lumohub.git
cd lumohub

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# 3. Start all services
docker-compose up -d

# 4. Run database migrations
docker-compose exec backend alembic upgrade head

# 5. Seed default users
docker-compose exec backend python -m app.db.seed

# 6. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

#### Option 2: Local Development

**Backend:**
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
alembic upgrade head

# Seed data
python -m app.db.seed

# Start server
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend-web

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local

# Start development server
npm run dev
```

### Docker Deployment

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend-web

# Stop services
docker-compose down

# Reset database (⚠️ destructive)
docker-compose down -v
docker-compose up -d
docker-compose exec backend alembic upgrade head
docker-compose exec backend python -m app.db.seed
```

---

## Frontend Guide

### Dashboard

The main dashboard (`/dashboard`) provides:
- Greeting with user name and current date
- Today's event count
- Total events this month
- Today's event list with quick actions
- Recent notifications

### Calendar

The calendar page (`/calendar`) uses FullCalendar with:
- **Month view** (default)
- **Week view**
- **Day view**
- **List view**
- Click any date to create an event
- Click any event to view details

### Events Management

The events page (`/events`) provides:
- List view of all events with search
- Create event via modal form
- Edit event via modal form
- Delete event with confirmation
- Add/edit reminders when creating/editing events
- Filter by date range

### Notifications

The notifications page (`/notifications`) provides:
- Chronological list of all notifications
- Mark individual notifications as read
- Mark all as read button
- Notification bell in topbar with unread count

### Settings

**Profile Settings** (`/settings`):
- Update display name
- Update phone number
- Change password

**Device Management** (`/settings/devices`):
- View registered ESP32 devices
- Add new device (enter 4-digit code)
- Rename devices
- Delete devices

**Event Buttons** (`/settings/event-buttons`):
- View button press history
- See which events were triggered
- Today's button press summary

### Admin Dashboard

Accessible only to users with `admin` role.

**Overview** (`/admin`):
- Total user count
- Active sessions count
- System logs table

**User Management** (`/admin/users`):
- Paginated user list
- Create new user
- Reset password
- Lock/unlock accounts
- Change user roles (user ↔ admin)

**WebSocket Tester** (`/admin/websocket`):
- Test ESP32 device connections
- Send TTS messages to devices
- Monitor WebSocket status
- View device list with connection status

---

## ESP32 IoT Device

The ESP32 device (Lumo LuminosTech) is an IoT companion device that:

1. **Connects** to the backend via WebSocket at `/ws/lumo?device_id=XXXX`
2. **Displays** text messages on the OLED screen
3. **Speaks** event reminders and AI responses via TTS
4. **Listens** to voice commands via microphone (STT)
5. **Buttons** can be pressed to trigger associated events

### Device Communication Flow

```
ESP32 → WebSocket → Backend
                  ↓
            [Check device code]
                  ↓
            [Route message]
                  ↓
     ┌────────────┼────────────┐
     ↓            ↓            ↓
  Gemini      Groq STT     TTS Stream
  (LLM)       (Speech)     (Audio)
     ↓            ↓            ↓
     └────────────┴────────────┘
                  ↓
            WebSocket Response
                  ↓
              ESP32
         (Display/Speak)
```

### Physical Button Integration

- Each device has one or more physical buttons
- Button presses are logged via `POST /api/v1/event-buttons`
- Buttons can be associated with calendar events
- Today's button status viewable at `/settings/event-buttons`

---

## LUMO AI Voice Pipeline

```
Microphone → ESP32 → Base64 Audio → WebSocket → Backend
                                              ↓
                                         Groq API
                                      (Whisper STT)
                                              ↓
                                         Gemini API
                                         (LLM + TTS)
                                              ↓
                                         WAV Audio
                                              ↓
                                         WebSocket
                                              ↓
                    ESP32 ← Base64 Audio ← Backend
                         (DAC → Speaker)
```

### TTS Streaming Details

1. Client sends `{action: "tts", text: "..."}` to `/ws/stream`
2. Backend calls `tts_stream_manager.stream_tts()`
3. Gemini TTS generates audio using `kore` voice
4. Audio is chunked into ~10KB WAV frames
5. Binary frames sent over WebSocket
6. Final `{"type": "done"}` message signals completion

### LUMO Personality Rules

LUMO (the AI assistant) follows these rules:
- Always responds in **Vietnamese**
- Keeps responses **under 25 characters** for quick TTS playback
- **Friendly, warm, and caring** tone
- **Never refuses** — always suggests alternatives if unable to help
- Used for: event reminders, quick answers, voice interaction

---

## Background Tasks

### Reminder Checker (APScheduler)

Runs every **60 seconds**:
1. Queries reminders where `is_sent = false` and `scheduled_time <= now`
2. Creates a `Notification` record for the user
3. Broadcasts via WebSocket to all connected clients
4. If reminder type is `lumo`, sends TTS message to the user's devices
5. Marks reminder as `is_sent = true`

### Session Cleanup (APScheduler)

Runs every **60 minutes**:
1. Deletes expired refresh tokens from `user_sessions` table
2. Keeps the session table clean

---

## Security

### Password Security
- Passwords hashed with **bcrypt** (via passlib)
- Minimum password requirements enforced at registration

### JWT Tokens
- **HS256** algorithm for signing
- Short-lived access tokens (30 min default)
- Refresh tokens with longer expiry (7 days default)
- Refresh tokens stored in database for revocation

### Role-Based Access Control
- **Admin routes** protected with `require_admin` dependency
- **User routes** protected with `get_current_user` dependency
- User can only access their own events, devices, notifications

### Input Validation
- All request data validated with **Pydantic schemas**
- SQL injection prevented by **SQLAlchemy ORM** (parameterized queries)
- CORS configured for specific trusted origins

### Admin Security
- Failed login attempts can lock accounts (admin action)
- All admin actions logged in `admin_actions` and `system_logs` tables
- Admin can force-lock/unlock user accounts

---

## Default Credentials (Development Only)

> ⚠️ **Never use these in production!**

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@lumohub.com` | `Admin@123` |
| Demo User | `demo@lumohub.com` | `Demo@123` |

---

## License

Copyright © 2026 **Luminos Tech**. All rights reserved.
