"""
Seed akun admin platform awal.

Jalankan SETELAH schema.sql (v2, sudah ada tabel `admin`) di-run di Supabase.
Password WAJIB via env (tidak di-hardcode):

    SEED_ADMIN_PASSWORD='...' python seed_admin.py

Membuat 1 akun admin:
    username = admin
    password = $SEED_ADMIN_PASSWORD

Aman dijalankan berulang: jika username 'admin' sudah ada, password-nya di-reset
ke hash baru (idempotent).
"""
import os
import sys

import bcrypt

from app.core.database import supabase

DEFAULT_USERNAME = "admin"
# Password dari env (tidak di-hardcode). Jalankan:
#   SEED_ADMIN_PASSWORD='xxx' python seed_admin.py
DEFAULT_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD")
if not DEFAULT_PASSWORD:
    sys.exit("Set dulu env SEED_ADMIN_PASSWORD (jangan hardcode password di source).")


def main() -> None:
    password_hash = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode()

    existing = (
        supabase.table("admin")
        .select("id")
        .eq("username", DEFAULT_USERNAME)
        .execute()
        .data
    )

    if existing:
        supabase.table("admin").update(
            {"password_hash": password_hash}
        ).eq("username", DEFAULT_USERNAME).execute()
        print(f"Admin '{DEFAULT_USERNAME}' sudah ada → password di-reset ke default.")
    else:
        supabase.table("admin").insert(
            {"username": DEFAULT_USERNAME, "password_hash": password_hash}
        ).execute()
        print(f"Admin '{DEFAULT_USERNAME}' dibuat.")

    print(f"   login: {DEFAULT_USERNAME} (password = SEED_ADMIN_PASSWORD)")
    print("   ⚠️  Ganti password setelah pertama login.")


if __name__ == "__main__":
    main()
