"""
Config file for the backend

    - Giữ các biến cấu hình hệ thống tại đây
    - Đọc giá trị từ .env file
    - Gom lại thành một Object settings
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = ""
    SECRET_KEY: str = ""
    ALGORITHM: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "https://lumohub.luminostech.tech, https://api.luminostech.tech"
    APP_ENV: str = ""

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
