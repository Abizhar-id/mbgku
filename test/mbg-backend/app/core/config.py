"""
Konfigurasi terpusat. Semua env var dibaca di sini, tidak di tempat lain.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str  # service_role — backend only, bypass RLS

    # Qwen (DashScope, OpenAI-compatible)
    DASHSCOPE_API_KEY: str
    DASHSCOPE_BASE_URL: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    QWEN_MODEL: str = "qwen-plus"

    # Auth (prototype-simple)
    JWT_SECRET: str = "dev-secret-ganti-di-production"
    JWT_EXPIRE_HOURS: int = 12

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
