"""
Setup akun PROTOTYPE — login simpel & seragam (bukan untuk produksi).

Hasil akhir:
  - admin                       (password = $SEED_ADMIN_PASSWORD)
  - sppg1 .. sppgN              (password = $SEED_OPERATOR_PASSWORD, 1 operator per SPPG)
  - operator duplikat/test dihapus (1 SPPG = 1 operator)

Aman dijalankan berulang (idempotent). Password tetap di-hash bcrypt dan disimpan
di kolom `password` (operator) — tidak perlu migrasi/ALTER kolom apa pun.

Pakai (password WAJIB via env, tidak di-hardcode):
    cd mbg-backend
    SEED_OPERATOR_PASSWORD='...' SEED_ADMIN_PASSWORD='...' \
        ../venv/bin/python3.12 setup_prototype_accounts.py
"""
import os
import sys

import bcrypt

from app.core.database import supabase

# Password TIDAK di-hardcode (mencegah default publik & reset tak sengaja).
# Wajib via env saat menjalankan:
#   SEED_OPERATOR_PASSWORD='xxx' SEED_ADMIN_PASSWORD='yyy' python setup_prototype_accounts.py
OPERATOR_PASSWORD = os.environ.get("SEED_OPERATOR_PASSWORD")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD")

if not OPERATOR_PASSWORD or not ADMIN_PASSWORD:
    sys.exit(
        "Set dulu env SEED_OPERATOR_PASSWORD & SEED_ADMIN_PASSWORD "
        "(jangan hardcode password di source). Contoh:\n"
        "  SEED_OPERATOR_PASSWORD='...' SEED_ADMIN_PASSWORD='...' "
        "python setup_prototype_accounts.py"
    )


def _hash(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def main() -> None:
    sppgs = supabase.table("sppg").select("id").order("id").execute().data
    pw_hash = _hash(OPERATOR_PASSWORD)

    # ── Phase 1: dedupe — 1 operator per SPPG (keep id terkecil, hapus sisanya) ──
    keepers: list[tuple[int, int]] = []   # (operator_id, sppg_id)
    deleted = 0
    for s in sppgs:
        ops = (
            supabase.table("operator")
            .select("id")
            .eq("sppg_id", s["id"])
            .order("id")
            .execute()
            .data
        )
        if not ops:
            print(f"  (lewati) SPPG id={s['id']} belum punya operator")
            continue
        keepers.append((ops[0]["id"], s["id"]))
        for extra in ops[1:]:
            supabase.table("operator").delete().eq("id", extra["id"]).execute()
            deleted += 1

    # ── Phase 2: rename sementara (hindari bentrok UNIQUE saat menata ulang) ──
    for op_id, _ in keepers:
        supabase.table("operator").update({"username": f"__tmp_{op_id}"}).eq("id", op_id).execute()

    # ── Phase 3: username final sppg1..sppgN + set password (kolom `password`, isi hash) ──
    for rank, (op_id, _) in enumerate(keepers, start=1):
        supabase.table("operator").update(
            {"username": f"sppg{rank}", "password": pw_hash}
        ).eq("id", op_id).execute()

    # ── Admin: pastikan ada & set password dari $SEED_ADMIN_PASSWORD ──
    admins = supabase.table("admin").select("id").eq("username", ADMIN_USERNAME).execute().data
    if admins:
        supabase.table("admin").update({"password_hash": _hash(ADMIN_PASSWORD)}).eq(
            "id", admins[0]["id"]
        ).execute()
    else:
        supabase.table("admin").insert(
            {"username": ADMIN_USERNAME, "password_hash": _hash(ADMIN_PASSWORD)}
        ).execute()

    # ── Ringkasan (password TIDAK dicetak — hindari bocor ke log) ──
    print(f"Selesai. {len(keepers)} operator ditata, {deleted} duplikat dihapus.\n")
    print("=== AKUN LOGIN (prototype) ===")
    print("  admin   (panel admin)")
    for rank, (_, sppg_id) in enumerate(keepers, start=1):
        print(f"  sppg{rank:<2}  (dashboard SPPG id={sppg_id})")
    print("\nPassword = nilai SEED_*_PASSWORD yang kamu set saat menjalankan script ini.")


if __name__ == "__main__":
    main()
