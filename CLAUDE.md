# MBG Transparency Platform — Claude Code Context

> Backend repo. This file is the **persistent contract** for every session.
> Keep it lean.

## Project Overview

Platform web publik untuk memonitoring performa SPPG (Satuan Pelayanan Pemenuhan Gizi)
dalam program MBG (Makan Bergizi Gratis). Tujuan: transparansi publik, akuntabilitas
SPPG, feedback siswa.

**Prototype scope:** 3 SPPG × 3 sekolah. Gunakan mock data di mana backend belum siap.

---

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | Next.js 15 (App Router), TypeScript strict |
| Styling  | Tailwind CSS v4, Shadcn/ui        |
| Backend  | FastAPI (Python)                  |
| Database | Supabase PostgreSQL               |
| AI       | Qwen API — backend-side only      |
| Comms    | REST API (JSON)                   |
| CI/CD    | GitHub Actions                    |

Frontend berbicara ke backend via REST only. **Jangan pernah** panggil Qwen atau
sentuh DB dari frontend.

---

## Routing & Architecture

Single source of truth = **path-based routes**. Subdomain hanya di production.

| Path                | Area                      | Access           |
|---------------------|---------------------------|------------------|
| `/`                 | Public leaderboard + list | Public           |
| `/sppg/[id]`        | Public SPPG profile       | Public           |
| `/login`            | SPPG operator login       | Public form      |
| `/dashboard`        | SPPG operator dashboard   | Protected (auth) |
| `/feedback/[token]` | Student feedback form     | QR-accessed      |

- **Subdomains are deploy-time only.** Dev pakai path langsung (`localhost:3000/dashboard`).
  Di production, `middleware.ts` rewrite subdomain → path.
- Auth guard di `app/dashboard/layout.tsx` — jangan di group layout yang wrap `/login`.

---

## Folder Structure

### Frontend
```
src/
├── app/
│   ├── layout.tsx
│   ├── (public)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # → /
│   │   └── sppg/[id]/page.tsx       # → /sppg/:id
│   ├── login/page.tsx               # → /login
│   ├── dashboard/
│   │   ├── layout.tsx               # AUTH GUARD di sini
│   │   └── page.tsx                 # → /dashboard
│   └── feedback/[token]/page.tsx    # → /feedback/:token
├── components/   { ui/  shared/  features/ }
├── lib/          { api/  mock-data.ts  utils.ts  camera.ts }
├── hooks/        { useCamera  useAuth  useQRTimer }
└── types/        { sppg  feedback  api  ai }
```

### Backend
```
mbg-backend/
├── app/
│   ├── api/
│   │   ├── sppg.py          # data SPPG, rating, ranking
│   │   ├── delivery.py      # konfirmasi pengiriman + foto
│   │   ├── feedback.py      # feedback siswa + foto
│   │   ├── menu.py          # menu harian/mingguan
│   │   ├── qr.py            # generate + validasi QR token
│   │   └── ai.py            # rekap otomatis via Qwen
│   ├── core/
│   │   ├── config.py        # env vars
│   │   ├── database.py      # koneksi Supabase PostgreSQL
│   │   └── auth.py          # JWT login SPPG
│   ├── models/              # struktur tabel database
│   └── main.py              # entry point FastAPI
├── .env
├── requirements.txt
└── Dockerfile
```

---

## Hard Constraints — Never Violate

1. **Camera-only photo upload.** Semua upload foto pakai device camera via
   `getUserMedia`. **Tidak ada `<input type="file">` di mana pun** — termasuk fallback.
   Butuh HTTPS di production (localhost dev OK).

2. **Izin kamera wajib ditangani.** Kamera kadang tidak muncul karena izin browser
   ditolak atau belum diminta. Wajib handle 3 state:
   - `idle` → tampilkan tombol "Aktifkan Kamera"
   - `denied` → tampilkan pesan error + instruksi cara allow di browser
   - `active` → tampilkan live preview kamera
   Jangan langsung panggil `getUserMedia` tanpa cek `permissions.query` dulu.

