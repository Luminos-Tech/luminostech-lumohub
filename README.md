# LumoHub - 智能日历与物联网事件管理系统

<p align="center">
  <strong>由 Luminos Tech 驱动</strong>
</p>

---

## 目录

- [项目概述](#项目概述)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [功能特性](#功能特性)
  - [用户认证](#用户认证)
  - [日历与事件](#日历与事件)
  - [提醒与通知](#提醒与通知)
  - [LUMO AI 助手](#lumo-ai-助手)
  - [物联网设备集成](#物联网设备集成)
  - [管理后台](#管理后台)
- [API 接口](#api-接口)
  - [认证](#认证)
  - [用户](#用户)
  - [事件](#事件)
  - [提醒](#提醒)
  - [通知](#通知)
  - [日历](#日历)
  - [设备](#设备)
  - [事件按钮](#事件按钮)
  - [LUMO AI](#lumo-ai)
  - [管理](#管理)
- [WebSocket 协议](#websocket-协议)
- [数据库模型](#数据库模型)
- [配置说明](#配置说明)
- [快速开始](#快速开始)
  - [前置条件](#前置条件)
  - [Docker 部署（推荐）](#docker-部署推荐)
  - [本地开发](#本地开发)
- [前端使用指南](#前端使用指南)
- [ESP32 物联网设备](#esp32-物联网设备)
- [LUMO AI 语音处理管道](#lumo-ai-语音处理管道)
- [定时任务](#定时任务)
- [安全机制](#安全机制)
- [默认账户（仅供开发使用）](#默认账户仅供开发使用)
- [许可证](#许可证)

---

## 项目概述

**LumoHub** 是一个全栈智能日历和事件管理系统，专为 **Lumo LuminosTech** 物联网设备生态设计，提供以下核心能力：

- **日历管理**：支持事件创建、循环提醒和多渠道通知
- **AI 语音助手 LUMO**：基于 Gemini/Groq 构建，支持自然语音交互
- **ESP32 物联网设备集成**：通过 WebSocket 实时进行语音播报（TTS）和语音对话
- **管理后台**：用户管理、设备管理、系统监控
- **响应式 Web 界面**：基于 Next.js + Tailwind CSS 构建，支持移动端访问

系统将物理物联网设备与云端日历智能连接，使用户能够通过 ESP32 智能设备上的语音命令与日程安排进行交互。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        ESP32 设备                             │
│            （OLED 显示屏 + 麦克风 + 扬声器 + 物理按键）           │
└──────────────────────────┬────────────────────────────────────┘
                           │ WebSocket (WSS)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI 后端（端口 8000）                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ REST API     │  │ WebSocket    │  │ 后台定时任务        │  │
│  │ (认证/CRUD) │  │ (LUMO/TTS)   │  │ (APScheduler)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ LUMO AI      │  │ TTS 流       │  │ 通知引擎          │  │
│  │ (Gemini/Groq)│  │ (Google TTS) │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└──────────────────────────┬────────────────────────────────────┘
                           │ SQLAlchemy ORM
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16（端口 5432）                   │
│                                                              │
│  users | events | reminders | notifications |                 │
│  devices | event_buttons | user_sessions |                    │
│  system_logs | admin_actions                                  │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ Next.js API 代理
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 前端（端口 3000）                   │
│                                                              │
│  Dashboard | Calendar | Events | Notifications | Settings |     │
│  Admin Dashboard | WebSocket 测试工具                          │
└─────────────────────────────────────────────────────────────┘
```

### 数据流向

1. **用户**通过 Web Dashboard 创建事件
2. **APScheduler** 检测到提醒到期，触发通知
3. **通知**保存到数据库，并通过 WebSocket 推送给所有已连接客户端
4. **LUMO 设备**接收 WebSocket 消息，使用 TTS 语音播报事件
5. **用户**可以通过语音命令与 LUMO 交互（STT → Gemini → TTS）
6. **物理按键**按压记录显示在 Web Dashboard 中

---

## 技术栈

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| **Python** | 3.12 | 编程语言 |
| **FastAPI** | 0.111.0 | Web 框架，支持异步 |
| **Uvicorn** | ASGI | ASGI 服务器 |
| **Pydantic** | 2.7.1 | 数据验证与序列化 |
| **SQLAlchemy** | 2.0.30 | SQL ORM 工具包 |
| **Alembic** | 1.13.1 | 数据库迁移 |
| **PostgreSQL** | 16 | 关系数据库 |
| **python-jose** | JWT | JWT 令牌处理（HS256）|
| **passlib[bcrypt]** | 密码哈希 | 安全密码存储 |
| **google-genai** | 1.11.0 | Gemini API（LLM + TTS）|
| **groq** | >=0.12.0 | Groq API（Whisper STT）|
| **APScheduler** | 3.10.4 | 后台任务调度 |
| **httpx** | 0.28.1 | HTTP 客户端 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 14 | React 框架，App Router |
| **React** | 18 | UI 库 |
| **TypeScript** | 5 | 类型安全 JavaScript |
| **Tailwind CSS** | 3.4 | 工具优先 CSS 框架 |
| **Zustand** | 4.5 | 状态管理 |
| **react-hook-form** | 表单管理 | 表单状态处理 |
| **zod** | Schema 验证 | 运行时类型验证 |
| **@fullcalendar** | 日历 | 日历 UI 组件 |
| **axios** | HTTP 客户端 | API 通信 |
| **Lucide React** | 图标 | 图标库 |
| **Sonner** | Toast | 通知提示 |
| **date-fns** | 日期工具 | 日期处理 |

### 基础设施

| 技术 | 用途 |
|------|------|
| **Docker** | 容器化 |
| **docker-compose** | 多容器编排 |
| **PostgreSQL 16 Alpine** | 数据库容器 |

---

## 项目结构

```
lumohub/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI 应用入口
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic 配置（从 .env 读取）
│   │   │   └── security.py            # JWT 创建/验证，密码哈希
│   │   ├── crud/
│   │   │   ├── base.py                # 通用 CRUD 操作
│   │   │   ├── user.py                # 用户 CRUD
│   │   │   ├── event.py               # 事件 CRUD
│   │   │   ├── reminder.py            # 提醒 CRUD
│   │   │   ├── notification.py         # 通知 CRUD
│   │   │   ├── device.py              # 设备 CRUD
│   │   │   ├── event_button.py        # EventButton CRUD
│   │   │   ├── session.py             # 会话 CRUD
│   │   │   └── log.py                 # 日志 CRUD
│   │   ├── db/
│   │   │   ├── session.py             # SQLAlchemy 异步会话工厂
│   │   │   ├── init_db.py             # 数据库初始化
│   │   │   └── seed.py                # 种子数据（默认管理员/演示用户）
│   │   ├── models/
│   │   │   ├── __init__.py            # 导出所有 SQLAlchemy 模型
│   │   │   ├── user.py                # 用户模型（id, email, hashed_password, role）
│   │   │   ├── event.py               # 事件模型（title, description, start/end, user_id）
│   │   │   ├── reminder.py            # 提醒模型（type: web/mobile/lumo, remind_before_minutes, channel）
│   │   │   ├── notification.py        # 通知模型（user_id, event_id, is_read）
│   │   │   ├── device.py              # 设备模型（code, name, user_id）
│   │   │   ├── event_button.py        # EventButton 模型（device_id, event_id, pressed_at）
│   │   │   ├── user_session.py        # UserSession 模型（refresh tokens）
│   │   │   ├── system_log.py          # SystemLog 模型（审计日志）
│   │   │   └── admin_action.py       # AdminAction 模型
│   │   ├── routes/
│   │   │   ├── __init__.py            # APIRouter 聚合
│   │   │   ├── auth.py                # /api/v1/auth/* 端点
│   │   │   ├── users.py               # /api/v1/users/* 端点
│   │   │   ├── events.py              # /api/v1/events/* 端点
│   │   │   ├── reminders.py           # /api/v1/reminders/* 端点
│   │   │   ├── notifications.py      # /api/v1/notifications/* 端点
│   │   │   ├── calendar.py            # /api/v1/calendar/* 端点
│   │   │   ├── devices.py             # /api/v1/devices/* 端点
│   │   │   ├── event_buttons.py       # /api/v1/event-buttons/* 端点
│   │   │   ├── admin.py               # /api/v1/admin/* 端点
│   │   │   └── lumo.py                # /api/v1/lumo/* 端点（AI + 音频管道）
│   │   ├── schemas/
│   │   │   ├── __init__.py           # Pydantic schema 导出
│   │   │   ├── user.py               # UserCreate, UserUpdate, UserResponse
│   │   │   ├── event.py              # EventCreate, EventUpdate, EventResponse
│   │   │   ├── reminder.py           # ReminderCreate, ReminderUpdate
│   │   │   ├── notification.py        # NotificationResponse
│   │   │   ├── device.py             # DeviceCreate, DeviceUpdate, DeviceResponse
│   │   │   ├── event_button.py       # EventButtonCreate, EventButtonResponse
│   │   │   └── auth.py               # Token schemas（access, refresh）
│   │   ├── services/
│   │   │   └── dependencies.py       # FastAPI 依赖项（get_db, get_current_user）
│   │   ├── tasks/
│   │   │   └── scheduler.py          # APScheduler：提醒检查、会话清理
│   │   ├── utils/
│   │   │   └── helpers.py           # 工具函数
│   │   └── websocket/
│   │       ├── __init__.py          # WebSocket 路由注册
│   │       ├── manager.py           # WebSocket 连接管理器
│   │       ├── routes.py            # WebSocket 端点（/ws/lumo, /ws/stream）
│   │       └── tts_stream.py       # TTS 流处理管道（Gemini → WAV 分块）
│   ├── alembic/
│   │   ├── env.py                  # Alembic 迁移环境
│   │   ├── script.py.mako
│   │   └── versions/
│   │       ├── 0001_initial.py     # 初始 schema
│   │       ├── 0002_add_devices.py # 设备相关表
│   │       └── 0003_add_event_buttons.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── .env
│
├── frontend-web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # 根布局（html/body）
│   │   │   ├── globals.css         # Tailwind CSS 导入
│   │   │   ├── page.tsx           # 根重定向 → /dashboard
│   │   │   ├── (auth)/
│   │   │   │   ├── layout.tsx     # 认证布局（无侧边栏）
│   │   │   │   ├── login/page.tsx    # 登录页
│   │   │   │   └── register/page.tsx # 注册页
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx     # 受保护布局：侧边栏 + 顶部栏
│   │   │   │   ├── page.tsx       # /dashboard - 概览统计
│   │   │   │   ├── calendar/page.tsx    # FullCalendar 日历视图
│   │   │   │   ├── events/page.tsx      # 事件列表 + 创建/编辑弹窗
│   │   │   │   ├── notifications/page.tsx  # 通知列表
│   │   │   │   ├── settings/
│   │   │   │   │   ├── page.tsx        # 个人资料与密码设置
│   │   │   │   │   ├── devices/page.tsx    # 设备管理
│   │   │   │   │   └── event-buttons/page.tsx  # 按键历史
│   │   │   │   └── admin/
│   │   │   │       ├── page.tsx        # 管理后台概览
│   │   │   │       ├── users/page.tsx  # 用户管理
│   │   │   │       ├── logs/page.tsx   # 系统日志
│   │   │   │       └── websocket/page.tsx  # ESP32 WebSocket 测试工具
│   │   │   └── api/v1/[...path]/route.ts  # API 代理（转发到后端）
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── ProtectedLayout.tsx  # 认证守卫组件
│   │   │   │   ├── Sidebar.tsx         # 导航侧边栏（含角色判断）
│   │   │   │   ├── Topbar.tsx          # 顶部栏（含通知铃铛）
│   │   │   │   └── BottomNav.tsx       # 移动端底部导航
│   │   │   ├── calendar/
│   │   │   │   ├── CalendarView.tsx    # FullCalendar 包装组件
│   │   │   │   ├── EventFormModal.tsx  # 创建/编辑事件表单弹窗
│   │   │   │   ├── EventDetailModal.tsx  # 事件详情弹窗
│   │   │   │   └── AIImportModal.tsx   # AI 导入事件弹窗
│   │   │   ├── notifications/
│   │   │   │   ├── NotificationBell.tsx   # 通知铃铛组件
│   │   │   │   ├── NotificationList.tsx   # 通知列表组件
│   │   │   │   └── NotificationItem.tsx   # 单条通知组件
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.tsx       # 登录表单
│   │   │   │   └── RegisterForm.tsx   # 注册表单
│   │   │   ├── profile/
│   │   │   │   ├── ProfileForm.tsx    # 个人资料表单
│   │   │   │   └── AvatarUpload.tsx   # 头像上传
│   │   │   ├── admin/
│   │   │   │   ├── CreateUserModal.tsx    # 创建用户弹窗
│   │   │   │   ├── ResetPasswordModal.tsx # 重置密码弹窗
│   │   │   │   └── RoleBadge.tsx         # 角色徽章
│   │   │   └── common/
│   │   │       ├── Modal.tsx          # 通用弹窗
│   │   │       ├── Button.tsx         # 通用按钮
│   │   │       ├── Input.tsx          # 通用输入框
│   │   │       ├── Spinner.tsx       # 加载动画
│   │   │       └── LoadingSpinner.tsx # 加载指示器
│   │   ├── features/
│   │   │   ├── auth.ts               # 认证 API 函数
│   │   │   ├── events.ts            # 事件 API 函数
│   │   │   ├── reminders.ts         # 提醒 API 函数
│   │   │   ├── notifications.ts     # 通知 API 函数
│   │   │   ├── calendar.ts           # 日历 API 函数
│   │   │   ├── devices.ts           # 设备 API 函数
│   │   │   ├── event_buttons.ts      # EventButton API 函数
│   │   │   └── admin.ts             # 管理 API 函数
│   │   ├── hooks/
│   │   │   └── useLumoWebSocket.ts  # LUMO WebSocket 连接 Hook
│   │   ├── lib/
│   │   │   ├── api.ts               # Axios 实例（含认证拦截器）
│   │   │   ├── publicApi.ts         # 公开 API 实例（无需认证）
│   │   │   ├── utils.ts             # 工具函数
│   │   │   └── env.ts              # 环境变量工具
│   │   ├── store/
│   │   │   ├── authStore.ts         # 认证状态（user, token, login/logout）
│   │   │   ├── eventStore.ts        # 事件状态（含 API 同步）
│   │   │   ├── notificationStore.ts  # 通知状态 + 未读数
│   │   │   ├── deviceStore.ts       # 设备状态
│   │   │   └── eventButtonStore.ts  # EventButton 状态
│   │   └── types/
│   │       └── index.ts             # 所有 TypeScript 接口定义
│   ├── public/
│   ├── package.json
│   ├── .env.local.example
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── docker-compose.yml                  # PostgreSQL + Backend + Frontend
├── docker-compose.dev.yml              # 开发环境配置（含文件挂载）
└── README.md
```

---

## 功能特性

### 用户认证

- **注册**：填写 email、密码（bcrypt 哈希）和显示名称
- **登录**：email/密码登录，返回 JWT access token（30分钟）+ refresh token（7天）
- **JWT 会话**：使用 HS256 算法，python-jose 处理
- **Token 刷新**：通过 `/api/v1/auth/refresh` 刷新 access token
- **基于角色的访问控制**：支持 `user` 和 `admin` 角色
- **会话管理**：refresh token 入库，支持主动撤销

### 日历与事件

- **FullCalendar 集成**：支持日视图、周视图、月视图和列表视图
- **事件 CRUD**：包含标题、描述、地点、开始/结束时间
- **日期范围筛选**：事件列表端点支持 `?start=&end=` 筛选
- **事件详情弹窗**：展示事件的完整信息及关联提醒
- **Dashboard 今日视图**：显示今日事件和快速统计

### 提醒与通知

- **三种提醒类型**：
  - `web` — 应用内通知，通过 WebSocket 推送
  - `mobile` — 移动推送通知（预留）
  - `lumo` — 通过 ESP32 TTS 语音播报
- **提醒调度**：基于事件开始时间的偏移量（分钟/小时/天）
- **自动创建通知**：提醒触发时自动创建 Notification 记录
- **WebSocket 广播**：实时推送所有已连接客户端
- **标记已读**：支持单条标记和全部标记

### LUMO AI 助手

- **三种 LLM 版本**：
  - **Version 1**：Gemini 2.5 + Google Search
  - **Version 2**：Gemini 3.1 + Tavily 网络搜索
  - **Version 3**：Perplexity AI
- **完整音频管道**：STT（Groq Whisper）→ LLM → TTS（Gemini）
- **越南语 AI**：带有角色规则（回复少于25字、友好语气）
- **TTS 输出**：24kHz 单声道 16位 WAV，通过 WebSocket 流式传输
- **Kore 音色**：使用预置音色进行 TTS 生成
- **纯文本模式**：通过 REST API 进行文字对话，无需音频

### 物联网设备集成

- **ESP32 设备注册**：通过4位配对码注册
- **WebSocket 连接**：ESP32 连接 `/ws/lumo?device_id=XXXX`
- **设备命名与管理**：在 Web Dashboard 中管理设备
- **实时文字消息**：发送文字到 ESP32 OLED 显示屏
- **TTS 流媒体**：将语音流传输到 ESP32 扬声器
- **物理按键日志**：按键按压记录与事件关联
- **设备连接状态**：追踪设备在线状态

### 管理后台

- **用户管理**：创建、锁定/解锁、更改角色、重置密码
- **系统日志**：审计所有管理操作
- **事件浏览器**：查看所有用户的事件
- **WebSocket 测试工具**：测试 ESP32 连接并直接发送消息
- **设备通知**：向指定设备发送通知

---

## API 接口

所有 API 端点前缀为 `/api/v1`。认证通过请求头中的 Bearer token：

```
Authorization: Bearer <access_token>
```

### 认证

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `POST` | `/auth/register` | 注册新用户 | 否 |
| `POST` | `/auth/login` | 登录，返回 Token | 否 |
| `POST` | `/auth/refresh` | 刷新 Access Token | 否 |
| `POST` | `/auth/logout` | 登出（撤销会话）| 是 |
| `GET` | `/auth/me` | 获取当前用户信息 | 是 |

**注册请求：**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "张三"
}
```

**登录响应：**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### 用户

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/users/me` | 获取当前用户资料 | 是 |
| `PATCH` | `/users/me` | 更新资料（姓名、电话）| 是 |
| `PATCH` | `/users/me/password` | 修改密码 | 是 |

### 事件

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/events` | 列出事件（支持 `?start=&end=` 筛选）| 是 |
| `GET` | `/events/{id}` | 获取单个事件 | 是 |
| `POST` | `/events` | 创建事件（自动创建提醒）| 是 |
| `PATCH` | `/events/{id}` | 更新事件 | 是 |
| `DELETE` | `/events/{id}` | 删除事件 | 是 |

**创建事件请求：**
```json
{
  "title": "团队会议",
  "description": "每周同步会议",
  "location": "会议室 A",
  "start": "2026-04-03T10:00:00",
  "end": "2026-04-03T11:00:00",
  "reminders": [
    { "type": "lumo", "remind_before_minutes": 5 },
    { "type": "web", "remind_before_minutes": 15 }
  ]
}
```

### 提醒

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/reminders` | 列出用户的提醒 | 是 |
| `POST` | `/events/{id}/reminders` | 为事件添加提醒 | 是 |
| `PATCH` | `/reminders/{id}` | 更新提醒 | 是 |
| `DELETE` | `/reminders/{id}` | 删除提醒 | 是 |

### 通知

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/notifications` | 列出通知 | 是 |
| `PATCH` | `/notifications/{id}/read` | 标记已读 | 是 |
| `PATCH` | `/notifications/read-all` | 全部标记已读 | 是 |

### 日历

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/calendar` | 获取日历事件（`?start=&end=`）| 是 |

### 设备

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/devices` | 列出用户设备 | 是 |
| `GET` | `/devices/{id}` | 获取设备详情 | 是 |
| `POST` | `/devices` | 注册设备（需要4位码）| 是 |
| `PATCH` | `/devices/{id}` | 更新设备名称 | 是 |
| `DELETE` | `/devices/{id}` | 删除设备 | 是 |

### 事件按钮

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `POST` | `/event-buttons` | 记录按键按压 | 是 |
| `GET` | `/event-buttons` | 列出按键记录 | 是 |
| `GET` | `/event-buttons/today` | 获取今日按键状态 | 是 |

### LUMO AI

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/lumo/version1` | Gemini 2.5 + Google Search | 是 |
| `GET` | `/lumo/version2` | Gemini 3.1 + Tavily Search | 是 |
| `GET` | `/lumo/version3` | Perplexity AI | 是 |
| `POST` | `/lumo/audio/` | 完整音频管道（STT → LLM → TTS）| 是 |
| `GET` | `/lumo/` | 健康检查 | 否 |

**文本查询参数：** `?textLumoCallServer=<message>`

**音频管道请求（multipart/form-data）：**
```
audio: <audio_file> (audio/webm 或 audio/mp4)
```

### 管理

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/admin/users` | 列出所有用户（分页）| 管理员 |
| `POST` | `/admin/users` | 创建用户 | 管理员 |
| `PATCH` | `/admin/users/{id}/password` | 重置用户密码 | 管理员 |
| `PATCH` | `/admin/users/{id}/lock` | 锁定用户账户 | 管理员 |
| `PATCH` | `/admin/users/{id}/unlock` | 解锁用户账户 | 管理员 |
| `PATCH` | `/admin/users/{id}/role` | 更改用户角色 | 管理员 |
| `GET` | `/admin/logs` | 查看系统日志 | 管理员 |
| `GET` | `/admin/events` | 查看所有事件 | 管理员 |
| `POST` | `/admin/device/notify` | 向设备发送通知 | 管理员 |
| `POST` | `/admin/device/send` | 向 ESP32 发送文字 | 管理员 |

---

## WebSocket 协议

### 端点 1：`/ws/stream`

ESP32 设备连接 LUMO AI 交互。

**连接方式：**
```
wss://api.example.com/ws/stream?device_id=1234
```

**设备 → 服务器消息：**

```json
// 文字转语音请求
{"action": "tts", "text": "您有一个会议在下午3点"}

// 语音管道（STT → LLM → TTS）
{"action": "stt_tts", "audio_b64": "UklGRl..."}

// 保活
"ping"
```

**服务器 → 设备响应：**

```json
// 错误
{"type": "error", "message": "TTS 服务不可用"}

// 完成
{"type": "done"}

// 二进制帧
<raw WAV audio data>
```

### 端点 2：`/ws/lumo`

WebSocket 路由聚合端点，内部调用 stream 端点处理 LUMO 设备消息。

---

## 数据库模型

### Users 表
| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | 主键 |
| email | VARCHAR(255) | 唯一，非空 |
| name | VARCHAR(255) | 非空 |
| hashed_password | VARCHAR(255) | 非空 |
| role | VARCHAR(50) | 默认 'user' |
| is_locked | BOOLEAN | 默认 FALSE |
| phone | VARCHAR(50) | 可空 |
| avatar_url | VARCHAR(500) | 可空 |
| created_at | TIMESTAMP | 默认 NOW() |

### Events 表
| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 外键 → users.id |
| title | VARCHAR(255) | 非空 |
| description | TEXT | |
| location | VARCHAR(255) | |
| start_time | TIMESTAMP | 非空 |
| end_time | TIMESTAMP | 非空 |
| created_at | TIMESTAMP | 默认 NOW() |

### Reminders 表
| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | 主键 |
| event_id | UUID | 外键 → events.id |
| channel | VARCHAR(50) | 非空（web/mobile/lumo）|
| remind_before_minutes | INTEGER | 非空 |
| is_sent | BOOLEAN | 默认 FALSE |

### Notifications 表
| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 外键 → users.id |
| event_id | UUID | 外键 → events.id（可空）|
| title | VARCHAR(255) | 非空 |
| content | TEXT | 非空 |
| is_read | BOOLEAN | 默认 FALSE |
| created_at | TIMESTAMP | 默认 NOW() |

### Devices 表
| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | 主键 |
| code | VARCHAR(4) | 唯一，非空 |
| name | VARCHAR(255) | 非空 |
| user_id | UUID | 外键 → users.id |
| created_at | TIMESTAMP | 默认 NOW() |

### EventButtons 表
| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | 主键 |
| device_id | UUID | 外键 → devices.id |
| event_id | UUID | 外键 → events.id（可空）|
| pressed_at | TIMESTAMP | 默认 NOW() |

### UserSessions 表
| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 外键 → users.id |
| refresh_token | VARCHAR(255) | 非空 |
| expires_at | TIMESTAMP | 非空 |
| created_at | TIMESTAMP | 默认 NOW() |

---

## 配置说明

### 后端环境变量

从 `backend/.env.example` 复制并创建 `backend/.env`：

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://lumohub:lumohub123@postgres:5432/lumohub_db

# 安全
SECRET_KEY=your-super-secret-key-at-least-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=https://lumohub.luminostech.tech, https://api.luminostech.tech

# AI API（必须配置）
GEMINI_API_KEY=your-google-gemini-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key
GROQ_API_KEY=your-groq-api-key
TAVILY_API_KEY=your-tavily-api-key

# 日志
LUMO_LOG_PATH=system.log
```

### 前端环境变量

从 `frontend-web/.env.local.example` 复制并创建 `frontend-web/.env.local`：

```env
# 指向后端 API（在生产环境使用 /api/v1 代理）
INTERNAL_API_URL=http://127.0.0.1:8000
```

---

## 快速开始

### 前置条件

- **Docker** 和 **Docker Compose** 已安装
- **Python 3.11+**（本地开发）
- **Node.js 18+**（本地前端开发）
- Gemini、Groq、Tavily 的 API Key

### Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/luminostech/lumohub.git
cd lumohub

# 2. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 API Key

# 3. 启动所有服务
docker compose up -d --build

# 4. 数据库迁移
docker compose exec backend alembic upgrade head

# 5. 初始化种子数据
docker compose exec backend python -m app.db.seed

# 6. 访问应用
# 前端：http://localhost:3000
# 后端 API：http://localhost:8000
# API 文档：http://localhost:8000/docs
```

### 本地开发

**后端：**
```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境
cp .env.example .env
# 编辑 .env 填入 API Key

# 数据库迁移
alembic upgrade head

# 初始化种子数据
python -m app.db.seed

# 启动开发服务器（热重载）
uvicorn app.main:app --reload --port 8000
```

**前端：**
```bash
cd frontend-web

# 安装依赖
npm install

# 配置环境
cp .env.local.example .env.local
# 编辑 .env.local

# 启动开发服务器
npm run dev
```

---

## 前端使用指南

### Dashboard

主页（`/dashboard`）提供：
- 用户名和当前日期问候语
- 今日事件数量统计
- 本月事件总数
- 今日事件列表及快捷操作
- 最近通知

### 日历

日历页面（`/calendar`）使用 FullCalendar，支持：
- **月视图**（默认）
- **周视图**
- **日视图**
- **列表视图**
- 点击日期创建事件
- 点击事件查看详情

### 事件管理

事件页面（`/events`）提供：
- 所有事件列表，支持搜索
- 弹窗表单创建事件
- 弹窗表单编辑事件
- 确认删除事件
- 创建/编辑事件时添加/编辑提醒
- 按日期范围筛选

### 通知

通知页面（`/notifications`）提供：
- 所有通知按时间倒序排列
- 单条通知标记已读
- 全部标记已读按钮
- 顶部栏通知铃铛含未读数徽章

### 设置

**个人资料设置**（`/settings`）：
- 修改显示名称
- 修改电话号码
- 修改密码

**设备管理**（`/settings/devices`）：
- 查看已注册的 ESP32 设备
- 添加新设备（输入4位码）
- 重命名设备
- 删除设备

**事件按钮**（`/settings/event-buttons`）：
- 查看按键按压历史
- 查看触发了哪些事件
- 今日按键按压汇总

### 管理后台

仅限拥有 `admin` 角色的用户访问。

**概览**（`/admin`）：
- 用户总数
- 活跃会话数
- 系统日志表格

**用户管理**（`/admin/users`）：
- 用户分页列表
- 创建新用户
- 重置密码
- 锁定/解锁账户
- 更改用户角色（user ↔ admin）

**WebSocket 测试工具**（`/admin/websocket`）：
- 测试 ESP32 设备连接
- 向设备发送 TTS 消息
- 监控 WebSocket 状态
- 查看设备列表及连接状态

---

## ESP32 物联网设备

ESP32 设备（Lumo LuminosTech）功能：

1. **连接**：通过 WebSocket 连接后端 `/ws/stream?device_id=XXXX`
2. **显示**：在 OLED 屏幕上显示文字消息
3. **播报**：通过 TTS 语音播报事件提醒和 AI 响应
4. **聆听**：通过麦克风接收语音命令（STT）
5. **按键**：按压物理按键触发关联事件

### 设备通信流程

```
ESP32 → WebSocket → 后端
                   ↓
             [验证设备码]
                   ↓
             [路由消息]
                   ↓
    ┌───────────┬───┴────┐
    ↓           ↓         ↓
  Gemini     Groq STT   TTS 流
  (LLM)     (语音识别)  (音频)
    ↓           ↓         ↓
    └───────────┴─────────┘
                   ↓
            WebSocket 响应
                   ↓
               ESP32
          (显示/播报语音)
```

### 物理按键集成

- 每个设备有一个或多个物理按键
- 按键按压通过 `POST /api/v1/event-buttons` 记录
- 按键可与日历事件关联
- 今日按键状态可在 `/settings/event-buttons` 查看

---

## LUMO AI 语音处理管道

### 管道流程

```
麦克风 → ESP32 → Base64 音频 → WebSocket → 后端
                                            ↓
                                       Groq API
                                     (Whisper STT)
                                            ↓
                                       Gemini API
                                       (LLM + TTS)
                                            ↓
                                       WAV 音频
                                            ↓
                                       WebSocket
                                            ↓
              ESP32 ← Base64 音频 ← 后端
                   (DAC → 扬声器)
```

### TTS 流媒体详情

1. 客户端发送 `{action: "tts", text: "..."}` 到 `/ws/stream`
2. 后端调用 `tts_stream_manager.stream_tts()`
3. Gemini TTS 使用 `kore` 音色生成音频
4. 音频分块为 ~10KB WAV 帧
5. 二进制帧通过 WebSocket 发送
6. 收到 `{"type": "done"}` 消息表示完成

### LUMO 角色规则

LUMO（AI 助手）遵循以下规则：
- 始终使用**越南语**回复
- 回复**少于25字**，快速 TTS 播放
- **友好、温暖、关心**的语气
- **从不拒绝** — 无法帮助时建议替代方案
- 应用场景：事件提醒、快速问答、语音交互

---

## 定时任务

### 提醒检查（APScheduler）

每 **1 分钟**执行一次：
1. 查询所有 `is_sent = false` 且 `scheduled_time <= now` 的提醒
2. 为用户创建 `Notification` 记录
3. 通过 WebSocket 广播给所有已连接客户端
4. 若提醒类型为 `lumo`，向用户的设备发送 TTS 消息
5. 将提醒标记为 `is_sent = true`

### 会话清理（APScheduler）

每 **1 小时**执行一次：
1. 从 `user_sessions` 表删除过期的 refresh token
2. 保持会话表整洁

---

## 安全机制

### 密码安全
- 密码通过 **bcrypt**（passlib）哈希存储
- 注册时强制最低密码要求

### JWT Token
- 使用 **HS256** 算法签名
- Access token 短有效期（默认30分钟）
- Refresh token 长有效期（默认7天）
- Refresh token 入库，支持撤销

### 基于角色的访问控制
- **管理端点**使用 `require_admin` 依赖保护
- **用户端点**使用 `get_current_user` 依赖保护
- 用户只能访问自己的事件、设备、通知

### 输入验证
- 所有请求数据通过 **Pydantic schemas** 验证
- **SQLAlchemy ORM**（参数化查询）防止 SQL 注入
- CORS 配置为仅限信任来源

### 管理员安全
- 登录失败可锁定账户（管理操作）
- 所有管理操作记录在 `admin_actions` 和 `system_logs` 表
- 管理员可强制锁定/解锁用户账户

---

## 默认账户（仅供开发使用）

> ⚠️ **生产环境禁止使用！**

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | `admin@lumohub.com` | `Admin@123` |
| 演示用户 | `demo@lumohub.com` | `Demo@123` |

---

## 许可证

版权所有 © 2026 **Luminos Tech**。保留所有权利。
