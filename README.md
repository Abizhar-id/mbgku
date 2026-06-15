# MBGku

Platform web publik untuk memonitor performa **SPPG** (Satuan Pelayanan Pemenuhan Gizi)
dalam program **Makan Bergizi Gratis (MBG)**. Tujuannya: transparansi publik,
akuntabilitas SPPG, dan kanal feedback siswa.

## 🔗 Akses Aplikasi (Live Demo)

Aplikasi sudah ter-deploy dan bisa langsung diakses publik di:

**https://mbgku-olive.vercel.app/**

Buka tautan di atas lewat browser (disarankan HP/desktop modern). Halaman utama
menampilkan leaderboard & daftar SPPG tanpa perlu login. Fitur kamera & scan QR
(dashboard operator, feedback siswa) berjalan di atas HTTPS, jadi langsung aktif
saat dibuka dari domain ini.

## Fitur

- **Leaderboard publik** — ranking SPPG berdasarkan ketepatan pengiriman & rating.
- **Profil SPPG** — timeline proses dapur (persiapan → masak → pengiriman), menu harian, ulasan.
- **Dashboard operator** — upload menu harian, foto proses dapur, konfirmasi pengiriman via scan QR.
- **Feedback siswa** — form rating via QR, dibuka terbatas (09.00–12.00 WIB).
- **Rekap AI** — ringkasan mingguan & bulanan performa SPPG (di-generate Qwen, di-cache).
- **Panel admin** — kelola & cetak QR (delivery + feedback) tiap sekolah.

## Tech Stack

| Layer    | Teknologi                              |
|----------|----------------------------------------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Backend  | FastAPI (Python)                       |
| Database | Supabase (PostgreSQL + Storage)        |
| AI       | Qwen (3.6-flash)     |

## Struktur

```
mbg/
├── mbg-backend/    # FastAPI: API, auth JWT, scheduler rekap, storage
│   └── app/{api, core, models}
└── mbg-frontend/   # Next.js: halaman publik, dashboard, feedback
    └── src/{app, components, lib, hooks, types}
```

## Menjalankan secara lokal

### Backend
```bash
cd mbg-backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # isi kredensial Supabase, Qwen, JWT
uvicorn app.main:app --reload
```
API jalan di `http://localhost:8000` (Swagger: `/docs`).

### Frontend
```bash
cd mbg-frontend
npm install
npm run dev
```
App jalan di `http://localhost:3000`.

## Environment (backend `.env`)

| Variabel | Keterangan |
|----------|------------|
| `SUPABASE_URL` | URL project Supabase  |
| `SUPABASE_SERVICE_KEY` | service_role key  |
| `DASHSCOPE_API_KEY` | API key Qwen / DashScope (Alibaba Cloud Model Studio) untuk rekap AI |
| `DASHSCOPE_BASE_URL` | Endpoint DashScope (OpenAI-compatible), ex: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| `QWEN_MODEL` | Nama model Qwen yang dipakai, ex: `qwen-plus` |
| `JWT_SECRET` | Secret token login — wajib string acak panjang |
| `JWT_EXPIRE_HOURS` | Masa berlaku token login (jam), ex: `12` |
| `FRONTEND_ORIGIN` | Origin frontend yang diizinkan CORS (lokal: `http://localhost:3000`, produksi: domainnya Vercel) |
| `BASE_URL` | URL frontend untuk encode tautan di dalam QR |

## Catatan

Prototipe dengan skup 10 SPPG × 30 sekolah. Upload foto **wajib via kamera perangkat**
konfirmasi pengiriman wajib scan QR lebih dulu sebelum kamera aktif.
