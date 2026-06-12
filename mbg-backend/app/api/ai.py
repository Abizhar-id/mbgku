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
from openai import OpenAI
from pydantic import BaseModel
from supabase import Client

from app.core.config import settings
from app.core.database import get_supabase

router = APIRouter(prefix="/ai", tags=["ai"])

# ── Qwen client (OpenAI-compatible) ───────────────────────────────
qwen = OpenAI(
    api_key=settings.DASHSCOPE_API_KEY,
    base_url=settings.DASHSCOPE_BASE_URL,
)

# ── Cache TTL per tipe rekap ──────────────────────────────────────
CACHE_TTL = {
    "weekly":  timedelta(hours=24),
    "monthly": timedelta(days=7),
}


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


# ── Cache helpers ──────────────────────────────────────────────────

def _get_fresh_cache(sppg_id: int, type_: str, db: Client) -> Optional[dict]:
    """Ambil rekap cache terakhir yang masih fresh (generated_at > now - TTL)."""
    threshold = (datetime.now(timezone.utc) - CACHE_TTL[type_]).isoformat()
    rows = (
        db.table("ai_recap")
        .select("content, generated_at")
        .eq("sppg_id", sppg_id)
        .eq("type", type_)
        .gte("generated_at", threshold)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def _recap(sppg_id: int, db: Client, type_: str, days: int, period_name: str) -> RecapResponse:
    # 1. Cache fresh? → return tanpa panggil Qwen
    cached = _get_fresh_cache(sppg_id, type_, db)
    if cached:
        content = cached["content"]
        return RecapResponse(**content, cached=True, generated_at=str(cached["generated_at"]))

    # 2. Generate baru via Qwen (input ringkasan saja)
    summary, sppg_name, period_start, period_end = _build_summary(sppg_id, db, days)
    ai_result = _call_qwen(summary, sppg_name, period_name=period_name)
    content = _map_content(ai_result)

    # 3. Simpan ke cache
    now = datetime.now(timezone.utc).isoformat()
    db.table("ai_recap").insert({
        "sppg_id": sppg_id,
        "type": type_,
        "content": content,
        "period_start": period_start,
        "period_end": period_end,
        "generated_at": now,
    }).execute()

    return RecapResponse(**content, cached=False, generated_at=now)


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/recap/{sppg_id}", response_model=RecapResponse)
def get_recap(sppg_id: int, db: Client = Depends(get_supabase)):
    """Rekap mingguan (7 hari terakhir). Cache TTL 24 jam."""
    return _recap(sppg_id, db, type_="weekly", days=7, period_name="mingguan")


@router.get("/recap/{sppg_id}/monthly", response_model=RecapResponse)
def get_recap_monthly(sppg_id: int, db: Client = Depends(get_supabase)):
    """Rekap bulanan (30 hari terakhir). Cache TTL 7 hari."""
    return _recap(sppg_id, db, type_="monthly", days=30, period_name="bulanan")
