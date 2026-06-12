# Setup — Fondasi Hari 1

Urutan ini sekali jalan, ~15 menit. Setelah ini backend bisa boot + konek Supabase.

## 1. Virtual env + dependencies
```bash
cd mbg-backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Bikin project Supabase
1. Buka https://supabase.com → New project (region: **Southeast Asia / Singapore**).
2. Tunggu provisioning selesai.
3. **SQL Editor** → New query → paste isi `app/models/schema.sql` → **Run**.
   (Bikin semua tabel. Aman di-run ulang — ada `drop ... cascade` di atas.)

## 3. Isi `.env`
```bash
cp .env.example .env
```
Isi dari **Supabase → Project Settings → API**:
- `SUPABASE_URL` → Project URL
- `SUPABASE_SERVICE_KEY` → **service_role** key (yang `secret`, BUKAN anon)

Qwen (DashScope) boleh diisi nanti pas garap `ai.py` — belum dipakai di fondasi.

## 4. Seed data
```bash
python seed.py
```
Output kira-kira:
```
SPPG: SPPG Dapur Sehat Yogyakarta (id=1, profil=good)
   login: dapur1 / sppg123
   3 sekolah · 21 delivery · ~30 feedback
...
Selesai ✅
```
Cek di Supabase → Table Editor, tabel `sppg`/`delivery`/`feedback` udah keisi.

## 5. Jalankan server
```bash
uvicorn app.main:app --reload
```
- http://localhost:8000/health → `{"status":"ok"}`
- Log harus muncul: `[startup] Supabase OK ✅`
- http://localhost:8000/docs → Swagger (masih kosong, wajar)

---

## Kalau `[startup] Supabase belum siap`
- Cek `SUPABASE_URL` & `SUPABASE_SERVICE_KEY` di `.env` (pastikan service_role, bukan anon).
- Pastikan `schema.sql` udah di-run (tabel `sppg` harus ada).

## Yang sudah jadi (Fondasi Hari 1)
- `app/core/config.py` — semua env var
- `app/core/database.py` — koneksi Supabase
- `app/models/` — Pydantic models + `schema.sql`
- `seed.py` — data 3 SPPG × 3 sekolah, 7 hari
- `app/main.py` — server boot + health check

## Selanjutnya
- `app/api/sppg.py` — endpoint baca (leaderboard, list, profil)
- `app/api/ai.py` — rekap Qwen
