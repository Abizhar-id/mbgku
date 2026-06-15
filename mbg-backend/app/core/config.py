"""
Konfigurasi terpusat. Semua env var dibaca di sini, tidak di tempat lain.
"""
from functools import lru_cache

from pydantic import field_validator
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

    # Auth — JWT_SECRET WAJIB di-set (tanpa default). Kalau kosong/lemah, app
    # gagal start (fail-fast) daripada diam-diam memakai secret publik yang
    # memungkinkan token admin dipalsukan.
    JWT_SECRET: str
    JWT_EXPIRE_HOURS: int = 12

    @field_validator("JWT_SECRET")
    @classmethod
    def _strong_secret(cls, v: str) -> str:
        if len(v) < 32 or v == "dev-secret-ganti-di-production":
            raise ValueError(
                "JWT_SECRET wajib di-set & acak (min 32 char). "
                "Generate: openssl rand -hex 32"
            )
        return v

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # Base URL frontend — dipakai untuk encode URL di dalam QR (PNG admin)
    BASE_URL: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
