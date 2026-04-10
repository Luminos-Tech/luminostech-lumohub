# LumoHub - Hệ thống quản lý lịch thông minh và thiết bị IoT

<p align="center">
  <strong>Được phát triển bởi Luminos Tech</strong>
</p>

---

## Mục lục

- [Tổng quan dự án](#tổng-quan-dự-án)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Tính năng chính](#tính-năng-chính)
- [API Endpoints](#api-endpoints)
- [WebSocket Protocol](#websocket-protocol)
- [Cấu hình](#cấu-hình)
- [Hướng dẫn cài đặt](#hướng-dẫn-cài-đặt)
- [Hướng dẫn sử dụng](#hướng-dẫn-sử-dụng)
- [Thiết bị ESP32](#thiết-bị-esp32)
- [Bảo mật](#bảo-mật)
- [Giấy phép](#giấy-phép)

---

## Tổng quan dự án

**LumoHub** là hệ thống quản lý lịch và sự kiện thông minh tích hợp với thiết bị IoT **Lumo LuminosTech**, cung cấp:

- **Quản lý lịch**: Tạo sự kiện, nhắc nhở và thông báo đa kênh
- **AI Assistant LUMO**: Trợ lý giọng nói dựa trên Gemini/Groq với khả năng tương tác tự nhiên
- **Tích hợp ESP32**: Kết nối thiết bị IoT qua WebSocket để phát giọng nói (TTS) và nhận lệnh thoại
- **Quản trị hệ thống**: Quản lý người dùng, thiết bị và giám sát hệ thống
- **Giao diện web responsive**: Xây dựng bằng Next.js + Tailwind CSS, hỗ trợ mobile

Hệ thống kết nối thiết bị IoT vật lý với lịch đám mây, cho phép người dùng tương tác với lịch trình thông qua lệnh thoại trên thiết bị ESP32.

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                    Thiết bị ESP32 LUMO                        │
│         (Màn hình OLED + Mic + Loa + Nút bấm vật lý)          │
└──────────────────────────┬────────────────────────────────────┘
                           │ WebSocket (WSS)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                FastAPI Backend (Port 8000)                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ REST API     │  │ WebSocket    │  │ Background Tasks │  │
│  │ (Auth/CRUD)  │  │ (LUMO/TTS)   │  │ (APScheduler)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ LUMO AI      │  │ TTS Stream   │  │ Notification     │  │
│  │(Gemini/Groq) │  │(Google TTS)  │  │ Engine           │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────┬────────────────────────────────────┘
                           │ SQLAlchemy ORM
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                PostgreSQL 16 (Port 5432)                      │
│                                                              │
│  users | events | reminders | notifications | devices |      │
│  event_buttons | user_sessions | system_logs                 │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ Next.js API Proxy
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                Next.js Frontend (Port 3000)                   │
│                                                              │
│  Dashboard | Calendar | Events | Notifications | Settings    │
│  Admin Panel | WebSocket Test Tool                           │
└─────────────────────────────────────────────────────────────┘
```

### Luồng dữ liệu

1. Người dùng tạo sự kiện qua Web Dashboard
2. APScheduler kiểm tra và kích hoạt nhắc nhở khi đến giờ
3. Thông báo được lưu vào database và gửi qua WebSocket
4. Thiết bị LUMO nhận thông báo và phát giọng nói qua TTS
5. Người dùng có thể tương tác bằng giọng nói (STT → Gemini → TTS)
6. Lịch sử bấm nút vật lý được hiển thị trên Web Dashboard

---

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
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── calendar/
│   │   │   │   ├── events/
│   │   │   │   ├── notifications/
│   │   │   │   ├── settings/
│   │   │   │   │   ├── devices/
│   │   │   │   │   └── event-buttons/
│   │   │   │   └── admin/
│   │   │   │       ├── users/
│   │   │   │       ├── logs/
│   │   │   │       └── websocket/
│   │   │   └── api/
│   │   │       ├── v1/[...path]/  # API proxy
│   │   │       ├── extract-events/
│   │   │       └── health/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── calendar/
│   │   │   ├── notifications/
│   │   │   ├── auth/
│   │   │   ├── profile/
│   │   │   ├── admin/
│   │   │   ├── common/
│   │   │   └── ui/
│   │   ├── features/            # API functions
│   │   │   ├── auth/
│   │   │   ├── events/
│   │   │   ├── notifications/
│   │   │   ├── calendar/
│   │   │   ├── devices/
│   │   │   ├── event-buttons/
│   │   │   └── admin/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── store/               # Zustand stores
│   │   └── types/
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
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

---

## Tính năng chính

### 1. Xác thực người dùng

- Đăng ký với email, mật khẩu (bcrypt hash)
- Đăng nhập với JWT (access token 30 phút, refresh token 7 ngày)
- Phân quyền theo vai trò: `user` và `admin`
- Quản lý session với refresh token lưu trong database

### 2. Quản lý lịch và sự kiện

- Tích hợp FullCalendar: xem theo ngày/tuần/tháng/danh sách
- CRUD sự kiện: tiêu đề, mô tả, địa điểm, thời gian bắt đầu/kết thúc
- Lọc sự kiện theo khoảng thời gian
- Hiển thị chi tiết sự kiện và nhắc nhở liên quan

### 3. Nhắc nhở và thông báo

- 3 loại nhắc nhở:
  - `web`: Thông báo trong ứng dụng qua WebSocket
  - `mobile`: Push notification (dự phòng)
  - `lumo`: Phát giọng nói qua thiết bị ESP32
- Lập lịch nhắc nhở dựa trên offset từ thời gian sự kiện
- Tự động tạo notification khi nhắc nhở được kích hoạt
- Đánh dấu đã đọc (từng cái hoặc tất cả)

### 4. LUMO AI Assistant

- 3 phiên bản LLM:
  - Version 1: Gemini 2.5 + Google Search
  - Version 2: Gemini 3.1 + Tavily Search
  - Version 3: Perplexity AI
- Pipeline audio đầy đủ: STT (Groq Whisper) → LLM → TTS (Gemini)
- AI trả lời bằng tiếng Việt, ngắn gọn (<25 từ), thân thiện
- TTS output: 24kHz mono 16-bit WAV, stream qua WebSocket
- Chế độ text-only qua REST API

### 5. Tích hợp thiết bị IoT

- Đăng ký thiết bị ESP32 bằng mã 4 chữ số
- Kết nối WebSocket: `/ws/lumo?device_id=XXXX`
- Quản lý tên thiết bị qua Web Dashboard
- Gửi tin nhắn text đến màn hình OLED của ESP32
- Stream TTS đến loa ESP32
- Ghi lại lịch sử bấm nút vật lý và liên kết với sự kiện
- Theo dõi trạng thái kết nối thiết bị

### 6. Quản trị hệ thống

- Quản lý người dùng: tạo, khóa/mở khóa, đổi vai trò, reset mật khẩu
- Nhật ký hệ thống: audit log cho các thao tác quản trị
- Xem tất cả sự kiện của người dùng
- Công cụ test WebSocket cho ESP32
- Gửi thông báo đến thiết bị cụ thể

---

## API Endpoints

Tất cả API có prefix `/api/v1`. Xác thực qua Bearer token trong header:

```
Authorization: Bearer <access_token>
```

### Authentication

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/auth/register` | Đăng ký người dùng mới | Không |
| POST | `/auth/login` | Đăng nhập, trả về token | Không |
| POST | `/auth/refresh` | Làm mới access token | Không |
| POST | `/auth/logout` | Đăng xuất (thu hồi session) | Có |
| GET | `/auth/me` | Lấy thông tin người dùng hiện tại | Có |

### Events

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/events` | Danh sách sự kiện (hỗ trợ `?start=&end=`) | Có |
| GET | `/events/{id}` | Chi tiết sự kiện | Có |
| POST | `/events` | Tạo sự kiện | Có |
| PATCH | `/events/{id}` | Cập nhật sự kiện | Có |
| DELETE | `/events/{id}` | Xóa sự kiện | Có |

### Notifications

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/notifications` | Danh sách thông báo | Có |
| PATCH | `/notifications/{id}/read` | Đánh dấu đã đọc | Có |
| PATCH | `/notifications/read-all` | Đánh dấu tất cả đã đọc | Có |

### Devices

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/devices` | Danh sách thiết bị | Có |
| POST | `/devices` | Đăng ký thiết bị (cần mã 4 số) | Có |
| PATCH | `/devices/{id}` | Cập nhật tên thiết bị | Có |
| DELETE | `/devices/{id}` | Xóa thiết bị | Có |

### LUMO AI

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/lumo/version1` | Gemini 2.5 + Google Search | Có |
| GET | `/lumo/version2` | Gemini 3.1 + Tavily Search | Có |
| GET | `/lumo/version3` | Perplexity AI | Có |
| POST | `/lumo/audio/` | Pipeline audio (STT → LLM → TTS) | Có |
| GET | `/lumo/` | Health check | Không |

### Admin

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/admin/users` | Danh sách người dùng (phân trang) | Admin |
| POST | `/admin/users` | Tạo người dùng | Admin |
| PATCH | `/admin/users/{id}/password` | Reset mật khẩu | Admin |
| PATCH | `/admin/users/{id}/lock` | Khóa tài khoản | Admin |
| PATCH | `/admin/users/{id}/unlock` | Mở khóa tài khoản | Admin |
| GET | `/admin/logs` | Xem system logs | Admin |

---

## WebSocket Protocol

### Endpoint: `/ws/stream`

Kết nối thiết bị ESP32 với LUMO AI.

**Kết nối:**
```
wss://api.example.com/ws/stream?device_id=1234
```

**Thiết bị → Server:**
```json
// Text-to-Speech
{"action": "tts", "text": "Bạn có cuộc họp lúc 3 giờ chiều"}

// Speech pipeline (STT → LLM → TTS)
{"action": "stt_tts", "audio_b64": "UklGRl..."}

// Ping
"ping"
```

**Server → Thiết bị:**
```json
// Lỗi
{"type": "error", "message": "TTS service unavailable"}

// Hoàn thành
{"type": "done"}

// Binary audio frames
<raw WAV audio data>
```

---

## Cấu hình

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql+asyncpg://lumohub:lumohub123@postgres:5432/lumohub_db

# Security
SECRET_KEY=your-super-secret-key-at-least-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# AI APIs
GEMINI_API_KEY=your-gemini-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key
GROQ_API_KEY=your-groq-api-key
TAVILY_API_KEY=your-tavily-api-key

# Logging
LUMO_LOG_PATH=system.log
```

### Frontend (.env.local)

```env
INTERNAL_API_URL=http://127.0.0.1:8000
```

---

## Hướng dẫn cài đặt

### Yêu cầu

- Docker & Docker Compose
- Python 3.11+ (cho development)
- Node.js 18+ (cho development)
- API keys: Gemini, Groq, Tavily

### Cài đặt với Docker (Khuyến nghị)

```bash
# 1. Clone repository
git clone https://github.com/luminostech/lumohub.git
cd lumohub

# 2. Cấu hình environment
cp backend/.env.example backend/.env
# Chỉnh sửa backend/.env và điền API keys

# 3. Khởi động services
docker compose up -d --build

# 4. Chạy migrations
docker compose exec backend alembic upgrade head

# 5. Seed dữ liệu mẫu
docker compose exec backend python -m app.db.seed

# 6. Truy cập ứng dụng
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Development (Local)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Chỉnh sửa .env
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend-web
npm install
cp .env.local.example .env.local
# Chỉnh sửa .env.local
npm run dev
```

---

## Hướng dẫn sử dụng

### Dashboard

Trang chủ (`/dashboard`) hiển thị:
- Lời chào với tên người dùng và ngày hiện tại
- Thống kê số sự kiện hôm nay và trong tháng
- Danh sách sự kiện hôm nay
- Thông báo gần đây

### Calendar

Trang lịch (`/calendar`) với FullCalendar:
- Xem theo tháng/tuần/ngày/danh sách
- Click vào ngày để tạo sự kiện
- Click vào sự kiện để xem chi tiết

### Events

Trang sự kiện (`/events`):
- Danh sách tất cả sự kiện
- Tìm kiếm và lọc theo ngày
- Tạo/sửa/xóa sự kiện
- Thêm nhắc nhở cho sự kiện

### Settings

**Profile** (`/settings`):
- Đổi tên hiển thị
- Đổi số điện thoại
- Đổi mật khẩu

**Devices** (`/settings/devices`):
- Xem thiết bị ESP32 đã đăng ký
- Thêm thiết bị mới (nhập mã 4 số)
- Đổi tên/xóa thiết bị

**Event Buttons** (`/settings/event-buttons`):
- Lịch sử bấm nút
- Xem sự kiện được kích hoạt
- Thống kê hôm nay

### Admin Panel

Chỉ dành cho admin (`/admin`):
- Quản lý người dùng
- Xem system logs
- Test WebSocket với ESP32
- Gửi thông báo đến thiết bị

---

## Thiết bị ESP32

Thiết bị Lumo LuminosTech có các tính năng:

1. **Kết nối**: WebSocket đến `/ws/stream?device_id=XXXX`
2. **Hiển thị**: Màn hình OLED hiển thị tin nhắn text
3. **Phát âm**: Loa phát TTS cho nhắc nhở và phản hồi AI
4. **Nghe**: Mic thu âm lệnh thoại (STT)
5. **Nút bấm**: Nút vật lý kích hoạt sự kiện liên kết

### Luồng giao tiếp

```
ESP32 → WebSocket → Backend
                   ↓
             [Xác thực device_id]
                   ↓
             [Xử lý message]
                   ↓
    ┌───────────┬───┴────┐
    ↓           ↓         ↓
  Gemini    Groq STT   TTS Stream
  (LLM)     (Speech)   (Audio)
    ↓           ↓         ↓
    └───────────┴─────────┘
                   ↓
            WebSocket Response
                   ↓
               ESP32
          (Hiển thị/Phát âm)
```

---

## Bảo mật

### Mật khẩu
- Hash bằng bcrypt (passlib)
- Yêu cầu độ mạnh tối thiểu khi đăng ký

### JWT Token
- Thuật toán HS256
- Access token: 30 phút
- Refresh token: 7 ngày, lưu trong DB, có thể thu hồi

### Phân quyền
- Admin endpoints được bảo vệ bởi `require_admin`
- User endpoints được bảo vệ bởi `get_current_user`
- Người dùng chỉ truy cập được dữ liệu của mình

### Validation
- Tất cả input qua Pydantic schemas
- SQLAlchemy ORM (parameterized queries) chống SQL injection
- CORS chỉ cho phép nguồn tin cậy

---

## Tài khoản mặc định (Chỉ dùng cho development)

> ⚠️ **KHÔNG sử dụng trong production!**

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| Admin | `admin@lumohub.com` | `Admin@123` |
| Demo User | `demo@lumohub.com` | `Demo@123` |

---

## Giấy phép

Bản quyền © 2026 **Luminos Tech**. Bảo lưu mọi quyền.
