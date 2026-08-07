# AGENTS.md

## Project Purpose

LUMO Hub is an assistive-technology and InsurTech project by Luminos Tech. Its long-term goal is to provide an AI companion ecosystem for older adults and people with disabilities, combining emotional interaction, daily assistance, and proactive safety monitoring without relying on cameras.

The primary users are older adults and people with disabilities. The main paying customers are expected to be adult children aged 25-45 who live away from their parents, insurance companies, nursing homes, disability support centers, and other care organizations.

The product vision has three connected parts:

- A voice-first LUMO Hub designed as a low-friction or "zero-UI" companion.
- A family and organization dashboard for schedules, reminders, devices, notifications, safety status, and administration.
- A planned wearable safety button/bracelet for physical check-ins, fall detection, and activity trends.

The repository currently implements the software platform and an ESP32 Hub prototype. Some capabilities described in the project proposal are roadmap items and are not yet represented by production-ready code.

## Repository Scope

The repository consists of:

- `backend/`: FastAPI, SQLAlchemy/PostgreSQL, JWT authentication, CRUD, scheduler, AI, and WebSocket services.
- `frontend-web/`: Next.js 14 App Router with React/TypeScript, dashboard, administration, and API proxy.
- `Lumo/Lumo-LuminosTech/`: ESP-IDF/C firmware for ESP32 (Wi-Fi captive portal, microphone/recording, OLED, I2S audio, buttons, and HTTP API).

Additional technical documentation is in `docs/`. The Vietnamese project proposal is stored externally as `LumoHub_LuminosTech_Mo Ta.pdf`. Use it for product intent, market positioning, pricing assumptions, and roadmap context. Treat the actual source code as authoritative for implemented behavior.

## Product Principles

- Privacy first: avoid camera-based monitoring and collect only data needed for the stated service.
- Accessibility first: older adults should be able to use the core experience through natural voice interaction or one simple physical action.
- Respect and dignity: do not frame users as patients under surveillance. Product language and industrial design should promote independence and connection.
- Honest safety claims: this is currently a prototype, not a certified medical or emergency-response device. Never claim "24/7 protection," "instant rescue," "absolute safety," or diagnostic capability without verified evidence and the required approvals.
- Human connection: scheduled recordings from family members, reminders, and conversational interaction are intended to reduce isolation, not replace family members or professional care.
- Fail-safe design: essential local safety behavior should degrade gracefully when Internet or 4G connectivity is unavailable.

## Proposed Product System

The proposal describes the following target system. These are product requirements or roadmap goals unless corresponding implementation is verified in source:

- Hub hardware with independent 4G connectivity, speaker, microphone, display, physical button, and Vietnamese voice interaction.
- A private AI service intended to run on Luminos Tech infrastructure, using a self-hosted Vietnamese language model where feasible.
- A BM25 retrieval layer for common questions such as time, weather, alarms, and medication reminders, reducing latency and GPU usage before invoking an LLM.
- An abnormal-silence workflow: if no physical check-in or voice interaction occurs within a configured period (for example, 12 hours), the Hub asks the user to respond and may then escalate an alert.
- Family voice recordings uploaded through the dashboard and replayed on demand or at scheduled times.
- A planned nRF52840 SuperMini wearable with an MPU6050 six-axis IMU, BLE 5.0, CR2450 battery, and an IP67 design target.
- Three-phase on-device fall detection: free fall, impact, then prolonged immobility. The stated accuracy target is above 90%, but it requires real pilot data and must not be presented as achieved until measured.
- Daily activity aggregation to help families notice meaningful reductions in movement.
- A wearable design target below 20 g, with soft medical-grade silicone, rounded surfaces, replaceable straps, and a non-medical appearance that supports continuous use.

The long-term proposal also discusses language-pattern analysis for possible cognitive-decline signals. This is explicitly a future reference feature, not an Alzheimer diagnosis. It must remain out of user-facing medical claims until research, consent, validation, and regulatory requirements are satisfied.

## Current Implementation Versus Roadmap

Agents must preserve this distinction:

- Implemented in this repository: FastAPI services, PostgreSQL models, JWT authentication, event/reminder/notification flows, device registration, Web Push, administration, AI endpoints using third-party providers, WebSockets, a Next.js dashboard, and ESP-IDF Hub prototype modules.
- Partially implemented or prototype-level: voice STT/LLM/TTS flows, device messaging, wake-word verification, physical event-button records, and audio/device integration.
- Proposed but not verified as complete here: production 4G Hub hardware, nRF52840 fall-detection bracelet, BLE integration between bracelet and Hub, IP67 enclosure, one-to-three-year battery validation, abnormal-silence escalation as a complete safety workflow, organization-mode dashboard, self-hosted private LLM infrastructure, BM25 routing at production scale, clinical pilots, and insurance integration.
- Current AI code calls services including Gemini, Groq, Perplexity, Google, and Tavily. Therefore, do not claim that current voice/conversation data never reaches a third party. The proposal's data-sovereignty statement is a target architecture, not the behavior of the present code.

