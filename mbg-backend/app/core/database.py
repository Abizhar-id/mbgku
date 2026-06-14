"""
Koneksi Supabase. Pakai service_role key → bypass RLS.
Client ini cukup buat query tabel (PostgREST) DAN upload foto (Storage),
jadi tidak perlu kelola connection pool sendiri.

⚠️  KEAMANAN: backend HARUS memakai SUPABASE_SERVICE_KEY (service_role), JANGAN
    anon/public key. service_role mem-bypass RLS sehingga semua endpoint tetap
    berfungsi setelah RLS diaktifkan (lihat app/models/rls.sql). Service key ini
    bersifat RAHASIA — hanya di .env backend, TIDAK PERNAH dikirim ke frontend.
"""
import httpx
from supabase import Client, create_client

from app.core.config import settings

# Memakai SERVICE key (bukan anon) — wajib agar query backend tembus RLS.
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_KEY,
)

# ── Stabilkan koneksi PostgREST ────────────────────────────────────
# Default PostgREST pakai HTTP/2 + connection pool. Koneksi idle bisa ditutup
# server (gateway Supabase) lalu DIPAKAI ULANG oleh httpx → muncul
# `httpx.RemoteProtocolError: Server disconnected` (HTTP 500) saat akses berulang.
# Solusi: ganti session jadi HTTP/1.1 dengan keepalive pendek, supaya koneksi
# basi tidak dipakai ulang. base_url + headers (apikey/authorization) disalin
# dari session bawaan agar autentikasi tetap utuh.
_old = supabase.postgrest.session
supabase.postgrest.session = httpx.Client(
    base_url=_old.base_url,
    headers=_old.headers,
    http2=False,
    timeout=httpx.Timeout(30.0),
    limits=httpx.Limits(max_keepalive_connections=5, max_connections=20, keepalive_expiry=5.0),
)
try:
    _old.close()
except Exception:  # noqa: BLE001 — best-effort cleanup
    pass


def get_supabase() -> Client:
    """Dependency FastAPI: `db: Client = Depends(get_supabase)`."""
    return supabase
