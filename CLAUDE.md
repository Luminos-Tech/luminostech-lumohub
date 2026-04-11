# CLAUDE.md

## Mục đích dự án

LumoHub là một hệ thống lịch/sự kiện full-stack gồm:
- **Backend FastAPI** để auth, CRUD event/reminder/notification/device, admin, AI endpoints và WebSocket cho thiết bị LUMO.
- **Frontend Next.js** để người dùng quản lý lịch, thiết bị, thông báo và trang admin.
- **PostgreSQL** để lưu dữ liệu.
- **Thiết bị LUMO/ESP32** kết nối qua WebSocket để nhận text / reminder / audio stream.

Dự án này thiên về 3 mảng chính:
1. **Quản lý lịch và sự kiện cá nhân**
2. **Nhắc việc / thông báo / thiết bị**
3. **AI assistant LUMO cho text, audio và IoT**

---

## Cấu trúc thư mục chính

```txt
lumohub/
├── backend/           # FastAPI app
├── frontend-web/      # Next.js app
├── docker-compose.yml
├── docker-compose.dev.yml
├── dump.sql
├── test_audio.py
├── test_ws.py
└── README.md
```

---

## Backend

### Tổng quan

Backend nằm trong `backend/app/` và khởi động từ `app.main:app`.

Các phần quan trọng:
- `backend/app/main.py`: tạo FastAPI app, mount REST routes + WebSocket routes, bật scheduler khi app start.
- `backend/app/routes/`: REST API.
- `backend/app/websocket/`: quản lý kết nối thiết bị LUMO và TTS stream.
- `backend/app/tasks/scheduler.py`: job nhắc lịch và dọn session hết hạn.
- `backend/app/db/`: init DB, session, seed.
- `backend/app/models/`: SQLAlchemy models.
- `backend/app/crud/`: thao tác DB theo từng domain.
- `backend/app/schemas/`: request/response schemas.
- `backend/app/core/`: config + security.

### Các nhóm API chính

Prefix chính: `/api/v1`

Theo `backend/app/routes/__init__.py`, backend hiện đang mount các nhóm route sau:
- `/auth`
- `/users`
- `/events`
- `/calendar`
- `/reminders`
- `/notifications`
- `/admin`
- `/lumo`
- `/devices`
- `/event_buttons`
- `/push` — Web Push Notification（管理员向浏览器发送推送）

Ngoài ra còn có:
- `/health`: health check chung của backend
- WebSocket routes ở ngoài prefix `/api/v1`

### Auth và session

Có flow auth chuẩn bằng JWT:
- đăng ký
- đăng nhập
- refresh token
- logout
- lấy thông tin user hiện tại

Điểm đáng chú ý:
- access token và refresh token đều được tạo ở backend
- refresh token được lưu DB qua `crud/session.py`
- scheduler có job cleanup session hết hạn

### Event / reminder / notification

Luồng nghiệp vụ chính có vẻ là:
1. User tạo event
2. Event có thể kèm reminders
3. Scheduler mỗi phút quét reminder chưa gửi
4. Nếu đến giờ, backend tạo notification
5. Nếu channel là `lumo`, backend đẩy message sang thiết bị đang giữ WebSocket

Trong `backend/app/tasks/scheduler.py`, reminder hiện được xử lý theo `event.start_time - remind_before_minutes`.

### LUMO AI

`backend/app/routes/lumo.py` đang chứa phần AI khá đậm:
- `GET /api/v1/lumo/` -> health check cho module LUMO
- `GET /api/v1/lumo/version1` -> Gemini + Google Search tool
- `GET /api/v1/lumo/version2` -> Tavily search + Gemini
- `GET /api/v1/lumo/version3` -> Perplexity
- `POST /api/v1/lumo/audio/` -> pipeline audio: STT -> LLM -> TTS -> trả file WAV

Các API key backend đang mong đợi trong `.env`:
- `GEMINI_API_KEY`
- `PERPLEXITY_API_KEY`
- `GROQ_API_KEY`
- `GOOGLE_API_KEY`
- `TAVILY_API_KEY`

