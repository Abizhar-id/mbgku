"""
Endpoints Admin platform — kelola QR (delivery + feedback) semua sekolah.

  POST /admin/login                                  → login admin, return JWT  [public]
  GET  /admin/schools                                → semua sekolah + 2 token  [admin]
  POST /admin/schools/{id}/qr/delivery/generate      → regen token delivery     [admin]
  POST /admin/schools/{id}/qr/feedback/generate      → regen token feedback     [admin]
  GET  /admin/schools/{id}/qr/delivery               → QR delivery (PNG)        [admin]
  GET  /admin/schools/{id}/qr/feedback               → QR feedback (PNG)        [admin]

Sumber kebenaran token = tabel `qr_token` (bukan kolom di `school`). "Generate
ulang" mengganti nilai `token` pada baris terkait → QR lama langsung invalid,
QR baru otomatis dikenali endpoint /delivery/confirm & /feedback.
"""
import io
import uuid

import bcrypt
import qrcode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from supabase import Client

from app.core.auth import CurrentAdmin, create_admin_token, get_current_admin
from app.core.config import settings
from app.core.database import get_supabase

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Schemas ────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class AdminSchool(BaseModel):
    school_id: int
    school_name: str
    sppg_id: int
    sppg_name: str
    delivery_token: str | None = None
    feedback_token: str | None = None


class GenerateResponse(BaseModel):
    school_id: int
    kind: str
    token: str
    message: str


# ── Helpers ────────────────────────────────────────────────────────

def _qr_url(kind: str, token: str) -> str:
    base = settings.BASE_URL.rstrip("/")
    if kind == "delivery":
        return f"{base}/delivery/confirm/{token}"
    return f"{base}/feedback/{token}"


def _get_school(school_id: int, db: Client) -> dict:
    rows = db.table("school").select("id, name, sppg_id").eq("id", school_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan.")
    return rows[0]


def _get_token(school_id: int, kind: str, db: Client) -> str | None:
    rows = (
        db.table("qr_token")
        .select("token")
        .eq("school_id", school_id)
        .eq("kind", kind)
        .execute()
        .data
    )
    return rows[0]["token"] if rows else None


def _regenerate(school_id: int, kind: str, db: Client) -> str:
    """Buat token baru (UUID) untuk (sekolah, kind). Token lama langsung invalid."""
    school = _get_school(school_id, db)
    new_token = uuid.uuid4().hex

    existing = (
        db.table("qr_token")
        .select("id")
        .eq("school_id", school_id)
        .eq("kind", kind)
        .execute()
        .data
    )

    if existing:
        db.table("qr_token").update(
            {"token": new_token, "active": True}
        ).eq("id", existing[0]["id"]).execute()
    else:
        db.table("qr_token").insert({
            "token": new_token,
            "kind": kind,
            "sppg_id": school["sppg_id"],
            "school_id": school_id,
            "active": True,
        }).execute()

    return new_token


def _qr_png(school_id: int, kind: str, db: Client) -> Response:
    _get_school(school_id, db)  # validasi sekolah ada (404 yang jelas)
    token = _get_token(school_id, kind, db)
    if not token:
        raise HTTPException(
            status_code=404,
            detail="QR belum dibuat untuk sekolah ini. Klik 'Generate Ulang' dulu.",
        )

    img = qrcode.make(_qr_url(kind, token))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="qr-{kind}-{school_id}.png"'},
    )


# ── Auth ───────────────────────────────────────────────────────────

@router.post("/login", response_model=AdminLoginResponse)
def admin_login(body: AdminLoginRequest, db: Client = Depends(get_supabase)):
    """Login admin. Verifikasi password bcrypt dari tabel admin."""
    rows = (
        db.table("admin")
        .select("username, password_hash")
        .eq("username", body.username)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=401, detail="Username atau password salah.")

    admin = rows[0]
    if not bcrypt.checkpw(body.password.encode(), admin["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Username atau password salah.")

    return AdminLoginResponse(
        access_token=create_admin_token(admin["username"]),
        username=admin["username"],
    )


# ── QR management (butuh admin) ────────────────────────────────────

@router.get("/schools", response_model=list[AdminSchool])
def list_schools(
    _: CurrentAdmin = Depends(get_current_admin),
    db: Client = Depends(get_supabase),
):
    """Semua sekolah beserta delivery_token & feedback_token masing-masing."""
    schools = db.table("school").select("id, name, sppg_id").order("id").execute().data
    sppg_names = {
        s["id"]: s["name"]
        for s in db.table("sppg").select("id, name").execute().data
    }
    tokens = db.table("qr_token").select("token, kind, school_id").execute().data

    by_school: dict[int, AdminSchool] = {
        s["id"]: AdminSchool(
            school_id=s["id"],
            school_name=s["name"],
            sppg_id=s["sppg_id"],
            sppg_name=sppg_names.get(s["sppg_id"], ""),
        )
        for s in schools
    }
    for t in tokens:
        entry = by_school.get(t["school_id"])
        if not entry:
            continue
        if t["kind"] == "delivery":
            entry.delivery_token = t["token"]
        elif t["kind"] == "feedback":
            entry.feedback_token = t["token"]

    return list(by_school.values())


@router.post("/schools/{school_id}/qr/delivery/generate", response_model=GenerateResponse)
def generate_delivery(
    school_id: int,
    _: CurrentAdmin = Depends(get_current_admin),
    db: Client = Depends(get_supabase),
):
    """Generate ulang token QR pengiriman 1 sekolah. QR lama langsung invalid."""
    token = _regenerate(school_id, "delivery", db)
    return GenerateResponse(
        school_id=school_id, kind="delivery", token=token,
        message="QR pengiriman diperbarui. QR lama sudah tidak berlaku.",
    )


@router.post("/schools/{school_id}/qr/feedback/generate", response_model=GenerateResponse)
def generate_feedback(
    school_id: int,
    _: CurrentAdmin = Depends(get_current_admin),
    db: Client = Depends(get_supabase),
):
    """Generate ulang token QR feedback 1 sekolah. QR lama langsung invalid."""
    token = _regenerate(school_id, "feedback", db)
    return GenerateResponse(
        school_id=school_id, kind="feedback", token=token,
        message="QR feedback diperbarui. QR lama sudah tidak berlaku.",
    )


@router.get("/schools/{school_id}/qr/delivery")
def delivery_qr_png(
    school_id: int,
    _: CurrentAdmin = Depends(get_current_admin),
    db: Client = Depends(get_supabase),
):
    """Ambil QR pengiriman 1 sekolah sebagai gambar PNG."""
    return _qr_png(school_id, "delivery", db)


@router.get("/schools/{school_id}/qr/feedback")
def feedback_qr_png(
    school_id: int,
    _: CurrentAdmin = Depends(get_current_admin),
    db: Client = Depends(get_supabase),
):
    """Ambil QR feedback 1 sekolah sebagai gambar PNG."""
    return _qr_png(school_id, "feedback", db)
