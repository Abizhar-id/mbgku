-- ════════════════════════════════════════════════════════════════
--  MBG — Aktifkan Row Level Security (RLS)
--
--  ⚠️  JALANKAN MANUAL di Supabase Dashboard → SQL Editor SEBELUM DEPLOY.
--      File ini TIDAK dijalankan otomatis oleh backend.
--
--  Model akses MBG:
--   - SEMUA akses data dari BACKEND memakai SUPABASE_SERVICE_KEY (service_role).
--     service_role MEM-BYPASS RLS sepenuhnya → mengaktifkan RLS TIDAK memutus
--     fungsi backend mana pun (leaderboard, feedback publik, menu, dll tetap jalan).
--   - Tujuan RLS di sini = pertahanan berlapis: bila anon/public key bocor atau
--     dipakai dari mana pun selain backend, tabel sensitif TIDAK bisa dibaca/ditulis
--     tanpa policy eksplisit.
--
--  Setelah ENABLE RLS tanpa policy apa pun, tabel tertutup untuk role anon/auth
--  (hanya service_role yang tembus). Kita BUKA SELECT publik hanya untuk data
--  yang memang publik (sppg, school) supaya tetap aman walau diakses anon key.
-- ════════════════════════════════════════════════════════════════

-- ── Aktifkan RLS pada tabel sensitif (default: tertutup untuk anon) ──
alter table operator        enable row level security;
alter table menu            enable row level security;
alter table kitchen_process enable row level security;
alter table delivery        enable row level security;
alter table feedback        enable row level security;
alter table ai_recap        enable row level security;
alter table qr_token        enable row level security;
alter table admin           enable row level security;

-- ── Tabel master publik: boleh dibaca siapa saja (read-only) ────────
--  Aman dibuka karena memang tampil di halaman publik. Tulis tetap tertutup
--  (hanya backend service_role yang bisa insert/update/delete).
alter table sppg   enable row level security;
alter table school enable row level security;

-- Drop dulu agar idempotent (bisa di-run ulang)
drop policy if exists "public_read_sppg"   on sppg;
drop policy if exists "public_read_school" on school;

create policy "public_read_sppg"   on sppg   for select using (true);
create policy "public_read_school" on school for select using (true);

-- ── CATATAN PENTING ─────────────────────────────────────────────────
--  - Tidak perlu policy tambahan untuk tabel lain: backend pakai service_role
--    (bypass RLS), jadi semua endpoint tetap berfungsi.
--  - JANGAN pernah memakai anon/public key di backend — lihat core/database.py.
--  - Jalankan file ini DI SUPABASE SQL EDITOR sebelum aplikasi go-live.
--  - Verifikasi: Dashboard → Database → tiap tabel harus berstatus "RLS enabled".