## Working Rules

- Read all relevant layers before changing a business flow: routes, schemas, CRUD/models, frontend APIs/stores/pages, and firmware protocol code when applicable.
- Preserve existing working-tree changes. Never reset, checkout, or delete user changes.
- Use `rg` for searches and `apply_patch` for manual edits. Keep changes focused and minimal.
- Do not commit, deploy, or change secrets unless explicitly requested.
- Never put API keys or other secrets in source. Keep secrets local in `.env`; update `.env.example` when adding a variable.
- When changing an API, check the Next proxy `/api/v1/[...path]`, Axios client, CORS, and WebSocket URLs as well.
- When changing reminders or notifications, check the background scheduler and the `web`, `push`, and `lumo` channels, not only request/response code.
- When changing LUMO behavior, check the REST AI route (`backend/app/routes/lumo.py`), TTS stream, and WebSocket manager together.
- Label proposal-only features clearly in code, documentation, UI, and demonstrations.
- Do not turn unvalidated safety thresholds, fall-detection accuracy, battery life, waterproofing, or financial projections into factual claims.
- Treat voice, health-adjacent, activity, and emergency-contact data as sensitive. Require explicit consent, minimal retention, restricted access, and auditable handling.

## Backend

Entry point: `backend/app/main.py` (`app.main:app`). The FastAPI lifespan creates database tables and starts/stops APScheduler.

- REST prefix: `/api/v1` (mounted in `backend/app/routes/__init__.py`).
- Current route groups: `auth`, `users`, `events`, `calendar`, `reminders`, `notifications`, `admin`, `lumo`, `devices`, `event-buttons`, `push`, and `check-noti`.
- Health check: `GET /health`.
- Authentication: register, login, refresh, logout, and current-user endpoints. Access and refresh JWTs are issued by the backend; refresh sessions are stored in `user_sessions`.
- Events: CRUD, calendar view, and `POST /api/v1/events/extract` for extracting events from content.
- Reminders: `/reminders` and `/events/{event_id}/reminders`. The `check_reminders` scheduler runs every minute, creates notifications, and can forward them to LUMO.
- Notifications: list, mark-as-read, and read-all operations. Web Push is under `/api/v1/push` and uses VAPID.
- Administration: user management, role/lock/password changes, log/event viewing, and device notification/text commands.
- LUMO: `/api/v1/lumo/`, `version1/2/3`, wake-word verification, and audio STT -> LLM -> TTS processing. Keys are read from `GEMINI_API_KEY`, `GROQ_API_KEY`, `PERPLEXITY_API_KEY`, `GOOGLE_API_KEY`, and `TAVILY_API_KEY`.
- WebSockets: `/ws/lumo?device_id=...` for device connections, ping, and push messages; `/ws/stream?device_id=...` for `tts` and `stt_tts`, returning binary WAV data plus JSON status/error messages.
- The second scheduler job, `cleanup_expired_sessions`, runs hourly.
- Models are in `backend/app/models`; Alembic migrations are in `backend/alembic/versions`. `init_db.py` still calls `Base.metadata.create_all` during application startup.

Backend dependencies are listed in `backend/requirements.txt` (FastAPI 0.111, SQLAlchemy 2, Alembic, APScheduler, JWT, Google GenAI/Groq, pywebpush, Pillow, and qrcode).

## Frontend

Root layout: `frontend-web/src/app/layout.tsx`. `/` redirects to `/dashboard`; dashboard pages are wrapped by `ProtectedLayout`.

- Client-side auth stores tokens in `localStorage`; `src/lib/api.ts` attaches the Bearer token and refreshes it after a 401 response.
- Browser API calls use same-origin `/api/v1`; the route handler forwards them to `INTERNAL_API_URL` (default: `http://127.0.0.1:8000`).
- Existing pages: login/register; dashboard, calendar, events and event details, notifications, settings, devices, event buttons; admin overview, users, push, and WebSocket pages.
- Feature APIs: auth, events, calendar, notifications, devices, event buttons, and admin. State is managed with Zustand stores in `src/store`.
- WebSocket client: `src/hooks/useLumoWebSocket.ts`; the base URL is resolved by `src/lib/publicApi.ts` and `NEXT_PUBLIC_WS_URL`.
- AI event import has both the Next route `src/app/api/extract-events/route.ts` and backend endpoint `POST /api/v1/events/extract`; verify which path a page uses before changing the flow.

