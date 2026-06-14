"""
Endpoints SPPG:
  GET /sppg/leaderboard   → ranking semua SPPG (rating + performa)
  GET /sppg               → list semua SPPG
  GET /sppg/{sppg_id}     → profil lengkap 1 SPPG
"""
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase

router = APIRouter(prefix="/sppg", tags=["sppg"])

# Statistik hanya menghitung data 30 hari terakhir (cukup untuk leaderboard &
# mencegah scan tabel penuh saat data historis menumpuk).
STATS_WINDOW_DAYS = 30
STATS_ROW_LIMIT = 50_000   # batas keras agar query tidak unbounded

# Cache in-memory leaderboard (TTL 60 dtk). Mengurangi 2 query tabel + agregasi
# di tiap request publik menjadi sekali per menit. Aman untuk 1 worker; untuk
# multi-worker tiap worker punya cache sendiri (tetap valid, hanya kurang hemat).
_CACHE_TTL = 60  # detik
_leaderboard_cache: dict = {"data": None, "ts": 0.0}


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

_ZERO_STATS = {"avg_rating": 0.0, "total_feedback": 0, "delivery_rate": 0.0}


def _is_tepat(d: dict) -> bool:
    """Pengiriman 'tepat' = selisih (arrived_at - sent_at) <= 30 menit."""
    if not d.get("sent_at") or not d.get("arrived_at"):
        return False
    try:
        sent = datetime.fromisoformat(d["sent_at"])
        arrived = datetime.fromisoformat(d["arrived_at"])
        return (arrived - sent).total_seconds() <= 1800
    except Exception:
        return False


def _all_stats(db: Client) -> dict[int, dict]:
    """Hitung avg_rating, total_feedback, delivery_rate UNTUK SEMUA SPPG dalam 2 query.

    Ganti pola N+1 (2 query per SPPG) → 2 query total, lalu agregasi di Python.
    Hanya memproses data `STATS_WINDOW_DAYS` hari terakhir + `.limit()` eksplisit
    agar tidak men-scan seluruh tabel historis (perf + hindari diam-diam terpotong
    di default-limit PostgREST).
    """
    since = (date.today() - timedelta(days=STATS_WINDOW_DAYS)).isoformat()
    feedbacks = (
        db.table("feedback")
        .select("sppg_id, rating")
        .gte("created_at", since)
        .limit(STATS_ROW_LIMIT)
        .execute()
        .data
    )
    deliveries = (
        db.table("delivery")
        .select("sppg_id, sent_at, arrived_at")
        .gte("delivery_date", since)
        .limit(STATS_ROW_LIMIT)
        .execute()
        .data
    )

    ratings_by: dict[int, list[int]] = defaultdict(list)
    for f in feedbacks:
        ratings_by[f["sppg_id"]].append(f["rating"])

    deliv_by: dict[int, list[dict]] = defaultdict(list)
    for d in deliveries:
        deliv_by[d["sppg_id"]].append(d)

    stats: dict[int, dict] = {}
    for sid in set(ratings_by) | set(deliv_by):
        ratings = ratings_by.get(sid, [])
        ds = deliv_by.get(sid, [])
        tepat = sum(1 for d in ds if _is_tepat(d))
        stats[sid] = {
            "avg_rating": round(sum(ratings) / len(ratings), 2) if ratings else 0.0,
            "total_feedback": len(ratings),
            "delivery_rate": round(tepat / len(ds) * 100, 1) if ds else 0.0,
        }
    return stats


# ── Endpoints ──────────────────────────────────────────────────────

def _build_leaderboard(db: Client) -> list[SPPGSummary]:
    """Bangun leaderboard dari DB (tanpa cache). Dipanggil oleh _get_leaderboard_cached."""
    sppg_list = db.table("sppg").select("id, name, address").execute().data
    stats = _all_stats(db)

    results = [{**sppg, **stats.get(sppg["id"], _ZERO_STATS)} for sppg in sppg_list]

    # Sort: delivery_rate dulu, avg_rating sebagai tiebreaker
    results.sort(key=lambda x: (x["delivery_rate"], x["avg_rating"]), reverse=True)

    return [SPPGSummary(**{**r, "rank": i + 1}) for i, r in enumerate(results)]


def _get_leaderboard_cached(db: Client) -> list[SPPGSummary]:
    """Leaderboard dengan cache in-memory TTL 60 dtk."""
    now = time.time()
    if _leaderboard_cache["data"] is not None and now - _leaderboard_cache["ts"] < _CACHE_TTL:
        return _leaderboard_cache["data"]
    data = _build_leaderboard(db)
    _leaderboard_cache.update({"data": data, "ts": now})
    return data


@router.get("/leaderboard", response_model=list[SPPGSummary])
def get_leaderboard(db: Client = Depends(get_supabase)):
    """Semua SPPG diurutkan dari ketepatan pengiriman tertinggi (cache 60 dtk)."""
    return _get_leaderboard_cached(db)


@router.get("", response_model=list[SPPGSummary])
def get_sppg_list(db: Client = Depends(get_supabase)):
    """List semua SPPG (sama seperti leaderboard tapi tanpa sort ketat)."""
    return _get_leaderboard_cached(db)


@router.get("/{sppg_id}", response_model=SPPGProfile)
def get_sppg_profile(sppg_id: int, db: Client = Depends(get_supabase)):
    """Profil lengkap 1 SPPG: stats + 7 hari delivery + menu minggu ini."""

    # Ambil semua SPPG sekali (buat cek keberadaan + hitung rank), stats sekali.
    all_sppg = db.table("sppg").select("id, name, address").execute().data
    sppg = next((s for s in all_sppg if s["id"] == sppg_id), None)
    if not sppg:
        raise HTTPException(status_code=404, detail="SPPG tidak ditemukan")

    all_stats = _all_stats(db)
    stats = all_stats.get(sppg_id, _ZERO_STATS)

    # Rank — konsisten dengan leaderboard (delivery_rate dulu, avg_rating tiebreaker)
    ranking = sorted(
        all_sppg,
        key=lambda s: (
            all_stats.get(s["id"], _ZERO_STATS)["delivery_rate"],
            all_stats.get(s["id"], _ZERO_STATS)["avg_rating"],
        ),
        reverse=True,
    )
    rank = next((i + 1 for i, s in enumerate(ranking) if s["id"] == sppg_id), 1)

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