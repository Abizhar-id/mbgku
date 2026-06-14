-- ════════════════════════════════════════════════════════════════
--  MBG — Perbaikan RLS & Index (dari temuan Supabase Advisor)
--
--  ⚠️  FILE INI TIDAK DIJALANKAN OTOMATIS oleh backend.
--      Jalankan MANUAL: Supabase Dashboard → SQL Editor → New query →
--      paste semua isi file → Run. Aman di-run ulang (idempotent).
--
--  Konteks akses MBG:
--   - Backend mengakses DB memakai SUPABASE_SERVICE_KEY (service_role) yang
--     MEM-BYPASS RLS sepenuhnya. Untuk prototype, RLS dimatikan total supaya
--     tidak ada policy menyesatkan (sejalan dgn catatan di schema.sql).
--   - Keputusan ini MENGGANTI rls.sql untuk fase prototype. Bila nanti go-live
--     dan butuh pertahanan berlapis terhadap kebocoran anon key, aktifkan ulang
--     RLS via rls.sql + policy eksplisit (jangan andalkan file ini).
--
--  Temuan Advisor yang diperbaiki:
--   1. RLS "Policy Always True" di hampir semua tabel → proteksi tanpa makna.
--   2. ai_recap: "RLS Enabled, No Policy" → tertutup untuk role non-service.
--   3. Unindexed Foreign Keys: delivery, feedback, operator, qr_token, school.
--   4. Unused Index di kitchen_process (idx_kitchen_sppg — duplikat composite).
-- ════════════════════════════════════════════════════════════════


-- ── (1) Drop SEMUA policy pada tabel-tabel MBG ───────────────────
--  Mencakup policy "Always True" yang mungkin dibuat lewat Dashboard dengan
--  nama bebas. DO block menelusuri pg_policies dan men-drop tiap policy yang
--  masih menempel, jadi tidak perlu tahu nama persisnya.
do $$
declare
    r record;
begin
    for r in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in (
              'admin', 'delivery', 'feedback', 'kitchen_process', 'menu',
              'operator', 'qr_token', 'school', 'sppg', 'ai_recap'
          )
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            r.policyname, r.schemaname, r.tablename
        );
    end loop;
end $$;

-- Drop eksplisit policy bernama yang dibuat rls.sql (jaga-jaga, idempotent).
drop policy if exists "public_read_sppg"   on sppg;
drop policy if exists "public_read_school" on school;


-- ── (2) Matikan RLS di semua tabel (backend pakai service_role) ──
--  Tanpa RLS, status "Always True / No Policy" hilang seluruhnya dan tidak ada
--  lagi ambiguitas akses. Backend tetap berfungsi penuh (service_role).
alter table admin           disable row level security;
alter table delivery        disable row level security;
alter table feedback        disable row level security;
alter table kitchen_process disable row level security;
alter table menu            disable row level security;
alter table operator        disable row level security;
alter table qr_token        disable row level security;
alter table school          disable row level security;
alter table sppg            disable row level security;
alter table ai_recap        disable row level security;


-- ── (3) Index untuk Foreign Key yang belum terindex ─────────────
--  Hanya FK yang benar-benar "telanjang" yang ditambah. FK yang sudah menjadi
--  kolom PALING KIRI pada composite index TIDAK perlu (Postgres memakai prefix):
--    - qr_token.sppg_id        → tercakup unique(sppg_id, school_id, kind)
--    - kitchen_process.sppg_id → tercakup unique(sppg_id, process_date, stage)
--  delivery.sppg_id & feedback.sppg_id sudah punya index dari schema.sql.
create index if not exists idx_delivery_school on delivery(school_id);
create index if not exists idx_feedback_school on feedback(school_id);
create index if not exists idx_operator_sppg   on operator(sppg_id);
create index if not exists idx_qr_token_school on qr_token(school_id);
create index if not exists idx_school_sppg     on school(sppg_id);


-- ── (4) Drop unused index di kitchen_process ────────────────────
--  idx_kitchen_sppg(sppg_id) duplikat dengan composite unique
--  (sppg_id, process_date, stage). sppg_id tetap terindex sebagai kolom kiri,
--  jadi aman di-drop tanpa membuat FK kitchen_process.sppg_id jadi unindexed.
drop index if exists idx_kitchen_sppg;


-- ── Verifikasi (opsional — jalankan terpisah setelah Run di atas) ─
--  a) Pastikan RLS OFF di semua tabel (relrowsecurity harus false):
--       select relname, relrowsecurity
--       from pg_class
--       where relkind = 'r'
--         and relname in ('admin','delivery','feedback','kitchen_process','menu',
--                         'operator','qr_token','school','sppg','ai_recap');
--
--  b) Pastikan tidak ada policy tersisa (harus 0 baris):
--       select tablename, policyname from pg_policies where schemaname = 'public';
--
--  c) Pastikan index FK baru ada:
--       select indexname, tablename from pg_indexes
--       where schemaname = 'public'
--         and indexname in ('idx_delivery_school','idx_feedback_school',
--                           'idx_operator_sppg','idx_qr_token_school','idx_school_sppg');
