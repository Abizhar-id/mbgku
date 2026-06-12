"""
Endpoints QR (v2 — STATIS):
  GET  /qr/my              → list QR statis milik SPPG (buat dicetak)  [auth]
  GET  /qr/validate/:token → validasi token saat di-scan              [public]

2 jenis QR, keduanya statis & dicetak sekali:
  - delivery : di-scan SPPG di sekolah → unlock kamera bukti antar
  - feedback : di-scan siswa → buka form penilaian (HANYA 09.00-12.00 WIB)
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client

from app.core.auth import CurrentOperator, get_current_operator
from app.core.database import get_supabase

router = APIRouter(prefix="/qr", tags=["qr"])

WIB = timezone(timedelta(hours=7))
FEEDBACK_OPEN_HOUR = 9    # form feedback dibuka jam 09.00 WIB
FEEDBACK_CLOSE_HOUR = 12  # ditutup jam 12.00 WIB


def _feedback_window_open() -> bool:
    now = datetime.now(WIB)
    return FEEDBACK_OPEN_HOUR <= now.hour < FEEDBACK_CLOSE_HOUR


# ── Schemas ────────────────────────────────────────────────────────

class SchoolQR(BaseModel):
    school_id: int
    school_name: str
    delivery_token: Optional[str] = None
    delivery_url: Optional[str] = None
    feedback_token: Optional[str] = None
    feedback_url: Optional[str] = None


class ValidateQRResponse(BaseModel):
    valid: bool
    kind: str
    sppg_id: int
    school_id: Optional[int]
    school_name: Optional[str]
    message: str


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/my", response_model=list[SchoolQR])
def get_my_qr(
    op: CurrentOperator = Depends(get_current_operator),
    db: Client = Depends(get_supabase),
):
    """List semua QR statis milik SPPG yang login — buat dicetak & ditempel."""
    schools = db.table("school").select("id, name").eq("sppg_id", op.sppg_id).execute().data
    tokens = db.table("qr_token").select("token, kind, school_id").eq("sppg_id", op.sppg_id).execute().data

    by_school: dict[int, SchoolQR] = {
        s["id"]: SchoolQR(school_id=s["id"], school_name=s["name"]) for s in schools
    }
    for t in tokens:
        entry = by_school.get(t["school_id"])
        if not entry:
            continue
        if t["kind"] == "delivery":
            entry.delivery_token = t["token"]
            entry.delivery_url = f"/delivery/confirm/{t['token']}"
        elif t["kind"] == "feedback":
            entry.feedback_token = t["token"]
            entry.feedback_url = f"/feedback/{t['token']}"

    return list(by_school.values())


@router.get("/validate/{token}", response_model=ValidateQRResponse)
def validate_qr(token: str, db: Client = Depends(get_supabase)):
    """
    Validasi token QR saat di-scan. Public (tanpa login).
    - delivery : valid selama token aktif.
    - feedback : valid HANYA jam 09.00-12.00 WIB.
    """
    rows = db.table("qr_token").select("*").eq("token", token).execute().data

    if not rows:
        return ValidateQRResponse(
            valid=False, kind="", sppg_id=0, school_id=None, school_name=None,
            message="QR tidak dikenali.",
        )

    qr = rows[0]

    # Nama sekolah (buat di-lock di form feedback)
    school = db.table("school").select("name").eq("id", qr["school_id"]).execute().data
    school_name = school[0]["name"] if school else None

    if not qr["active"]:
        return ValidateQRResponse(
            valid=False, kind=qr["kind"], sppg_id=qr["sppg_id"],
            school_id=qr["school_id"], school_name=school_name,
            message="QR nonaktif.",
        )

    # Feedback: cek jendela waktu
    if qr["kind"] == "feedback" and not _feedback_window_open():
        return ValidateQRResponse(
            valid=False, kind="feedback", sppg_id=qr["sppg_id"],
            school_id=qr["school_id"], school_name=school_name,
            message="Form feedback hanya dibuka pukul 09.00-12.00 WIB.",
        )

    return ValidateQRResponse(
        valid=True,
        kind=qr["kind"],
        sppg_id=qr["sppg_id"],
        school_id=qr["school_id"],
        school_name=school_name,
        message="QR valid.",
    )