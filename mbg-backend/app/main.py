"""
Entry point FastAPI.

Jalankan lokal:
    uvicorn app.main:app --reload

Cek: buka http://localhost:8000/health  → {"status": "ok"}
     buka http://localhost:8000/docs    → Swagger UI
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import supabase


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cek koneksi Supabase saat startup (biar ketahuan dini kalau env salah)
    try:
        supabase.table("sppg").select("id").limit(1).execute()
        print("[startup] Supabase OK ✅")
    except Exception as e:  # noqa: BLE001 — startup diagnostic
        print(f"[startup] Supabase belum siap: {e}")
    yield


app = FastAPI(title="MBG Transparency API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


# ── Routers (ditambah bertahap sesuai build order) ────────────────
from app.api import sppg, ai, qr, process, delivery, feedback, menu, admin
from app.core import auth

app.include_router(sppg.router)
app.include_router(ai.router)
app.include_router(auth.router)
app.include_router(qr.router)
app.include_router(process.router)
app.include_router(delivery.router)
app.include_router(feedback.router)
app.include_router(menu.router)
app.include_router(admin.router)  # prefix /admin sudah di-set di router
