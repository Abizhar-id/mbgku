"""
Endpoints SPPG:
  GET /sppg/leaderboard   → ranking semua SPPG (rating + performa)
  GET /sppg               → list semua SPPG
  GET /sppg/{sppg_id}     → profil lengkap 1 SPPG
"""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase

router = APIRouter(prefix="/sppg", tags=["sppg"])


# ── Response schemas ───────────────────────────────────────────────

class SPPGSummary(BaseModel):
    id: int
    name: str
    address: Optional[str]
    avg_rating: float
    total_feedback: int
    delivery_rate: float        # % pengiriman yang delivered (bukan pending/late)
    rank: int


class DeliverySummary(BaseModel):
    school_id: int
    school_name: str
    delivery_date: str
    status: str
    sent_at: Optional[str]
    arrived_at: Optional[str]
    photo_url: Optional[str] = None


class MenuSummary(BaseModel):
    menu_date: str
    description: str
    photo_url: Optional[str]


class SPPGProfile(BaseModel):
    id: int
    name: str
    address: Optional[str]
    avg_rating: float
    total_feedback: int
    delivery_rate: float
    rank: int
    recent_deliveries: list[DeliverySummary]
    today_menu: Optional[MenuSummary]


# ── Helper ─────────────────────────────────────────────────────────

def _calc_stats(sppg_id: int, db: Client) -> dict:
    """Hitung avg_rating dan delivery_rate untuk 1 SPPG.

    delivery_rate = % pengiriman yang "tepat", yaitu (arrived_at - sent_at) <= 30 menit.
    """
    feedbacks = db.table("feedback").select("rating").eq("sppg_id", sppg_id).execute().data
    avg_rating = round(sum(f["rating"] for f in feedbacks) / len(feedbacks), 2) if feedbacks else 0.0

    deliveries = db.table("delivery").select("sent_at, arrived_at").eq("sppg_id", sppg_id).execute().data

    def is_tepat(d):
        if not d.get("sent_at") or not d.get("arrived_at"):
            return False
        try:
            from datetime import datetime
            sent = datetime.fromisoformat(d["sent_at"])
            arrived = datetime.fromisoformat(d["arrived_at"])
            return (arrived - sent).total_seconds() <= 1800
        except Exception:
            return False

    tepat = sum(1 for d in deliveries if is_tepat(d))
    delivery_rate = round(tepat / len(deliveries) * 100, 1) if deliveries else 0.0

    return {
        "avg_rating": avg_rating,
        "total_feedback": len(feedbacks),
        "delivery_rate": delivery_rate,
    }


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/leaderboard", response_model=list[SPPGSummary])
def get_leaderboard(db: Client = Depends(get_supabase)):
    """Semua SPPG diurutkan dari ketepatan pengiriman tertinggi."""
    sppg_list = db.table("sppg").select("id, name, address").execute().data

    results = []
    for sppg in sppg_list:
        stats = _calc_stats(sppg["id"], db)
        results.append({**sppg, **stats})

    # Sort: delivery_rate dulu, avg_rating sebagai tiebreaker
    results.sort(key=lambda x: (x["delivery_rate"], x["avg_rating"]), reverse=True)

    return [SPPGSummary(**{**r, "rank": i + 1}) for i, r in enumerate(results)]


@router.get("", response_model=list[SPPGSummary])
def get_sppg_list(db: Client = Depends(get_supabase)):
    """List semua SPPG (sama seperti leaderboard tapi tanpa sort ketat)."""
    return get_leaderboard(db)


@router.get("/{sppg_id}", response_model=SPPGProfile)
def get_sppg_profile(sppg_id: int, db: Client = Depends(get_supabase)):
    """Profil lengkap 1 SPPG: stats + 7 hari delivery + menu minggu ini."""

    # Cek SPPG ada
    sppg_data = db.table("sppg").select("id, name, address").eq("id", sppg_id).execute().data
    if not sppg_data:
        raise HTTPException(status_code=404, detail="SPPG tidak ditemukan")
    sppg = sppg_data[0]

    # Stats
    stats = _calc_stats(sppg_id, db)

    # Rank — hitung posisi di antara semua SPPG (konsisten dengan leaderboard:
    # delivery_rate dulu, avg_rating sebagai tiebreaker)
    all_sppg = db.table("sppg").select("id").execute().data
    all_stats = [(s["id"], _calc_stats(s["id"], db)) for s in all_sppg]
    all_stats.sort(key=lambda x: (x[1]["delivery_rate"], x[1]["avg_rating"]), reverse=True)
    rank = next((i + 1 for i, (sid, _) in enumerate(all_stats) if sid == sppg_id), 1)

    # Delivery 7 hari terakhir (join manual karena Supabase PostgREST)
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    deliveries_raw = (
        db.table("delivery")
        .select("school_id, delivery_date, status, sent_at, arrived_at, photo_url")
        .eq("sppg_id", sppg_id)
        .gte("delivery_date", week_ago)
        .order("delivery_date", desc=True)
        .execute()
        .data
    )

    # Ambil nama sekolah
    schools = {
        s["id"]: s["name"]
        for s in db.table("school").select("id, name").eq("sppg_id", sppg_id).execute().data
    }

    recent_deliveries = [
        DeliverySummary(
            school_id=d["school_id"],
            school_name=schools.get(d["school_id"], ""),
            delivery_date=str(d["delivery_date"]),
            status=d["status"],
            sent_at=d.get("sent_at"),
            arrived_at=d.get("arrived_at"),
            photo_url=d.get("photo_url"),
        )
        for d in deliveries_raw
    ]

    # Menu hari ini saja (1 menu per hari per SPPG)
    today = date.today().isoformat()
    menus_raw = (
        db.table("menu")
        .select("menu_date, description, photo_url")
        .eq("sppg_id", sppg_id)
        .eq("menu_date", today)
        .limit(1)
        .execute()
        .data
    )

    today_menu = (
        MenuSummary(
            menu_date=str(menus_raw[0]["menu_date"]),
            description=menus_raw[0]["description"],
            photo_url=menus_raw[0].get("photo_url"),
        )
        if menus_raw
        else None
    )

    return SPPGProfile(
        **sppg,
        **stats,
        rank=rank,
        recent_deliveries=recent_deliveries,
        today_menu=today_menu,
    )