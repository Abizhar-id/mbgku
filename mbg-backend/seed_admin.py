"""
Seed akun admin platform awal.

Jalankan SETELAH schema.sql (v2, sudah ada tabel `admin`) di-run di Supabase:

    python seed_admin.py

Membuat 1 akun admin default:
    username = admin
    password = admin123

⚠️  Ganti password setelah pertama login (prototype default — jangan dipakai di produksi).
Aman dijalankan berulang: jika username 'admin' sudah ada, password-nya di-reset
ke hash baru (idempotent).
"""
import bcrypt

from app.core.database import supabase

DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"  # Ganti password setelah pertama login.


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

    print(f"   login: {DEFAULT_USERNAME} / {DEFAULT_PASSWORD}")
    print("   ⚠️  Ganti password setelah pertama login.")


if __name__ == "__main__":
    main()