LUMO hiện được cấu hình trả lời bằng **tiếng Việt**, ngắn, thân thiện, dùng cho voice assistant.

### WebSocket / thiết bị LUMO

Có 2 phần WebSocket khác nhau:

1. `backend/app/websocket/routes.py`
- endpoint `/ws/lumo?device_id=...`
- quản lý kết nối thiết bị
- nhận text/binary đơn giản
- ping/pong cơ bản

2. `backend/app/websocket/tts_stream.py`
- được mount qua `backend/app/websocket/__init__.py`
- đây nhiều khả năng là nơi xử lý stream audio/TTS chuyên biệt

`backend/app/websocket/manager.py` giữ map `device_id -> WebSocket` để backend có thể push reminder hoặc text sang thiết bị đang online.

### Scheduler

`backend/app/tasks/scheduler.py` hiện có 2 job:
- `check_reminders`: chạy mỗi 1 phút
- `cleanup_expired_sessions`: chạy mỗi 1 giờ

Scheduler được start trong lifespan của FastAPI app.

### Tech stack backend đã xác minh từ code

Từ `backend/requirements.txt`:
- FastAPI
- Uvicorn
- SQLAlchemy
- psycopg2-binary
- Alembic
- Pydantic + pydantic-settings
- python-jose
- passlib + bcrypt
- python-multipart
- `qrcode==7.4.2`
- `Pillow>=10.0.0`
- `pywebpush>=1.14.0`
- `web-push>=3.3.0`

---

## Frontend

### Tổng quan

Frontend nằm trong `frontend-web/` và là **Next.js 14 + React 18 + TypeScript**.

Điểm chính:
- dùng App Router
- layout gốc ở `frontend-web/src/app/layout.tsx`
- route `/` redirect sang `/dashboard`
- dashboard area được bọc bởi `ProtectedLayout`

### Luồng auth frontend

`frontend-web/src/components/layout/ProtectedLayout.tsx` cho thấy:
- frontend lưu `access_token` ở `localStorage`
- nếu không có token thì redirect sang `/login`
- nếu có token nhưng chưa có user state thì gọi `fetchMe()`

Tức là auth phía frontend đang theo hướng client-side guard.

### API proxy

`frontend-web/src/app/api/v1/[...path]/route.ts` là proxy từ Next.js sang backend.

Luồng chính:
- frontend gọi `/api/v1/...`
- Next route handler forward request sang `INTERNAL_API_URL`
- mặc định fallback là `http://127.0.0.1:8000`

Điều này nghĩa là khi chạy local/dev hoặc Docker, frontend không nhất thiết gọi trực tiếp backend public URL.

### Các khu vực UI chính đã thấy từ code

Trong `frontend-web/src/app/` đang có:
- `(auth)/login`
- `(auth)/register`
- `(dashboard)/dashboard`
- `(dashboard)/calendar`
- `(dashboard)/events`
- `(dashboard)/events/[id]`
- `(dashboard)/notifications`
- `(dashboard)/settings`
- `(dashboard)/settings/devices`
- `(dashboard)/settings/event-buttons`
- `(dashboard)/admin`
- `(dashboard)/admin/users`
- `(dashboard)/admin/logs`
- `(dashboard)/admin/websocket`
- `(dashboard)/admin/push` — Admin gửi Push Notification đến người dùng
- `api/extract-events`
- `api/v1/[...path]`
- `api/health`

### Frontend feature modules

Các API/state modules đang có:
- `features/auth/api.ts`
- `features/events/api.ts`
- `features/calendar/api.ts`
- `features/notifications/api.ts`
- `features/devices/api.ts`
- `features/event-buttons/api.ts`
- `features/admin/api.ts`
- store dùng Zustand cho auth/event/notification/device/eventButton

### UI/UX pattern hiện có

