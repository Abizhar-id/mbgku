"""
Koneksi Supabase. Pakai service_role key → bypass RLS.
Client ini cukup buat query tabel (PostgREST) DAN upload foto (Storage),
jadi tidak perlu kelola connection pool sendiri.
"""
from supabase import Client, create_client

from app.core.config import settings

supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_KEY,
)


def get_supabase() -> Client:
    """Dependency FastAPI: `db: Client = Depends(get_supabase)`."""
    return supabase
