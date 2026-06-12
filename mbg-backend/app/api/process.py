"""
Endpoints Proses:
  POST /process/kitchen   → upload foto tahap Persiapan / Masak  [auth, tanpa QR]
  GET  /process/{sppg_id} → timeline proses hari ini             [public]

Tahap: Persiapan → Masak → Pengiriman
  - Persiapan & Masak : 1x per SPPG/hari, di dapur, cukup foto kamera (tanpa QR)
  - Pengiriman        : per sekolah, butuh scan QR (lihat delivery.py)
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.auth import CurrentOperator, get_current_operator
from app.core.database import get_supabase
from app.core.storage import upload_photo

router = APIRouter(prefix="/process", tags=["process"])


# ── Schemas ────────────────────────────────────────────────────────

class KitchenUpload(BaseModel):
    stage: str   # persiapan | masak
    photo: str   # base64 / data URL dari kamera


class StageStatus(BaseModel):
    stage: str
    done: bool
    photo_url: Optional[str] = None


class SchoolDelivery(BaseModel):
    school_id: int
    school_name: str
    done: bool
    photo_url: Optional[str] = None


class ProcessTimeline(BaseModel):
    sppg_id: int
    date: str
    persiapan: StageStatus
    masak: StageStatus
    pengiriman: list[SchoolDelivery]


# ── Endpoints ──────────────────────────────────────────────────────

@router.post("/kitchen")
def upload_kitchen(
    body: KitchenUpload,
    op: CurrentOperator = Depends(get_current_operator),
    db: Client = Depends(get_supabase),
):
    """Upload foto tahap Persiapan / Masak. Re-upload menimpa yang lama."""
    if body.stage not in ("persiapan", "masak"):
        raise HTTPException(status_code=400, detail="stage harus 'persiapan' atau 'masak'.")

    photo_url = upload_photo(body.photo, folder=f"kitchen/{op.sppg_id}")
    today = date.today().isoformat()

    db.table("kitchen_process").upsert(
        {
            "sppg_id": op.sppg_id,
            "process_date": today,
            "stage": body.stage,
            "photo_url": photo_url,
        },
        on_conflict="sppg_id,process_date,stage",
    ).execute()

    return {"stage": body.stage, "photo_url": photo_url, "message": f"Foto {body.stage} tersimpan."}


@router.get("/{sppg_id}", response_model=ProcessTimeline)
def get_today_process(sppg_id: int, db: Client = Depends(get_supabase)):
    """Timeline proses hari ini (publik): Persiapan, Masak, Pengiriman per sekolah."""
    today = date.today().isoformat()

    kp = (
        db.table("kitchen_process")
        .select("stage, photo_url")
        .eq("sppg_id", sppg_id)
        .eq("process_date", today)
        .execute()
        .data
    )
    kp_map = {r["stage"]: r.get("photo_url") for r in kp}

    schools = db.table("school").select("id, name").eq("sppg_id", sppg_id).execute().data
    deliveries = (
        db.table("delivery")
        .select("school_id, photo_url, status")
        .eq("sppg_id", sppg_id)
        .eq("delivery_date", today)
        .execute()
        .data
    )
    deliv_map = {d["school_id"]: d for d in deliveries}

    pengiriman = []
    for s in schools:
        d = deliv_map.get(s["id"])
        done = bool(d and d.get("status") in ("delivered", "late"))
        pengiriman.append(SchoolDelivery(
            school_id=s["id"],
            school_name=s["name"],
            done=done,
            photo_url=(d.get("photo_url") if d else None),
        ))

    return ProcessTimeline(
        sppg_id=sppg_id,
        date=today,
        persiapan=StageStatus(stage="persiapan", done="persiapan" in kp_map, photo_url=kp_map.get("persiapan")),
        masak=StageStatus(stage="masak", done="masak" in kp_map, photo_url=kp_map.get("masak")),
        pengiriman=pengiriman,
    )