-- ════════════════════════════════════════════════════════════════
--  MBG Transparency Platform — Schema (PROTOTYPE)
--  Cara pakai: Supabase Dashboard → SQL Editor → New query →
--              paste semua ini → Run.
--
--  Catatan: backend pakai service_role key (bypass RLS), jadi RLS
--  dibiarkan OFF untuk prototype. JANGAN dipakai apa adanya di produksi.
-- ════════════════════════════════════════════════════════════════

-- Drop dulu biar bisa di-run ulang dari nol (urut: anak → induk)
drop table if exists feedback  cascade;
drop table if exists menu      cascade;
drop table if exists delivery  cascade;
drop table if exists qr_token  cascade;
drop table if exists operator  cascade;
drop table if exists school    cascade;
drop table if exists sppg      cascade;

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
create table operator (
    id          bigserial primary key,
    sppg_id     bigint not null references sppg(id) on delete cascade,
    username    text not null unique,
    password    text not null   -- PLAINTEXT: prototype only, ganti sebelum produksi
);

-- ── Pengiriman (bukti progress) ───────────────────────────────────
create table delivery (
    id            bigserial primary key,
    sppg_id       bigint not null references sppg(id) on delete cascade,
    school_id     bigint not null references school(id) on delete cascade,
    delivery_date date   not null,
    sent_at       timestamptz,
    arrived_at    timestamptz,
    status        text   not null default 'pending',  -- pending | delivered | late
    photo_url     text
);

-- ── Menu harian ───────────────────────────────────────────────────
create table menu (
    id          bigserial primary key,
    sppg_id     bigint not null references sppg(id) on delete cascade,
    menu_date   date   not null,
    description text   not null,
    photo_url   text
);

-- ── Feedback siswa ────────────────────────────────────────────────
create table feedback (
    id          bigserial primary key,
    sppg_id     bigint not null references sppg(id) on delete cascade,
    school_id   bigint not null references school(id) on delete cascade,
    rating      int    not null check (rating between 1 and 5),
    comment     text,
    photo_url   text,
    created_at  timestamptz not null default now()
);

-- ── QR token (feedback siswa & konfirmasi delivery) ───────────────
create table qr_token (
    id          bigserial primary key,
    token       text   not null unique,
    kind        text   not null,                 -- feedback | delivery
    sppg_id     bigint not null references sppg(id) on delete cascade,
    school_id   bigint references school(id) on delete cascade,
    expires_at  timestamptz,
    used        boolean not null default false
);

-- ── Index buat query yang sering (per SPPG) ───────────────────────
create index idx_delivery_sppg on delivery(sppg_id);
create index idx_feedback_sppg on feedback(sppg_id);
create index idx_menu_sppg     on menu(sppg_id);
