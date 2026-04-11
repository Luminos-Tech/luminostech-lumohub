"""
Config file for the backend

    - Giữ các biến cấu hình hệ thống tại đây
    - Đọc giá trị từ .env file
    - Gom lại thành một Object settings
"""

import base64
from pydantic_settings import BaseSettings
from typing import List


def _generate_vapid_keys():
    """
    Auto-generate VAPID key pair (EC P-256) nếu chưa có trong .env.
    Trả về raw public key bytes dạng base64url (không có PEM wrapper).
    pywebpush cần raw bytes cho applicationServerKey.
    """
    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.backends import default_backend
    except ImportError:
        return None, None

    try:
        # Tạo EC key pair P-256 (VAPID standard)
        private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
        public_key = private_key.public_key()

        # Lấy raw bytes (không phải PEM)
        private_bytes = private_key.private_numbers().private_value.to_bytes(32, "big")
        # X9.62 uncompressed public key format: 04 + x + y
        public_numbers = public_key.public_numbers()
        x_bytes = public_numbers.x.to_bytes(32, "big")
        y_bytes = public_numbers.y.to_bytes(32, "big")
        public_bytes = b"\x04" + x_bytes + y_bytes  # uncompressed point

        def _b64url(data: bytes) -> str:
            return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

        return _b64url(public_bytes), _b64url(private_bytes)
    except Exception as e:
        print(f"⚠️ VAPID key generation failed: {e}")
        return None, None


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

    # Web Push 通知配置 (VAPID keys)
    # Nếu không có trong .env, sẽ tự động tạo (chỉ dùng cho dev)
    # Production nên set cố định trong .env
    VAPID_PUBLIC_KEY: str = " BN5N0FhiJ20HgL6TQfCgdTbE3Y2ZfV_yqt7obBicZLZXNn61wKda4tEuH2SOFxg7aDtrj-WSSctzurPBLPzSWbw "
    VAPID_PRIVATE_KEY: str = " BN5N0FhiJ20HgL6TQfCgdTbE3Y2ZfV_yqt7obBicZLZXNn61wKda4tEuH2SOFxg7aDtrj-WSSctzurPBLPzSWbw "
    VAPID_SUBJECT: str = "mailto:admin@luminostech.tech"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Auto-generate VAPID keys nếu chưa có
        if not self.VAPID_PUBLIC_KEY or not self.VAPID_PRIVATE_KEY:
            pub, priv = _generate_vapid_keys()
            if pub and priv:
                self.VAPID_PUBLIC_KEY = pub
                self.VAPID_PRIVATE_KEY = priv
                print("🔑 VAPID keys auto-generated (add to .env for production)")
            else:
                print("⚠️  VAPID keys not available. Push notifications will be disabled.")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()