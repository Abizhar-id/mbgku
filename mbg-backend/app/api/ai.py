"""
Endpoints AI (dengan cache hemat token):
  GET /ai/recap/{sppg_id}          → rekap mingguan (7 hari), cache TTL 24 jam
  GET /ai/recap/{sppg_id}/monthly  → rekap bulanan (30 hari), cache TTL 7 hari

Alur cache:
  request → cek tabel ai_recap (sppg_id, type, generated_at > threshold)
    → ada & fresh   → return langsung (TIDAK panggil Qwen)
    → tidak / expired → generate ke Qwen → simpan ke ai_recap → return

Hemat token: Qwen hanya menerima RINGKASAN data (bukan raw), dan thinking mode
dimatikan (enable_thinking=False).
"""
import json
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from openai import OpenAI
from pydantic import BaseModel
from supabase import Client

from app.core.auth import CurrentAdmin, get_current_admin
from app.core.config import settings
from app.core.database import get_supabase

router = APIRouter(prefix="/ai", tags=["ai"])

# ── Qwen client (OpenAI-compatible) ───────────────────────────────
qwen = OpenAI(
    api_key=settings.DASHSCOPE_API_KEY,
    base_url=settings.DASHSCOPE_BASE_URL,
)

# ── Response schema ────────────────────────────────────────────────

class DeliveryRecap(BaseModel):
    description: str
    accuracy_pct: float


class RecapResponse(BaseModel):
    summary: str
    delivery: DeliveryRecap
    suggestions: list[str]
    cached: bool
    generated_at: str


# ── Helper: ringkasan data (bukan raw → hemat token) ───────────────

def _build_summary(sppg_id: int, db: Client, days: int) -> tuple[dict, str, str, str]:
    """Hitung ringkasan numerik periode `days` hari. Return (summary, sppg_name, period_start, period_end)."""
    period_start = (date.today() - timedelta(days=days)).isoformat()
    period_end = date.today().isoformat()

    sppg = db.table("sppg").select("id, name").eq("id", sppg_id).execute().data
    if not sppg:
        raise HTTPException(status_code=404, detail="SPPG tidak ditemukan")

    deliveries = (
        db.table("delivery")
        .select("status")
        .eq("sppg_id", sppg_id)
        .gte("delivery_date", period_start)
        .execute()
        .data
    )
    total_delivery = len(deliveries)
    delivered = sum(1 for d in deliveries if d["status"] == "delivered")
    late = sum(1 for d in deliveries if d["status"] == "late")
    delivery_rate_pct = round(delivered / total_delivery * 100, 1) if total_delivery else 0.0

    feedbacks = (
        db.table("feedback")
        .select("rating")
        .eq("sppg_id", sppg_id)
        .gte("created_at", period_start)
        .execute()
        .data
    )
    total_feedback = len(feedbacks)
    avg_rating = round(sum(f["rating"] for f in feedbacks) / total_feedback, 2) if total_feedback else 0.0

    summary = {
        "period": f"{period_start} s/d {period_end}",
        "total_delivery": total_delivery,
        "delivered": delivered,
        "late": late,
        "delivery_rate_pct": delivery_rate_pct,
        "avg_rating": avg_rating,
        "total_feedback": total_feedback,
    }
    return summary, sppg[0]["name"], period_start, period_end


# ── Helper: call Qwen ──────────────────────────────────────────────
# Struktur prompt TIDAK diubah; hanya input data → ringkasan & thinking mode off.

