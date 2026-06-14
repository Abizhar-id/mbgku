"""
Entry point FastAPI.

Jalankan lokal:
    uvicorn app.main:app --reload

Cek: buka http://localhost:8000/health  → {"status": "ok"}
     buka http://localhost:8000/docs    → Swagger UI
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import supabase
from app.core.ratelimit import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cek koneksi Supabase saat startup (biar ketahuan dini kalau env salah)
    try:
        supabase.table("sppg").select("id").limit(1).execute()
        print("[startup] Supabase OK ✅")
    except Exception as e:  # noqa: BLE001 — startup diagnostic
        print(f"[startup] Supabase belum siap: {e}")

    # Penjadwal rekap AI mingguan/bulanan + reset (Jumat 15.00 WIB)
    from app.core.scheduler import scheduler, start_scheduler
    start_scheduler()
    try:
        yield
    finally:
        if scheduler.running:
            scheduler.shutdown(wait=False)


app = FastAPI(title="MBGku API", version="0.1.0", lifespan=lifespan)

# ── Rate limiting (slowapi) ────────────────────────────────────────
# limiter dipakai via decorator @limiter.limit(...) di endpoint tertentu
# (login, feedback). Handler di bawah menerjemahkan 429 ke pesan Indonesia.
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
def ratelimit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    if request.url.path.endswith("/login"):
        msg = "Terlalu banyak percobaan login. Coba lagi dalam 1 menit."
    else:
        msg = "Terlalu banyak request. Coba lagi nanti."
    return JSONResponse(status_code=429, content={"detail": msg})


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
