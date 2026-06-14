"""
Seed akun operator SPPG tambahan (di luar yang dibuat seed.py).

Jalankan kapan saja (tidak menghapus data apa pun):

    python seed_operator.py

Aman dijalankan berulang (idempotent): SPPG dicari berdasarkan NAMA (bukan id),
jadi tetap benar walau id berubah. Kalau username sudah ada → password & sppg_id
di-update; kalau belum ada → di-insert.

Password operator di-hash bcrypt sebelum disimpan (sama seperti seed.py).
Prototype: password simpel & seragam.
"""
import bcrypt

from app.core.database import supabase

OPERATOR_PASSWORD = "sppg123"  # prototype


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


# (nama SPPG, username) — tambah baris bila perlu.
OPERATORS = [
    ("SPPG Nutrisi Kotagede", "dapur2"),
]


def main() -> None:
    for sppg_name, username in OPERATORS:
        password = OPERATOR_PASSWORD
        sppg = (
            supabase.table("sppg")
            .select("id")
            .eq("name", sppg_name)
            .execute()
            .data
        )
        if not sppg:
            print(f"SKIP '{username}': SPPG '{sppg_name}' tidak ditemukan.")
            continue
        sppg_id = sppg[0]["id"]

        existing = (
            supabase.table("operator")
            .select("id")
            .eq("username", username)
            .execute()
            .data
        )

        if existing:
            supabase.table("operator").update(
                {"sppg_id": sppg_id, "password": hash_password(password)}
            ).eq("username", username).execute()
            print(f"Operator '{username}' sudah ada -> diperbarui (sppg_id={sppg_id}).")
        else:
            supabase.table("operator").insert(
                {"sppg_id": sppg_id, "username": username, "password": hash_password(password)}
            ).execute()
            print(f"Operator '{username}' dibuat untuk '{sppg_name}' (sppg_id={sppg_id}).")

        print(f"   login: {username} / {password}")


if __name__ == "__main__":
    main()