SYSTEM_PROMPT = """Kamu adalah analis data program MBG (Makan Bergizi Gratis).
Tugasmu: analisis data operasional SPPG dan hasilkan rekap mingguan yang akurat.

ATURAN WAJIB:
1. Balas HANYA dengan JSON valid — tanpa teks lain, tanpa markdown, tanpa penjelasan.
2. Semua angka HARUS berdasarkan data yang diberikan. Dilarang mengarang.
3. Gunakan Bahasa Indonesia untuk semua teks.
4. Format JSON output HARUS persis seperti schema berikut:
{
  "delivery": {
    "estimasi_waktu_pengiriman": "<teks ringkas>",
    "ketepatan_waktu_persen": <float>,
    "sekolah_bermasalah": ["<nama>", ...]
  },
  "feedback": {
    "rata_rata_rating": <float>,
    "total_feedback": <int>,
    "sentimen_umum": "<positif|netral|negatif>",
    "keluhan_utama": ["<poin>", ...]
  },
  "saran_perbaikan": ["<saran 1>", "<saran 2>", "<saran 3>"],
  "highlight": "<1 kalimat ringkasan kondisi SPPG>"
}"""


def _call_qwen(summary: dict, sppg_name: str, period_name: str = "mingguan", retries: int = 2) -> dict:
    user_prompt = f"""Analisis ringkasan data SPPG berikut dan hasilkan rekap {period_name}.

SPPG: {sppg_name}

RINGKASAN DATA:
{json.dumps(summary, ensure_ascii=False, indent=2)}

Hasilkan rekap dalam format JSON sesuai schema."""

    for attempt in range(retries):
        response = qwen.chat.completions.create(
            model=settings.QWEN_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=1000,
            temperature=0.3,   # rendah = output lebih konsisten & faktual
            extra_body={"enable_thinking": False},   # matikan thinking mode → hemat token
        )

        raw_text = response.choices[0].message.content.strip()

        # Bersihkan kalau Qwen masih wrap markdown
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        try:
            return json.loads(raw_text)
        except json.JSONDecodeError:
            if attempt == retries - 1:
                raise HTTPException(
                    status_code=502,
                    detail=f"Qwen tidak mengembalikan JSON valid setelah {retries} percobaan.",
                )

    return {}  # unreachable


def _map_content(ai_result: dict) -> dict:
    """Petakan output Qwen (schema lama) → format response baru (disimpan sbg JSONB)."""
    delivery = ai_result.get("delivery", {})
    return {
        "summary": ai_result.get("highlight", ""),
        "delivery": {
            "description": delivery.get("estimasi_waktu_pengiriman", ""),
            "accuracy_pct": float(delivery.get("ketepatan_waktu_persen", 0) or 0),
        },
        "suggestions": ai_result.get("saran_perbaikan", []),
    }


# ── Store + cache helpers ──────────────────────────────────────────

def _store_recap(sppg_id: int, type_: str, content: dict, period_start: str, period_end: str, db: Client) -> str:
    """Simpan/refresh rekap ke ai_recap. Return generated_at (ISO).

    Tabel punya UNIQUE(sppg_id, type) → hanya 1 baris per (SPPG, tipe). Pakai
    UPSERT (bukan insert) supaya regenerasi saat cache expired MENIMPA baris lama,
    bukan melempar duplicate key (error 23505) yang bikin endpoint 500.
    """
    now = datetime.now(timezone.utc).isoformat()
    db.table("ai_recap").upsert(
        {
            "sppg_id": sppg_id,
            "type": type_,
            "content": content,
            "period_start": period_start,
            "period_end": period_end,
            "generated_at": now,
        },
        on_conflict="sppg_id,type",
    ).execute()
    return now


# ── Generators (dipakai endpoint on-demand DAN scheduler) ──────────

def generate_weekly(sppg_id: int, db: Client) -> dict:
    """Generate rekap MINGGUAN dari data mentah 7 hari → simpan. Selalu panggil Qwen."""
    summary, sppg_name, period_start, period_end = _build_summary(sppg_id, db, 7)
    ai_result = _call_qwen(summary, sppg_name, period_name="mingguan")
    content = _map_content(ai_result)
    generated_at = _store_recap(sppg_id, "weekly", content, period_start, period_end, db)
    return {"content": content, "generated_at": generated_at}


