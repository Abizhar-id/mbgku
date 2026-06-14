"""
Endpoints Feedback siswa (TANPA foto):
  GET  /feedback/{token} → info form: nama sekolah (lock) + status buka  [public]
  POST /feedback/{token} → submit rating + komentar                      [public]

QR feedback statis, tapi form HANYA aktif 09.00-12.00 WIB.
Nama sekolah otomatis dari token → frontend lock, siswa tak bisa ganti.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from supabase import Client

from app.core.database import get_supabase
from app.core.ratelimit import limiter

router = APIRouter(prefix="/feedback", tags=["feedback"])

WIB = timezone(timedelta(hours=7))
OPEN_HOUR, CLOSE_HOUR = 9, 12
MAX_FEEDBACK_PER_TOKEN_PER_DAY = 3   # batas submit per sekolah/token per hari


def _window_open() -> bool:
    return OPEN_HOUR <= datetime.now(WIB).hour < CLOSE_HOUR


# ── Schemas ────────────────────────────────────────────────────────

class FeedbackForm(BaseModel):
    sppg_id: int
    school_id: int
    school_name: str     # di-lock di frontend
    open: bool
    message: str


class FeedbackSubmit(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class PublicFeedback(BaseModel):
    rating: int
    comment: Optional[str] = None
    school_name: str          # nama sekolah tersensor
    created_at: str


# ── Helper ─────────────────────────────────────────────────────────


def _censor_school(name: str) -> str:
    """Sensor nama sekolah: 3 karakter pertama + '**'. Contoh: 'SDN Caturtunggal 1' → 'SDN**'."""
    if not name:
        return "**"
    return f"{name[:3]}**"

def _get_feedback_qr(token: str, db: Client) -> dict:
    rows = db.table("qr_token").select("*").eq("token", token).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="QR tidak dikenali.")
    qr = rows[0]
    if qr["kind"] != "feedback":
        raise HTTPException(status_code=400, detail="QR ini bukan QR feedback.")
    if not qr["active"]:
        raise HTTPException(status_code=400, detail="QR nonaktif.")
    return qr


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/{token}", response_model=FeedbackForm)
def get_form(token: str, db: Client = Depends(get_supabase)):
    """Info form feedback: nama sekolah (lock) + apakah window buka."""
    qr = _get_feedback_qr(token, db)
    school = db.table("school").select("name").eq("id", qr["school_id"]).execute().data
    is_open = _window_open()

    return FeedbackForm(
        sppg_id=qr["sppg_id"],
        school_id=qr["school_id"],
        school_name=school[0]["name"] if school else "",
        open=is_open,
        message="Form dibuka." if is_open else "Form feedback hanya dibuka pukul 09.00-12.00 WIB.",
    )


@router.get("/public/{sppg_id}", response_model=list[PublicFeedback])
def get_public_feedback(sppg_id: int, db: Client = Depends(get_supabase)):
    """Ulasan publik 1 SPPG (tanpa auth). Nama sekolah disensor. Maks 10 terbaru."""
    rows = (
        db.table("feedback")
        .select("rating, comment, created_at, school_id")
        .eq("sppg_id", sppg_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
        .data
    )

    # Map school_id → nama sekolah (untuk disensor)
    schools = {
        s["id"]: s["name"]
        for s in db.table("school").select("id, name").eq("sppg_id", sppg_id).execute().data
    }

    return [
        PublicFeedback(
            rating=r["rating"],
            comment=r.get("comment"),
            school_name=_censor_school(schools.get(r["school_id"], "")),
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


@router.post("/{token}")
@limiter.limit("10/minute")   # anti-spam per IP → 429 "Terlalu banyak request..."
def submit_feedback(request: Request, token: str, body: FeedbackSubmit, db: Client = Depends(get_supabase)):
    """Submit feedback. Sekolah & SPPG diambil dari token (bukan dari input siswa).

    Anti-spam berlapis:
      1. Rate limit per IP (slowapi, 10/menit) — di decorator.
      2. Batas per token/sekolah per hari (MAX_FEEDBACK_PER_TOKEN_PER_DAY).
      3. Jendela waktu 09.00-12.00 WIB tetap berlaku.
    """
    qr = _get_feedback_qr(token, db)

    if not _window_open():
        raise HTTPException(status_code=403, detail="Form feedback hanya dibuka pukul 09.00-12.00 WIB.")

    # Batas harian per sekolah (token statis = identitas sekolah). Hitung feedback
    # hari ini untuk (sppg, sekolah) tsejak 00:00 WIB.
    day_start = datetime.now(WIB).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_count = (
        db.table("feedback")
        .select("id", count="exact")
        .eq("sppg_id", qr["sppg_id"])
        .eq("school_id", qr["school_id"])
        .gte("created_at", day_start)
        .execute()
        .count
    ) or 0
    if today_count >= MAX_FEEDBACK_PER_TOKEN_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail="Feedback untuk sekolah ini sudah mencapai batas hari ini.",
        )

    db.table("feedback").insert({
        "sppg_id": qr["sppg_id"],
        "school_id": qr["school_id"],
        "rating": body.rating,
        "comment": body.comment,
    }).execute()

    return {"message": "Terima kasih! Feedback kamu tersimpan."}