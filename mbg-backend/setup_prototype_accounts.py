"""
Setup akun PROTOTYPE — login simpel & seragam (bukan untuk produksi).

Hasil akhir:
  - admin / admin123
  - sppg1 .. sppgN / sppg123   (1 operator per SPPG, urut id SPPG)
  - operator duplikat/test dihapus (1 SPPG = 1 operator)

Aman dijalankan berulang (idempotent). Password tetap di-hash bcrypt dan disimpan
di kolom `password` (operator) — tidak perlu migrasi/ALTER kolom apa pun.

Pakai:
    cd mbg-backend
    ../venv/bin/python3.12 setup_prototype_accounts.py
    # (atau: source ../venv/bin/activate && python setup_prototype_accounts.py)
"""
import bcrypt

from app.core.database import supabase

OPERATOR_PASSWORD = "sppg123"   # WAJIB ganti sebelum production
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"     # WAJIB ganti sebelum production


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

    # ── Admin: pastikan ada & password = admin123 ──
    admins = supabase.table("admin").select("id").eq("username", ADMIN_USERNAME).execute().data
    if admins:
        supabase.table("admin").update({"password_hash": _hash(ADMIN_PASSWORD)}).eq(
            "id", admins[0]["id"]
        ).execute()
    else:
        supabase.table("admin").insert(
            {"username": ADMIN_USERNAME, "password_hash": _hash(ADMIN_PASSWORD)}
        ).execute()

    # ── Ringkasan ──
    print(f"Selesai. {len(keepers)} operator ditata, {deleted} duplikat dihapus.\n")
    print("=== AKUN LOGIN (prototype) ===")
    print(f"  admin  / {ADMIN_PASSWORD}   (panel admin)")
    for rank, (_, sppg_id) in enumerate(keepers, start=1):
        print(f"  sppg{rank:<2} / {OPERATOR_PASSWORD}   (dashboard SPPG id={sppg_id})")


if __name__ == "__main__":
    main()