3. **QR time-gating.** Token di `/feedback/[token]` adalah access-validation token.
   Frontend validasi via `GET /qr/validate/:token`. Backend yang generate semua QR.
   Frontend tidak pernah generate QR client-side.

4. **Delivery scan dulu, kamera baru bisa akses.** Alur konfirmasi pengiriman:
   - Sekolah scan QR konfirmasi → `POST /delivery/confirm/:token`
   - Backend validasi token → return `delivery_id`
   - Baru kamera aktif untuk upload foto bukti pengiriman
   - Kamera tidak boleh aktif sebelum QR berhasil di-scan dan divalidasi backend

5. **SPPG upload menu per hari.** Menu di-input harian oleh SPPG operator via dashboard,
   bukan mingguan sekaligus. Endpoint `POST /menu/today` menerima foto + deskripsi menu
   hari ini. History menu tetap bisa dilihat per minggu di public profile.

6. **AI summaries are backend-only.** Qwen jalan di FastAPI. Frontend fetch teks
   summary yang sudah di-generate via REST. Jangan import AI SDK di frontend.

---

## Development Rules

1. **One page at a time.** Selesaikan dan konfirmasi satu page sebelum lanjut.
2. **Mock data first.** Bangun UI di atas mock data, wire API setelah backend siap.
3. **TypeScript strict.** No `any`, no `@ts-ignore`. Semua types di `/types`.
4. **No file picker.** Mau nulis `<input type="file">`? Stop — pakai `CameraCapture`.
5. **Mobile-first.** Setiap komponen harus jalan di 375px sebelum desktop.
6. **Error states required.** Setiap API call butuh UI: loading, success, dan error.
7. **No inline styles.** Tailwind classes + CSS variables saja.
8. **Accessible.** aria labels di interactive elements, alt text di images.
9. **UI/UX optimization.** Setiap komponen harus smooth — gunakan Framer Motion
   untuk transisi, skeleton loading untuk fetch state, dan haptic feedback di mobile.

---

## CI/CD — GitHub Actions

Struktur `.github/workflows/`:

```
.github/
└── workflows/
    ├── frontend.yml     # lint + typecheck setiap push ke main/PR
    └── backend.yml      # pytest + deploy ke Railway setiap push ke main
```

**Frontend pipeline** (`frontend.yml`):
- Trigger: push ke `main`, semua PR
- Steps: install deps → `tsc --noEmit` → ESLint → auto deploy ke Vercel (via Vercel GitHub integration)

**Backend pipeline** (`backend.yml`):
- Trigger: push ke `main`
- Steps: install deps → `pytest` → build Docker image → deploy ke Railway

Vercel deploy otomatis via GitHub integration — tidak perlu workflow manual.
Railway deploy via `Dockerfile` yang sudah ada di root backend.

---

## Language

- UI text + error messages: **Bahasa Indonesia**.
- Code (variables, comments, functions): English.

---

## Build Order — do not skip ahead

- [ ] 1. `lib/mock-data.ts` — semua mock data (3 SPPG × 3 sekolah)
- [ ] 2. `types/` — semua TypeScript interfaces
- [ ] 3. Root public page (leaderboard + SPPG list)
- [ ] 4. SPPG profile page
- [ ] 5. `CameraCapture` component + handle izin kamera (idle/denied/active)
- [ ] 6. Student feedback form
- [ ] 7. SPPG login page
- [ ] 8. SPPG operator dashboard + menu upload harian
- [ ] 9. Delivery QR scan flow → camera unlock
- [ ] 10. Wire real API (replace mock data)
- [ ] 11. Setup GitHub Actions CI/CD

Mark each step complete before moving on.

---

## Known Issues & Notes

- ⚠️ **Izin kamera kadang nyala kadang tidak** — wajib handle `permissions.query`
  sebelum `getUserMedia`. Lihat constraint #2 di atas.
- ⚠️ **Delivery harus scan QR dulu** sebelum kamera aktif. Jangan skip flow ini.
- ⚠️ **Menu di-upload per hari** — bukan input mingguan sekaligus.

---

## What NOT to Build (Prototype Exclusions)

Real auth system · QR generation client-side · subdomain middleware · push notifications ·
PDF export · multi-language toggle · admin panel beyond operator view.