Frontend stack: Next.js 14, React 18, TypeScript, Tailwind, FullCalendar, Axios, Zustand, Zod, react-hook-form, Sonner, Lucide, date-fns, and html5-qrcode.

## ESP32 Firmware

`Lumo/Lumo-LuminosTech` is an ESP-IDF project. Main code is in `main/Lumo-LuminosTech.c`, with modules under `main/{wifi,http_api,mic,record,audio,oled,button}`. The firmware handles Wi-Fi/provisioning, SNTP, recording, I2S playback, OLED output, buttons, and HTTP/WebSocket communication with the backend. `managed_components/` contains cJSON; avoid editing generated or dependency code unless necessary.

Audio/OLED documentation and search notes are in `docs/` and the `*_library_docs.md` files in the firmware tree.

## Business Model and Positioning

The proposal positions LUMO Hub as a B2C, B2B, and B2B2C product:

- B2C bundle target: VND 1,800,000 for a 4G Hub and wearable, plus VND 50,000 per device per month.
- B2B wholesale target for orders of at least 20 units: VND 1,300,000 per bundle, plus VND 40,000 per device per month.
- Proposed bundle BOM at batches of at least 50: VND 743,000 (VND 541,000 Hub and VND 202,000 wearable).
- Proposed monthly service COGS: VND 35,000 per device, including IoT SIM, allocated GPU service, hosting, and database costs.
- Intended channels: direct family customers, nursing homes, disability support centers, and insurance partnerships where LUMO Hub is an add-on service.

These figures are planning assumptions from the 2026 competition proposal, not audited prices or guaranteed margins. Revalidate supplier quotes, cloud costs, taxes, warranty, support, certification, logistics, and customer-acquisition costs before using them in implementation or public materials.

The differentiation described in the proposal is camera-free operation, Vietnamese voice interaction, independence from a smartphone, an accessible physical interaction model, long-life wearable design, private-infrastructure ambitions, and insurance-oriented distribution.

## Delivery and Validation Roadmap

The proposal's intended validation path is:

- Bootstrap a functional Hub and wearable prototype, interview at least 50 prospective family customers, speak with five nursing homes, and obtain one letter of interest.
- Produce 20-30 pilot devices and run a controlled pilot with at least one care organization.
- Collect at least three months of real operational data before making reliability claims.
- Seek a first signed B2B contract, then scale toward 100-200 commercial devices and begin formal insurance discussions.
- Protect the LUMO Hub trademark and prepare the operational, security, warranty, and support processes required for commercial use.

For the proposed cognitive-analysis feature, the document outlines research in 2026-2027, validation/regulatory work in 2027-2028, and possible commercialization from 2028 onward. Any medical-device classification must be confirmed with qualified Vietnamese regulatory counsel; do not rely solely on the proposal's preliminary classification assumption.

## Communications Guardrails

During the prototype stage, communications should focus on learning, community participation, and recruiting interview or pilot participants rather than presenting a finished commercial product.

- Primary message: one simple action that lets a family member signal when support is needed.
- Calls to action: register for updates, join an interview, test the prototype, discuss organizational needs, or view a controlled demo.
- Content themes: startup journey, product development, customer discovery, privacy, accessibility, and community value.
- Measure qualified leads, interviews, pilot readiness, and repeated insights rather than follower counts alone.
- Clearly mark prototype status and test conditions. Publish only measurements that can be supported by evidence.
- Use respectful, autonomy-centered language; avoid fear-based messaging about aging or disability.
- Collect only necessary lead information, obtain consent, and restrict access to it.

## Running Locally

Docker Compose defines three services: `postgres`, `backend`, and `frontend-web`.

- Production-like: `docker compose up --build` (ports 5432, 8000, and 3000).
- Development with hot reload: `docker compose -f docker-compose.dev.yml up --build`.

The backend needs `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, token expiry settings, `CORS_ORIGINS`, and optional AI/VAPID keys (see `backend/.env.example`). The frontend proxy needs `INTERNAL_API_URL`; WebSockets use `NEXT_PUBLIC_WS_URL` (see `frontend-web/.env.local.example`).

## Checks Before Handoff

- Backend: run import/compile checks and smoke-test `GET /health`; with a database available, verify migrations and CRUD behavior.
- Frontend: run `npm ci`, `npm run lint`, and `npm run build` in `frontend-web`.
- Firmware: build/flash with ESP-IDF from the firmware project directory using the appropriate board, partition table, and Wi-Fi credentials.
- Clearly report checks that could not run because PostgreSQL, ESP-IDF, or API keys were unavailable.

## Root Files

`README.md`, `audio_fix_notes.md`, `test_audio.py`, `response.wav`, `test.wav`, the two Compose files, and VS Code configuration are present. Do not assume `dump.sql` or `test_ws.py` exists unless `rg --files` finds it.
