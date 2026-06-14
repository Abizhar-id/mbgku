-- ════════════════════════════════════════════════════════════════
--  MBG Transparency Platform — Schema v2 (PROTOTYPE)
--  Cara pakai: Supabase Dashboard → SQL Editor → New query →
--              paste semua ini → Run.
--
--  Catatan: backend pakai service_role key (bypass RLS), jadi RLS
--  dibiarkan OFF untuk prototype. JANGAN dipakai apa adanya di produksi.
--
--  Perubahan v2:
--   - qr_token: jadi STATIS per sekolah (drop expires_at & used,
--     school_id wajib, 1 token unik per sppg+sekolah+kind)
--   - tambah kitchen_process: tahap Persiapan & Masak (per SPPG/hari)
-- ════════════════════════════════════════════════════════════════

-- Drop dulu biar bisa di-run ulang dari nol (urut: anak → induk)
drop table if exists ai_recap        cascade;
drop table if exists feedback        cascade;
drop table if exists kitchen_process cascade;
drop table if exists menu            cascade;
drop table if exists delivery        cascade;
drop table if exists qr_token        cascade;
drop table if exists operator        cascade;
drop table if exists school          cascade;
drop table if exists sppg            cascade;
drop table if exists admin           cascade;

-- ── SPPG ──────────────────────────────────────────────────────────
create table sppg (
    id          bigserial primary key,
    name        text not null,
    address     text,
    created_at  timestamptz not null default now()
);

-- ── Sekolah (tiap SPPG punya beberapa sekolah) ────────────────────
create table school (
    id          bigserial primary key,
    sppg_id     bigint not null references sppg(id) on delete cascade,
    name        text not null
);

-- ── Operator SPPG (login dashboard) ───────────────────────────────
--  Kolom `password` BERISI HASH BCRYPT (nama kolom dipertahankan agar tanpa
--  migrasi). Seed lewat `python seed.py` / `python setup_prototype_accounts.py`.
create table operator (
    id          bigserial primary key,
    sppg_id     bigint not null references sppg(id) on delete cascade,
    username    text not null unique,
    password    text not null   -- bcrypt hash (BUKAN plaintext)
);

-- ── Pengiriman / tahap "Pengiriman" (per sekolah, butuh scan QR) ──
create table delivery (
    id            bigserial primary key,
    sppg_id       bigint not null references sppg(id) on delete cascade,
    school_id     bigint not null references school(id) on delete cascade,
    delivery_date date   not null,
    sent_at       timestamptz,
    arrived_at    timestamptz,
    status        text   not null default 'pending',  -- pending | delivered | late
    photo_url     text                                  -- bukti foto pengiriman per sekolah
);
-- Migration (jika tabel delivery sudah terlanjur dibuat TANPA kolom photo_url):
--   alter table delivery add column if not exists photo_url text;

-- ── Proses dapur: tahap "Persiapan" & "Masak" (per SPPG/hari) ─────
create table kitchen_process (
    id           bigserial primary key,
    sppg_id      bigint not null references sppg(id) on delete cascade,
    process_date date   not null,
    stage        text   not null,                -- persiapan | masak
    photo_url    text,
    created_at   timestamptz not null default now(),
    unique (sppg_id, process_date, stage)
);

-- ── Menu harian ───────────────────────────────────────────────────
create table menu (
    id          bigserial primary key,
    sppg_id     bigint not null references sppg(id) on delete cascade,
    menu_date   date   not null,
    description text   not null,
    photo_url   text
);

-- ── Feedback siswa (TANPA foto: rating + komentar + sekolah) ──────
create table feedback (
    id          bigserial primary key,
    sppg_id     bigint not null references sppg(id) on delete cascade,
    school_id   bigint not null references school(id) on delete cascade,
    rating      int    not null check (rating between 1 and 5),
    comment     text,
    created_at  timestamptz not null default now()
);

-- ── Admin platform (kelola QR semua sekolah) ─────────────────────
--  password_hash = bcrypt. Seed akun awal lewat `python seed_admin.py`.
create table admin (
    id            bigserial primary key,
    username      text not null unique,
    password_hash text not null,
    created_at    timestamptz not null default now()
);

-- ── QR STATIS (2 per sekolah: delivery + feedback) ───────────────
--  CATATAN: token QR (delivery & feedback) adalah SUMBER KEBENARAN di
--  tabel ini, BUKAN di kolom school. Endpoint admin "generate ulang"
--  mengganti nilai `token` pada baris terkait → QR lama langsung invalid
--  dan QR baru otomatis dikenali oleh /delivery/confirm & /feedback.
create table qr_token (
    id          bigserial primary key,
    token       text   not null unique,
    kind        text   not null,                 -- feedback | delivery
    sppg_id     bigint not null references sppg(id) on delete cascade,
    school_id   bigint not null references school(id) on delete cascade,
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    unique (sppg_id, school_id, kind)            -- 1 QR per jenis per sekolah
);

-- ── Cache rekap AI (hemat token: Qwen tidak dipanggil tiap request) ─
-- weekly  → expired jika generated_at > 24 jam lalu
-- monthly → expired jika generated_at > 7 hari lalu
create table if not exists ai_recap (
    id           bigserial primary key,
    sppg_id      int  not null references sppg(id),
    type         text not null check (type in ('weekly', 'monthly')),
    content      jsonb not null,
    period_start date not null,
    period_end   date not null,
    generated_at timestamptz not null default now()
);

-- ── Index buat query yang sering (per SPPG) ───────────────────────
create index idx_delivery_sppg on delivery(sppg_id);
create index idx_feedback_sppg on feedback(sppg_id);
create index idx_menu_sppg     on menu(sppg_id);
create index idx_kitchen_sppg  on kitchen_process(sppg_id);
create index idx_ai_recap_lookup on ai_recap(sppg_id, type, generated_at desc);