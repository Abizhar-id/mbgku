"""
Penjadwal rekap AI + reset bulanan.

Jadwal (zona WIB / Asia/Jakarta):
  - Setiap Jumat 15.00 WIB        → rekap MINGGUAN semua SPPG (Senin–Jumat).
  - Jumat TERAKHIR tiap bulan 15.00 → setelah weekly: rekap BULANAN (diturunkan
    dari rekap mingguan bulan itu) lalu RESET DB (hapus transaksional + rekap
    mingguan; rekap bulanan & data master tetap).

Pakai BackgroundScheduler (thread terpisah) karena pekerjaan rekap memanggil
Qwen secara sinkron — supaya tidak memblok event loop FastAPI.

Catatan produksi: jika backend dijalankan dengan >1 worker, scheduler akan aktif
di tiap worker (job bisa dobel). Untuk prototype (1 worker) ini aman.
"""
import logging
from datetime import date, timedelta

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.api import ai
from app.core.database import supabase

log = logging.getLogger("scheduler")

WIB = pytz.timezone("Asia/Jakarta")
scheduler = BackgroundScheduler(timezone=WIB)


def _is_last_friday(d: date) -> bool:
    """True bila `d` adalah Jumat terakhir di bulannya (Jumat berikutnya sudah bulan lain)."""
    return (d + timedelta(days=7)).month != d.month


def friday_job() -> None:
    """Job utama tiap Jumat 15.00 WIB."""
    db = supabase
    sppgs = db.table("sppg").select("id").execute().data
    log.info("[scheduler] Jumat 15.00 WIB — rekap mingguan untuk %d SPPG", len(sppgs))

    for s in sppgs:
        try:
            ai.generate_weekly(s["id"], db)
        except Exception as e:  # noqa: BLE001 — satu SPPG gagal jangan hentikan yang lain
            log.error("[scheduler] weekly gagal sppg=%s: %s", s["id"], e)

    if _is_last_friday(date.today()):
        log.info("[scheduler] Jumat terakhir bulan — rekap bulanan + reset DB")
        for s in sppgs:
            try:
                ai.generate_monthly(s["id"], db)
            except Exception as e:  # noqa: BLE001
                log.error("[scheduler] monthly gagal sppg=%s: %s", s["id"], e)
        try:
            counts = ai.reset_transactional(db)
            log.info("[scheduler] DB direset: %s", counts)
        except Exception as e:  # noqa: BLE001
            log.error("[scheduler] reset gagal: %s", e)


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(
        friday_job,
        CronTrigger(day_of_week="fri", hour=15, minute=0, timezone=WIB),
        id="friday_recap",
        replace_existing=True,
    )
    scheduler.start()
    log.info("[scheduler] aktif — rekap tiap Jumat 15.00 WIB")