def _collect_weekly_recaps(sppg_id: int, db: Client, days: int = 35) -> list[dict]:
    """Kumpulkan content rekap mingguan yang tersimpan dalam `days` hari terakhir (urut lama→baru)."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = (
        db.table("ai_recap")
        .select("content, generated_at")
        .eq("sppg_id", sppg_id)
        .eq("type", "weekly")
        .gte("generated_at", since)
        .order("generated_at")
        .execute()
        .data
    )
    return [r["content"] for r in rows]


def _build_monthly_input(weekly_recaps: list[dict]) -> dict:
    """Ubah daftar rekap mingguan tersimpan → input ringkas untuk Qwen (rekap bulanan)."""
    return {
        "jumlah_rekap_mingguan": len(weekly_recaps),
        "rekap_mingguan": [
            {
                "ringkasan": w.get("summary", ""),
                "pengiriman": (w.get("delivery") or {}).get("description", ""),
                "ketepatan_persen": (w.get("delivery") or {}).get("accuracy_pct", 0),
                "saran": w.get("suggestions", []),
            }
            for w in weekly_recaps
        ],
    }


def generate_monthly(sppg_id: int, db: Client) -> dict:
    """
    Generate rekap BULANAN. Sesuai permintaan: diturunkan dari rekap MINGGUAN
    bulan ini (menyeluruh). Bila belum ada rekap mingguan sama sekali → fallback
    ke data mentah 30 hari agar tetap menghasilkan sesuatu.
    """
    sppg = db.table("sppg").select("name").eq("id", sppg_id).execute().data
    if not sppg:
        raise HTTPException(status_code=404, detail="SPPG tidak ditemukan")
    sppg_name = sppg[0]["name"]

    period_end = date.today().isoformat()
    period_start = (date.today() - timedelta(days=30)).isoformat()

    weeklies = _collect_weekly_recaps(sppg_id, db)
    if weeklies:
        monthly_input = _build_monthly_input(weeklies)
        ai_result = _call_qwen(monthly_input, sppg_name, period_name="bulanan")
    else:
        # Fallback: belum ada rekap mingguan → pakai data mentah 30 hari.
        summary, sppg_name, period_start, period_end = _build_summary(sppg_id, db, 30)
        ai_result = _call_qwen(summary, sppg_name, period_name="bulanan")

    content = _map_content(ai_result)
    generated_at = _store_recap(sppg_id, "monthly", content, period_start, period_end, db)
    return {"content": content, "generated_at": generated_at}


# ── Reset bulanan (jaga DB tidak penuh) ────────────────────────────

def reset_transactional(db: Client) -> dict:
    """
    Hapus data transaksional + rekap MINGGUAN. Pertahankan rekap BULANAN (arsip)
    dan data master (sppg/school/operator/admin/qr_token). Dipanggil setelah
    rekap bulanan dibuat. Return jumlah baris yang dihapus per tabel.
    """
    counts: dict[str, int] = {}
    for table in ("delivery", "feedback", "kitchen_process", "menu"):
        before = db.table(table).select("id", count="exact").execute().count or 0
        db.table(table).delete().neq("id", 0).execute()
        counts[table] = before

    wk = db.table("ai_recap").select("id", count="exact").eq("type", "weekly").execute().count or 0
    db.table("ai_recap").delete().eq("type", "weekly").execute()
    counts["ai_recap_weekly"] = wk
    return counts


# ── Read-only cache (endpoint publik TIDAK PERNAH memanggil Qwen) ──
#  Qwen hanya dipanggil oleh scheduler (Jumat 15:00 WIB) & endpoint admin
#  /generate di bawah. Endpoint publik murni membaca cache.
#
#  Catatan TTL: untuk pembacaan publik kita ambil rekap TERBARU apa adanya
#  (abaikan TTL). TTL dulu dipakai untuk memicu regenerasi on-demand — yang
#  kini DIHAPUS dari jalur publik. Tanpa ini, rekap mingguan (digenerate tiap
#  Jumat) akan dianggap "expired" 6 dari 7 hari dan fitur publik jadi kosong.

def _get_latest_cache(sppg_id: int, type_: str, db: Client) -> Optional[dict]:
    """Ambil rekap terbaru (tanpa filter TTL). None bila belum pernah ada."""
    rows = (
        db.table("ai_recap")
        .select("content, generated_at")
        .eq("sppg_id", sppg_id)
        .eq("type", type_)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def _read_recap(sppg_id: int, db: Client, type_: str):
    """Return RecapResponse dari cache, atau 202 JSON bila belum ada rekap."""
    cached = _get_latest_cache(sppg_id, type_, db)
    if cached:
        return RecapResponse(**cached["content"], cached=True, generated_at=str(cached["generated_at"]))
    return JSONResponse(
        status_code=202,
        content={"cached": False, "message": "Rekap sedang diproses, coba lagi nanti."},
    )


# ── Endpoints publik (read-only) ───────────────────────────────────

@router.get("/recap/{sppg_id}")
def get_recap(sppg_id: int, db: Client = Depends(get_supabase)):
    """Rekap mingguan terbaru — HANYA baca cache. 202 bila belum tersedia. Tidak memanggil Qwen."""
    return _read_recap(sppg_id, db, type_="weekly")


@router.get("/recap/{sppg_id}/monthly")
def get_recap_monthly(sppg_id: int, db: Client = Depends(get_supabase)):
    """Rekap bulanan terbaru — HANYA baca cache. 202 bila belum tersedia. Tidak memanggil Qwen."""
    return _read_recap(sppg_id, db, type_="monthly")


# ── Endpoints generate (ADMIN ONLY — satu-satunya jalur on-demand ke Qwen) ──

@router.post("/recap/{sppg_id}/generate", response_model=RecapResponse)
def generate_recap_admin(
    sppg_id: int,
    _: CurrentAdmin = Depends(get_current_admin),
    db: Client = Depends(get_supabase),
):
    """Paksa generate rekap MINGGUAN 1 SPPG via Qwen, simpan ke cache. Khusus admin."""
    gen = generate_weekly(sppg_id, db)
    return RecapResponse(**gen["content"], cached=False, generated_at=gen["generated_at"])


@router.post("/recap/{sppg_id}/monthly/generate", response_model=RecapResponse)
def generate_recap_monthly_admin(
    sppg_id: int,
    _: CurrentAdmin = Depends(get_current_admin),
    db: Client = Depends(get_supabase),
):
    """Paksa generate rekap BULANAN 1 SPPG via Qwen, simpan ke cache. Khusus admin."""
    gen = generate_monthly(sppg_id, db)
    return RecapResponse(**gen["content"], cached=False, generated_at=gen["generated_at"])


# ── Manual triggers (admin) — untuk uji tanpa menunggu Jumat 15:00 ─

@router.post("/jobs/run-weekly")
def run_weekly_job(_: CurrentAdmin = Depends(get_current_admin), db: Client = Depends(get_supabase)):
    """Jalankan rekap mingguan untuk SEMUA SPPG sekarang (meniru job Jumat 15:00)."""
    sppgs = db.table("sppg").select("id").execute().data
    for s in sppgs:
        generate_weekly(s["id"], db)
    return {"message": f"Rekap mingguan dibuat untuk {len(sppgs)} SPPG.", "count": len(sppgs)}


@router.post("/jobs/run-monthly")
def run_monthly_job(_: CurrentAdmin = Depends(get_current_admin), db: Client = Depends(get_supabase)):
    """
    Meniru job Jumat terakhir bulan: weekly → monthly → reset DB, untuk SEMUA SPPG.
    PERHATIAN: ini MENGHAPUS data transaksional + rekap mingguan.
    """
    sppgs = db.table("sppg").select("id").execute().data
    for s in sppgs:
        generate_weekly(s["id"], db)
    for s in sppgs:
        generate_monthly(s["id"], db)
    counts = reset_transactional(db)
    return {
        "message": f"Rekap bulanan dibuat untuk {len(sppgs)} SPPG, lalu DB direset.",
        "count": len(sppgs),
        "deleted": counts,
    }
