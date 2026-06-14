"""
Utilitas login untuk TESTING (bukan untuk produksi).

Karena password kini di-hash bcrypt, nilainya tidak bisa "dilihat" lagi. Skrip ini
membantu kamu: (1) melihat daftar username, (2) mereset password ke nilai yang kamu
tahu agar bisa login saat testing.

Pakai (di dalam venv yang sudah lengkap — lihat catatan di bawah):

    # 1) Lihat semua username operator + admin
    python reset_password.py

    # 2) Reset password sebuah akun ke nilai yang kamu pilih (di-hash bcrypt)
    python reset_password.py <username> <password_baru>
    # contoh:
    python reset_password.py dapur1 Test1234abcd
    python reset_password.py admin  Admin1234abcd

Catatan:
  - Username dicari di tabel `operator` dulu, lalu `admin`.
  - Menulis HASH bcrypt (operator: kolom `password`, admin: `password_hash`).
  - WAJIB hanya dipakai di lingkungan testing/lokal.
"""
import sys

import bcrypt

from app.core.database import supabase


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def list_accounts() -> None:
    operators = (
        supabase.table("operator")
        .select("id, sppg_id, username")
        .order("id")
        .execute()
        .data
    )
    admins = supabase.table("admin").select("username").order("username").execute().data

    print("\n=== OPERATOR (login dashboard SPPG) ===")
    if operators:
        for o in operators:
            print(f"  username: {o['username']:<16} (sppg_id={o['sppg_id']})")
    else:
        print("  (kosong — jalankan `python seed.py` dulu)")

    print("\n=== ADMIN (login panel admin) ===")
    if admins:
        for a in admins:
            print(f"  username: {a['username']}")
    else:
        print("  (kosong — jalankan `python seed_admin.py` dulu)")

    print(
        "\nPassword tidak bisa ditampilkan (tersimpan sebagai hash).\n"
        "Reset ke nilai yang kamu tahu:  python reset_password.py <username> <password_baru>\n"
    )


def reset_password(username: str, new_password: str) -> None:
    pw_hash = hash_password(new_password)

    op = supabase.table("operator").select("id").eq("username", username).execute().data
    if op:
        supabase.table("operator").update({"password": pw_hash}).eq(
            "username", username
        ).execute()
        print(f"OK: password operator '{username}' di-reset → {new_password}")
        return

    ad = supabase.table("admin").select("id").eq("username", username).execute().data
    if ad:
        supabase.table("admin").update({"password_hash": pw_hash}).eq(
            "username", username
        ).execute()
        print(f"OK: password admin '{username}' di-reset → {new_password}")
        return

    print(f"GAGAL: username '{username}' tidak ditemukan di operator maupun admin.")
    print("Jalankan tanpa argumen untuk melihat daftar username yang ada.")


def main() -> None:
    if len(sys.argv) == 1:
        list_accounts()
    elif len(sys.argv) == 3:
        reset_password(sys.argv[1], sys.argv[2])
    else:
        print(__doc__)
        print("Penggunaan salah. Lihat contoh di atas.")


if __name__ == "__main__":
    main()
