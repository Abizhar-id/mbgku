"""
Seed data prototype MBG Transparency Platform (v2).

Jalankan SETELAH:
  1. schema.sql (v2) sudah di-run di Supabase SQL Editor
  2. .env sudah diisi (SUPABASE_URL + SUPABASE_SERVICE_KEY)

    python seed.py

Membuat 3 SPPG (1 bagus, 1 sedang, 1 bermasalah) x 3 sekolah, plus:
  - delivery + feedback 7 hari (buat leaderboard)
  - kitchen_process 7 hari (tahap persiapan & masak)
  - QR statis: 2 per sekolah (delivery + feedback)
"""
import secrets
from datetime import date, datetime, timedelta, timezone

import bcrypt

from app.core.database import supabase

# Prototype: password operator simpel & seragam (tetap di-hash bcrypt di DB).
OPERATOR_PASSWORD = "sppg123"


def hash_password(plain: str) -> str:
    """Hash bcrypt — disimpan di kolom `password` (nama kolom dipertahankan, isi hash)."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

random_seed = 42
import random
random.seed(random_seed)  # reproducible

WIB = timezone(timedelta(hours=7))
TODAY = date.today()

# (nama, alamat, profil) — profil mengatur kualitas data
SPPG_DEFS = [
    ("SPPG Dapur Sehat Yogyakarta", "Jl. Kaliurang KM 5, Sleman", "good"),
    ("SPPG Gizi Mandiri Sleman", "Jl. Magelang KM 7, Sleman", "medium"),
    ("SPPG Bunda Bantul", "Jl. Bantul KM 8, Bantul", "poor"),
]

SCHOOL_NAMES = {
    "SPPG Dapur Sehat Yogyakarta": ["SDN Caturtunggal 1", "SDN Caturtunggal 3", "SDN Nolobangsan"],
    "SPPG Gizi Mandiri Sleman": ["SDN Sinduadi 1", "SDN Mlati 2", "SDN Tlogoadi"],
    "SPPG Bunda Bantul": ["SDN Bantul 1", "SDN Trirenggo", "SDN Palbapang"],
}

MENUS = [
    "Nasi, ayam goreng, tumis buncis, jeruk",
    "Nasi, telur balado, sayur sop, pisang",
    "Nasi, ikan tongkol, capcay, semangka",
    "Nasi, tempe orek, sayur bayam, apel",
    "Nasi, daging semur, tumis kangkung, melon",
    "Nasi uduk, ayam suwir, lalapan, pepaya",
    "Nasi, perkedel, sup ayam, jeruk",
]

COMMENTS = {
    "good": [
        "Makanannya enak dan masih hangat.",
        "Porsinya pas, sayurnya segar.",
        "Tepat waktu, anak-anak suka.",
        "Bersih dan rapi, terima kasih.",
    ],
    "medium": [
        "Lumayan, tapi kadang agak telat.",
        "Rasanya biasa saja.",
        "Cukup mengenyangkan.",
        "Sayurnya kurang banyak.",
    ],
    "poor": [
        "Sering telat datang.",
        "Makanan kadang sudah dingin.",
        "Porsi kurang, anak masih lapar.",
        "Menu kurang variatif.",
    ],
}

PROFILE = {
    "good":   dict(rating=(4, 5), miss=0.00, delay=(0, 15)),
    "medium": dict(rating=(3, 4), miss=0.03, delay=(10, 40)),
    "poor":   dict(rating=(1, 3), miss=0.10, delay=(30, 90)),
}


def insert(table: str, rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    return supabase.table(table).insert(rows).execute().data


def main() -> None:
    print("Seeding...")
    for name, address, profile in SPPG_DEFS:
        p = PROFILE[profile]

        sppg = insert("sppg", [{"name": name, "address": address}])[0]
        sppg_id = sppg["id"]
        print(f"  SPPG: {name} (id={sppg_id}, profil={profile})")

        # operator login → username unik, password simpel (di-hash bcrypt)
        username = f"{name.split()[1].lower()}{sppg_id}"
        insert("operator", [{
            "sppg_id": sppg_id,
            "username": username,
            "password": hash_password(OPERATOR_PASSWORD),
        }])
        print(f"     login: {username} / {OPERATOR_PASSWORD}")

        # sekolah
        schools = insert("school", [{"sppg_id": sppg_id, "name": n} for n in SCHOOL_NAMES[name]])

        # QR STATIS: 2 per sekolah (delivery + feedback)
        qr_rows = []
        for school in schools:
            qr_rows.append({
                "token": secrets.token_urlsafe(12), "kind": "delivery",
                "sppg_id": sppg_id, "school_id": school["id"],
            })
            qr_rows.append({
                "token": secrets.token_urlsafe(12), "kind": "feedback",
                "sppg_id": sppg_id, "school_id": school["id"],
            })
        insert("qr_token", qr_rows)

        # menu 7 hari
        insert("menu", [
            {
                "sppg_id": sppg_id,
                "menu_date": (TODAY - timedelta(days=d)).isoformat(),
                "description": MENUS[d % len(MENUS)],
            }
            for d in range(7)
        ])

        # kitchen_process 7 hari: persiapan + masak (per SPPG/hari)
        kp_rows = []
        for d in range(7):
            day = (TODAY - timedelta(days=d)).isoformat()
            kp_rows.append({"sppg_id": sppg_id, "process_date": day, "stage": "persiapan"})
            kp_rows.append({"sppg_id": sppg_id, "process_date": day, "stage": "masak"})
        insert("kitchen_process", kp_rows)

        # delivery + feedback per sekolah per hari
        deliveries, feedbacks = [], []
        for school in schools:
            for d in range(7):
                day = TODAY - timedelta(days=d)
                if random.random() < p["miss"]:
                    deliveries.append({
                        "sppg_id": sppg_id, "school_id": school["id"],
                        "delivery_date": day.isoformat(), "status": "pending",
                    })
                    continue
                sent = datetime(day.year, day.month, day.day, 6, 30, tzinfo=WIB)
                delay = random.randint(*p["delay"])
                arrived = sent + timedelta(minutes=45 + delay)
                deliveries.append({
                    "sppg_id": sppg_id, "school_id": school["id"],
                    "delivery_date": day.isoformat(),
                    "sent_at": sent.isoformat(),
                    "arrived_at": arrived.isoformat(),
                    "status": "late" if delay > 30 else "delivered",
                })
                for _ in range(random.randint(1, 2)):
                    feedbacks.append({
                        "sppg_id": sppg_id, "school_id": school["id"],
                        "rating": random.randint(*p["rating"]),
                        "comment": random.choice(COMMENTS[profile]),
                        "created_at": arrived.isoformat(),
                    })
        insert("delivery", deliveries)
        insert("feedback", feedbacks)
        print(f"     {len(schools)} sekolah · {len(qr_rows)} QR · {len(deliveries)} delivery · {len(feedbacks)} feedback")

    print("Selesai OK  Data siap dipakai.")
    print(f"   Semua operator login pakai password: {OPERATOR_PASSWORD} (di DB tersimpan sbg hash).")


if __name__ == "__main__":
    main()