Có các nhóm component chính:
- `components/layout/`: sidebar, topbar, footer, bottom nav, protected layout
- `components/calendar/`: calendar view, event form/detail, AI import modal
- `components/auth/`: login/register form
- `components/admin/`: create user, reset password, role badge
- `components/notifications/`
- `components/devices/` — Modal thêm thiết bị (camera QR), gửi notification
- `components/profile/`
- `components/common/` và `components/ui/`

### Tech stack frontend đã xác minh từ code

Từ `frontend-web/package.json`:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- Zod
- react-hook-form
- FullCalendar
- Axios
- Sonner
- Lucide React
- date-fns

---

## Docker / môi trường chạy

`docker-compose.yml` hiện định nghĩa 3 service:
- `postgres`
- `backend`
- `frontend-web`

Ports mặc định:
- Postgres: `5432`
- Backend: `8000`
- Frontend: `3000`

Biến môi trường đáng chú ý:
- backend cần DB URL + secret + CORS + AI keys
- frontend cần `INTERNAL_API_URL`

Lưu ý:
- trong Docker Compose, frontend gọi backend qua `http://backend:8000`
- backend health check dùng `/health`

---

## Các file thử nghiệm hiện có ở root

- `test_audio.py`: nhiều khả năng để test audio/TTS hoặc pipeline LUMO
- `test_ws.py`: nhiều khả năng để test WebSocket với thiết bị / backend
- `lumo_tts_output.wav`: file output test audio

Các file này có vẻ là script hỗ trợ dev/test thủ công, không phải core app.

---

## Những gì README mô tả và cần kiểm tra lại

README hiện rất chi tiết và tham vọng, nhưng khi làm việc nên ưu tiên **đọc code thật** vì có thể README đi trước hoặc khác trạng thái hiện tại.

Những điểm nên xác minh thêm khi sửa code:
- endpoint nào còn đúng 100%, endpoint nào đã đổi tên
- route `/ws/stream` có còn hoạt động đúng như README mô tả hay không
- schema DB thực tế có khớp hoàn toàn với phần “Database Models” trong README hay không
- admin features nào đã hoàn thiện, admin features nào mới ở mức UI
- AI import event hiện đi qua backend `/events/extract` hay Next route `/api/extract-events`, hoặc cả hai

---

## Cách đọc dự án nhanh cho các phiên sau

Nếu cần hiểu nhanh dự án, nên đọc theo thứ tự này:

1. `README.md`
2. `backend/app/main.py`
3. `backend/app/routes/__init__.py`
4. `backend/app/routes/auth.py`
5. `backend/app/routes/events.py`
6. `backend/app/routes/lumo.py`
7. `backend/app/websocket/manager.py`
8. `backend/app/tasks/scheduler.py`
9. `frontend-web/src/app/layout.tsx`
10. `frontend-web/src/components/layout/ProtectedLayout.tsx`
11. `frontend-web/src/app/api/v1/[...path]/route.ts`
12. các page trong `frontend-web/src/app/(dashboard)/`

---

## Ghi chú khi Claude sửa code trong repo này

- Ưu tiên coi đây là **project full-stack FastAPI + Next.js + PostgreSQL**.
- Khi sửa tính năng business, thường phải kiểm tra cả `backend/app/routes`, `backend/app/crud`, `backend/app/schemas`, và UI/store/frontend API tương ứng.
- Với tính năng liên quan LUMO/thiết bị, cần kiểm tra cả REST route, WebSocket manager, và script test nếu có.
- Với tính năng notification/reminder, cần nhớ còn có scheduler background chứ không chỉ request/response thông thường.
- Với frontend, nhiều request đi qua Next proxy `/api/v1/...`, nên lỗi có thể nằm ở proxy chứ không chỉ backend.

---

## Tình trạng tài liệu này

Tài liệu này được viết bằng cách đối chiếu nhanh giữa:
- cấu trúc thư mục hiện tại
- một số file backend/frontend quan trọng
- `README.md`

Nó nên được xem là **bản onboarding thực dụng**, không phải nguồn sự thật tuyệt đối.

Nếu có gì sai, nên sửa trực tiếp file này để các phiên sau hiểu dự án đúng hơn.
