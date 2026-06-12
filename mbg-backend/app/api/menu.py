"""
Endpoints Menu:
  POST /menu/today          → upload menu hari ini + foto  [auth]
  GET  /menu/{sppg_id}      → menu 7 hari terakhir         [public]
  GET  /menu/{sppg_id}/today → menu hari ini saja          [public]
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client
from typing import Optional

from app.core.auth import CurrentOperator, get_current_operator
from app.core.database import get_supabase
from app.core.storage import upload_photo

router = APIRouter(prefix="/menu", tags=["menu"])


# ── Schemas ────────────────────────────────────────────────────────

class MenuUpload(BaseModel):
    description: str
    photo: Optional[str] = None       # base64 / data URL → di-upload server-side
    photo_url: Optional[str] = None   # atau URL foto yang sudah ter-upload (mis. saat edit)


class MenuResponse(BaseModel):
    id: int
    sppg_id: int
    menu_date: str
    description: str
    photo_url: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────

@router.post("/today", response_model=MenuResponse)
def upload_menu_today(
    body: MenuUpload,
    op: CurrentOperator = Depends(get_current_operator),
    db: Client = Depends(get_supabase),
):
    """
    Upload menu hari ini. Kalau sudah ada → update (upsert).
    Foto opsional — bisa upload tanpa foto dulu, update foto belakangan.
    """
    today = date.today().isoformat()

    # photo_url eksplisit dipakai langsung; kalau tidak ada, upload foto base64.
    photo_url = body.photo_url
    if not photo_url and body.photo:
        photo_url = upload_photo(body.photo, folder=f"menu/{op.sppg_id}")

    payload = {
        "sppg_id": op.sppg_id,
        "menu_date": today,
        "description": body.description,
    }
    if photo_url:
        payload["photo_url"] = photo_url

    # Cek sudah ada menu hari ini?
    existing = (
        db.table("menu")
        .select("id")
        .eq("sppg_id", op.sppg_id)
        .eq("menu_date", today)
        .execute()
        .data
    )

    if existing:
        menu_id = existing[0]["id"]
        result = db.table("menu").update(payload).eq("id", menu_id).execute().data
    else:
        result = db.table("menu").insert(payload).execute().data

    row = result[0]
    return MenuResponse(
        id=row["id"],
        sppg_id=row["sppg_id"],
        menu_date=str(row["menu_date"]),
        description=row["description"],
        photo_url=row.get("photo_url"),
    )


@router.get("/{sppg_id}/today", response_model=MenuResponse)
def get_menu_today(sppg_id: int, db: Client = Depends(get_supabase)):
    """Menu hari ini untuk 1 SPPG (publik)."""
    today = date.today().isoformat()
    rows = (
        db.table("menu")
        .select("*")
        .eq("sppg_id", sppg_id)
        .eq("menu_date", today)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Menu hari ini belum diupload.")

    row = rows[0]
    return MenuResponse(
        id=row["id"],
        sppg_id=row["sppg_id"],
        menu_date=str(row["menu_date"]),
        description=row["description"],
        photo_url=row.get("photo_url"),
    )


@router.get("/{sppg_id}", response_model=list[MenuResponse])
def get_menu_weekly(sppg_id: int, db: Client = Depends(get_supabase)):
    """Menu 7 hari terakhir untuk 1 SPPG (publik)."""
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    rows = (
        db.table("menu")
        .select("*")
        .eq("sppg_id", sppg_id)
        .gte("menu_date", week_ago)
        .order("menu_date", desc=True)
        .execute()
        .data
    )
    return [
        MenuResponse(
            id=r["id"],
            sppg_id=r["sppg_id"],
            menu_date=str(r["menu_date"]),
            description=r["description"],
            photo_url=r.get("photo_url"),
        )
        for r in rows
    ]