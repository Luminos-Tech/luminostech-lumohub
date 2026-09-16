"""Runtime configuration loaded from environment variables."""

from functools import lru_cache
import os


class Settings:
    """Application settings."""

    app_name: str = "Tino FastAPI Sample"
    debug: bool = os.getenv("APP_DEBUG", "false").lower() == "true"

    # Database (Postgres) — defaults match the LumoHub `lumohub_db` container
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: int = int(os.getenv("DB_PORT", "5432"))
    db_user: str = os.getenv("DB_USER", "lumohub")
    db_password: str = os.getenv("DB_PASSWORD", "lumohub123")
    db_name: str = os.getenv("DB_NAME", "lumohub_db")

    @property
    def database_url(self) -> str:
        # SQLAlchemy uses postgresql+psycopg2 (psycopg2-binary is the typical driver)
        return (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
