"""
Endpoint Pengiriman:
  POST /delivery/confirm/{token} → konfirmasi antar ke 1 sekolah  [auth + QR]

Alur:
  SPPG sampai di sekolah → scan QR delivery sekolah itu → kamera unlock
  → foto bukti → POST sini. Token statis = identitas sekolah.
"""
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.auth import CurrentOperator, get_current_operator
from app.core.database import get_supabase
from app.core.storage import upload_photo

router = APIRouter(prefix="/delivery", tags=["delivery"])


class DeliveryConfirm(BaseModel):
    photo: Optional[str] = None       # base64 / data URL dari kamera → di-upload server-side
    photo_url: Optional[str] = None   # atau URL foto yang sudah ter-upload sebelumnya


@router.post("/confirm/{token}")
def confirm_delivery(
    token: str,
    body: DeliveryConfirm,
    op: CurrentOperator = Depends(get_current_operator),
    db: Client = Depends(get_supabase),
):
    """Konfirmasi pengiriman ke 1 sekolah via scan QR + foto bukti."""
    rows = db.table("qr_token").select("*").eq("token", token).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="QR tidak dikenali.")

    qr = rows[0]
    if qr["kind"] != "delivery":
        raise HTTPException(status_code=400, detail="QR ini bukan QR konfirmasi pengiriman.")
    if not qr["active"]:
        raise HTTPException(status_code=400, detail="QR nonaktif.")
    if qr["sppg_id"] != op.sppg_id:
        raise HTTPException(status_code=403, detail="QR ini bukan milik SPPG Anda.")

    school_id = qr["school_id"]
    today = date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat()

    # photo_url eksplisit dipakai langsung; kalau tidak ada, upload foto base64.
    photo_url = body.photo_url
    if not photo_url:
        if not body.photo:
            raise HTTPException(status_code=400, detail="Foto bukti pengiriman wajib diisi.")
        photo_url = upload_photo(body.photo, folder=f"delivery/{op.sppg_id}")

    # Sudah ada record hari ini? → update, kalau belum → insert
    existing = (
        db.table("delivery")
        .select("id")
        .eq("sppg_id", op.sppg_id)
        .eq("school_id", school_id)
        .eq("delivery_date", today)
        .execute()
        .data
    )

    payload = {"arrived_at": now, "status": "delivered", "photo_url": photo_url}

    if existing:
        delivery_id = existing[0]["id"]
        db.table("delivery").update(payload).eq("id", delivery_id).execute()
    else:
        inserted = db.table("delivery").insert({
            "sppg_id": op.sppg_id,
            "school_id": school_id,
            "delivery_date": today,
            "sent_at": now,
            **payload,
        }).execute().data
        delivery_id = inserted[0]["id"]

    school = db.table("school").select("name").eq("id", school_id).execute().data

    return {
        "delivery_id": delivery_id,
        "school_id": school_id,
        "school_name": school[0]["name"] if school else "",
        "photo_url": photo_url,
        "message": "Konfirmasi pengiriman tersimpan.",
    }