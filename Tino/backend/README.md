# ---- Tino FastAPI Sample ----

A small FastAPI service used as a **reference / learning sample**.
It exposes a tiny `items` CRUD on top of PostgreSQL and is meant to be a
clean starting point before adopting the LumoHub backend conventions.

> NOTE: This README will be filled in after the product description in
> `../docs/` is finalized. Section below is intentionally **minimal** until
> then so we don't bias the write-up.


## Requirements

- Python 3.11+
- PostgreSQL reachable from the host (defaults to the local `lumohub_db`
  container; override with `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`)

## Install & run (local)

```bash
python -m venv .venv
. .venv/Scripts/activate   # Windows (PowerShell)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Once running:
- Swagger UI: <http://localhost:8000/docs>
- API root:    <http://localhost:8000/api/v1>
- Health:      <http://localhost:8000/api/v1/health>


## Configuration (env vars)

| Variable      | Default          | Notes                                    |
|---------------|------------------|------------------------------------------|
| `DB_HOST`     | `localhost`      | Use `lumohub_db` if running via compose  |
| `DB_PORT`     | `5432`           |                                          |
| `DB_USER`     | `lumohub`        |                                          |
| `DB_PASSWORD` | `lumohub123`     |                                          |
| `DB_NAME`     | `lumohub_db`     |                                          |
| `APP_DEBUG`   | `false`          | Set to `true` for verbose error pages    |


## Endpoints (summary)

| Method | Path                    | Description              |
|--------|-------------------------|--------------------------|
| GET    | `/`                     | Service info             |
| GET    | `/api/v1/health`        | Liveness                 |
| GET    | `/api/v1/items`         | List items               |
| POST   | `/api/v1/items`         | Create item              |
| GET    | `/api/v1/items/{id}`    | Fetch one                |
| PATCH  | `/api/v1/items/{id}`    | Partial update           |
| DELETE | `/api/v1/items/{id}`    | Remove                   |


## Layout

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py            # FastAPI app + lifespan
│   ├── config.py          # Settings (env-driven)
│   ├── db.py              # SQLAlchemy engine / session
│   ├── models.py          # ORM models
│   ├── schemas.py         # Pydantic v2 schemas
│   └── routes/
│       ├── __init__.py
│       └── api.py         # APIRouter: health + items CRUD
├── requirements.txt
├── .env.example
└── README.md              # ← to be expanded once docs/ is ready
```

---

> Detailed sections (architecture, deployment, troubleshooting, contributing…)
> will be added here **after** the product description in `../docs/` is done.
