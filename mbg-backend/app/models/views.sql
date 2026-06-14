-- ════════════════════════════════════════════════════════════════
--  MBG — Database View untuk kalkulasi leaderboard (OPSIONAL)
--
--  -- Opsi jangka panjang: jalankan ini di Supabase untuk performa lebih baik
--
--  Saat ini leaderboard dihitung di Python (api/sppg.py) dengan cache in-memory
--  60 dtk + filter 30 hari. Untuk data yang jauh lebih besar, pindahkan agregasi
--  ke DB lewat view di bawah agar PostgreSQL yang menghitung (index-friendly),
--  lalu backend cukup `select * from sppg_leaderboard`.
--
--  File ini TIDAK dijalankan otomatis — jalankan manual bila diperlukan.
-- ════════════════════════════════════════════════════════════════

-- Statistik per SPPG (30 hari terakhir). 'tepat' = arrived-sent <= 30 menit,
-- konsisten dengan _is_tepat() di api/sppg.py.
create or replace view sppg_stats_30d as
with deliv as (
    select
        sppg_id,
        count(*)                                                          as total_delivery,
        count(*) filter (
            where sent_at is not null and arrived_at is not null
              and arrived_at - sent_at <= interval '30 minutes'
        )                                                                  as tepat
    from delivery
    where delivery_date >= (current_date - interval '30 days')
    group by sppg_id
),
fb as (
    select
        sppg_id,
        round(avg(rating)::numeric, 2) as avg_rating,
        count(*)                       as total_feedback
    from feedback
    where created_at >= (now() - interval '30 days')
    group by sppg_id
)
select
    s.id,
    s.name,
    s.address,
    coalesce(fb.avg_rating, 0)                                            as avg_rating,
    coalesce(fb.total_feedback, 0)                                       as total_feedback,
    coalesce(round(deliv.tepat::numeric / nullif(deliv.total_delivery, 0) * 100, 1), 0) as delivery_rate
from sppg s
left join deliv on deliv.sppg_id = s.id
left join fb    on fb.sppg_id    = s.id;

-- Leaderboard final (urut: delivery_rate, lalu avg_rating). Rank dihitung di DB.
create or replace view sppg_leaderboard as
select
    *,
    row_number() over (order by delivery_rate desc, avg_rating desc) as rank
from sppg_stats_30d;

-- Index pendukung (jalankan sekali bila belum ada):
--   create index if not exists idx_delivery_date on delivery(delivery_date);
--   create index if not exists idx_feedback_created on feedback(created_at);
