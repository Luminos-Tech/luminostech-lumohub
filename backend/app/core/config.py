from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://lumohub:lumohub123@localhost:5432/lumohub_db"
    SECRET_KEY: str = "lumohub-secret-key-change-in-production-must-be-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "https://lumohub.luminostech.tech, https://api.luminostech.tech"
    APP_ENV: str = "development"

    GEMINI_API_KEY: str = ""
    PERPLEXITY_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    LUMO_LOG_PATH: str = "system.log"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
