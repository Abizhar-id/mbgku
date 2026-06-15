'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import type { SPPGProfile, ProcessTimeline } from '@/types/sppg';
import type { RekapAI } from '@/types/ai';
import type { PublicFeedback } from '@/types/feedback';
import { fetchSPPGProfile, fetchProcessTimeline } from '@/lib/api/sppg';
import { fetchAIRecap, fetchAIRecapMonthly } from '@/lib/api/ai';
import { fetchPublicFeedback } from '@/lib/api/feedback';

// ── Shared helpers ────────────────────────────────────────────────

function StarRating({ rating, size = 'w-4 h-4', light = false }: { rating: number; size?: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={size} viewBox="0 0 20 20"
          fill={s <= Math.round(rating) ? 'var(--gold)' : (light ? 'rgba(255,255,255,0.25)' : 'var(--border)')}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-sm font-semibold" style={{ color: light ? '#FFFFFF' : 'var(--text-primary)' }}>
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    delivered: { bg: 'var(--status-delivered-bg)', text: 'var(--status-delivered-text)', label: 'Terkirim' },
    late:      { bg: 'var(--status-late-bg)',      text: 'var(--status-late-text)',      label: 'Terlambat' },
    pending:   { bg: 'var(--status-pending-bg)',   text: 'var(--status-pending-text)',   label: 'Belum' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

function SectionCard({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      className="card p-5"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <h2 className="font-bold mb-4" style={{ color: 'var(--navy)', fontSize: '17px', letterSpacing: '-0.01em' }}>{title}</h2>
      {children}
    </motion.section>
  );
}

function rankBadge(rank: number) {
  if (rank === 1) return { bg: 'var(--gold)', color: '#FFFFFF', label: 'Peringkat 1' };
  if (rank === 2) return { bg: '#A8A8A8',     color: '#FFFFFF', label: 'Peringkat 2' };
  if (rank === 3) return { bg: '#CD7F32',     color: '#FFFFFF', label: `Peringkat 3` };
  return           { bg: 'rgba(255,255,255,0.16)', color: '#FFFFFF', label: `Peringkat ${rank}` };
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl ${className}`} style={{ backgroundColor: 'var(--bg-surface)' }} />;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl px-3 py-2 text-sm" role="alert"
      style={{ backgroundColor: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}>
      {msg}
    </div>
  );
}

function Empty({ msg = 'Belum ada data.' }: { msg?: string }) {
  return <p className="text-sm text-center py-2" style={{ color: 'var(--text-tertiary)' }}>{msg}</p>;
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Foto diperbesar" className="max-w-full max-h-full rounded-2xl object-contain" />
      <button type="button" onClick={onClose} aria-label="Tutup"
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ border: '1px solid rgba(255,255,255,0.4)', color: '#fff' }}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Render rekap AI (dipakai untuk tab mingguan & bulanan)
function RekapView({ rekap }: { rekap: RekapAI }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium" style={{ color: 'var(--navy)' }}>{rekap.summary}</p>
      <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Pengiriman</p>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{rekap.delivery.description}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          Ketepatan: {rekap.delivery.accuracy_pct}%
        </p>
      </div>
      <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Saran Perbaikan</p>
        <ul className="flex flex-col gap-1">
          {rekap.suggestions.map((s, i) => (
            <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--text-primary)' }}>
              <span style={{ color: 'var(--green)' }}>•</span>{s}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {rekap.cached ? `Diperbarui: ${formatDate(rekap.generated_at)}` : 'Baru diperbarui'}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function SPPGProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const sppgId  = Number(id);

  const [profile,  setProfile]  = useState<SPPGProfile | null>(null);
  const [process,  setProcess]  = useState<ProcessTimeline | null>(null);
  const [loading,  setLoading]  = useState(true);

  const [lightbox, setLightbox] = useState<string | null>(null);

  // Rekap AI — tab + loading/error per tab
  const [aiTab,       setAiTab]       = useState<'weekly' | 'monthly'>('weekly');
  const [weekly,      setWeekly]      = useState<RekapAI | null>(null);
  const [weeklyState, setWeeklyState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [monthly,      setMonthly]      = useState<RekapAI | null>(null);
  const [monthlyState, setMonthlyState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  // Ulasan publik
  const [reviews,      setReviews]      = useState<PublicFeedback[]>([]);
  const [reviewsState, setReviewsState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    if (!sppgId) return;
    Promise.all([
      fetchSPPGProfile(sppgId),
      fetchProcessTimeline(sppgId),
    ])
      .then(([p, proc]) => { setProfile(p); setProcess(proc); })
      .catch(() => router.replace('/'))
      .finally(() => setLoading(false));

    // Rekap mingguan dimuat eager (lambat → terpisah)
    fetchAIRecap(sppgId)
      .then((r) => { setWeekly(r); setWeeklyState('ok'); })
      .catch(() => setWeeklyState('error'));

    // Ulasan publik
    fetchPublicFeedback(sppgId)
      .then((r) => { setReviews(r); setReviewsState('ok'); })
      .catch(() => setReviewsState('error'));
  }, [sppgId, router]);

  // Tab bulanan dimuat lazy saat pertama dibuka
  const openMonthly = useCallback(() => {
    setAiTab('monthly');
    if (monthlyState !== 'idle') return;
    setMonthlyState('loading');
    fetchAIRecapMonthly(sppgId)
      .then((r) => { setMonthly(r); setMonthlyState('ok'); })
      .catch(() => setMonthlyState('error'));
  }, [sppgId, monthlyState]);

  if (loading) {
    return (
      <div className="mx-auto px-4 py-6 flex flex-col gap-4" style={{ maxWidth: '520px' }}>
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!profile) return null;

  const todayMenu = profile.today_menu;

  const rb = rankBadge(profile.rank);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {/* ── Hero gradient ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-navy">
        <div className="mx-auto px-4 pt-24 pb-8 lg:px-8" style={{ maxWidth: '640px' }}>
          <button
            onClick={() => router.back()}
            className="link-arrow flex items-center gap-1 mb-5 text-sm"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Kembali
          </button>

          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold mb-3"
            style={{ backgroundColor: rb.bg, color: rb.color }}>
            {rb.label}
          </span>
          <h1 className="font-bold text-white leading-tight" style={{ fontSize: 'clamp(22px, 4vw, 32px)', letterSpacing: '-0.02em' }}>
            {profile.name}
          </h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.65)' }}>{profile.address}</p>
        </div>
      </section>

      {/* ── Konten ────────────────────────────────────────────────────────── */}
      <div className="mx-auto px-4 py-6 flex flex-col gap-4 lg:px-8" style={{ maxWidth: '640px' }}>

        {/* Stats bar — 3 kolom (Rating · Ketepatan · Ulasan), sejajar & proporsional di mobile */}
        <motion.div className="grid grid-cols-3"
          style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* Rating — bintang + angka berdampingan, label di bawah */}
          <div className="card flex flex-col items-center text-center"
            style={{ justifyContent: 'space-between', flex: 1, minWidth: 0, padding: '12px 8px', gap: '6px' }}>
            {/* Area nilai utama — tinggi fixed 40px agar label sejajar antar card */}
            <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="flex items-center" style={{ gap: '3px', flexWrap: 'nowrap' }}>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg key={s} className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" viewBox="0 0 20 20"
                      fill={s <= Math.round(profile.avg_rating) ? 'var(--gold)' : 'var(--border)'}>
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="font-bold text-[13px] sm:text-[16px]" style={{ color: 'var(--text-primary)' }}>
                  {profile.avg_rating.toFixed(1)}
                </span>
              </div>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>Rating</p>
          </div>
          {/* Ketepatan */}
          <div className="card flex flex-col items-center text-center"
            style={{ justifyContent: 'space-between', flex: 1, minWidth: 0, padding: '12px 8px', gap: '6px' }}>
            <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p className="font-bold text-[18px] sm:text-[22px]" style={{ color: 'var(--navy)', margin: 0 }}>{profile.delivery_rate}%</p>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>Ketepatan</p>
          </div>
          {/* Ulasan */}
          <div className="card flex flex-col items-center text-center"
            style={{ justifyContent: 'space-between', flex: 1, minWidth: 0, padding: '12px 8px', gap: '6px' }}>
            <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p className="font-bold text-[18px] sm:text-[22px]" style={{ color: 'var(--navy)', margin: 0 }}>{profile.total_feedback}</p>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>Ulasan</p>
          </div>
        </motion.div>

      {/* Proses hari ini */}
      <SectionCard title="Proses Hari Ini" delay={0.05}>
        {process ? (
          <div className="flex flex-col gap-3">
            {(['persiapan', 'masak'] as const).map((stage) => {
              const s = process[stage];
              return (
                <div key={stage} className="flex flex-col gap-2 pb-3"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm capitalize" style={{ color: 'var(--text-primary)' }}>{stage}</span>
                    <StatusChip status={s.done ? 'delivered' : 'pending'} />
                  </div>
                  {s.photo_url && (
                    <button type="button" onClick={() => setLightbox(s.photo_url!)} className="block w-full">
                      <div className="photo-zoom relative w-full h-36 rounded-xl overflow-hidden">
                        <Image src={s.photo_url} alt={`Foto ${stage}`} fill
                          sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
            <p className="text-xs mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>Pengiriman per Sekolah</p>
            <div className="flex flex-col gap-2">
              {process.pengiriman.map((d) => (
                <motion.div
                  key={d.school_id}
                  className="rounded-2xl p-4 flex flex-col gap-3"
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{d.school_name}</span>
                    {d.done ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--status-delivered-bg)', color: 'var(--status-delivered-text)' }}>
                        Terkirim ✓
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending-text)' }}>
                        Menunggu konfirmasi
                      </span>
                    )}
                  </div>
                  {d.done && d.photo_url && (
                    <button type="button" onClick={() => setLightbox(d.photo_url!)} className="block w-full">
                      <div className="photo-zoom relative w-full h-48 rounded-xl overflow-hidden">
                        <Image src={d.photo_url} alt={`Bukti pengiriman ${d.school_name}`} fill
                          sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
                      </div>
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <Empty msg="Belum ada data hari ini." />
        )}
      </SectionCard>

      {/* Menu hari ini */}
      <SectionCard title="Menu Hari Ini" delay={0.1}>
        {todayMenu ? (
          <div className="flex items-start gap-3">
            {todayMenu.photo_url ? (
              <button type="button" onClick={() => setLightbox(todayMenu.photo_url!)} className="shrink-0">
                <div className="photo-zoom relative w-20 h-20 rounded-xl overflow-hidden">
                  <Image src={todayMenu.photo_url} alt="Menu hari ini" fill sizes="80px" className="object-cover" />
                </div>
              </button>
            ) : (
              <div className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-surface)' }}>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatDate(todayMenu.menu_date)}</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{todayMenu.description}</p>
            </div>
          </div>
        ) : (
          <Empty msg="Belum ada menu hari ini." />
        )}
      </SectionCard>

      {/* Rekap AI — tab mingguan / bulanan */}
      <SectionCard title="Rekap AI" delay={0.15}>
        <div className="flex gap-5 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <button type="button" onClick={() => setAiTab('weekly')}
            className={`tab-underline pb-2.5 text-sm ${aiTab === 'weekly' ? 'active' : ''}`}>
            Mingguan
          </button>
          <button type="button" onClick={openMonthly}
            className={`tab-underline pb-2.5 text-sm ${aiTab === 'monthly' ? 'active' : ''}`}>
            Bulanan
          </button>
        </div>

        {aiTab === 'weekly' ? (
          weeklyState === 'loading' ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : weeklyState === 'error' ? (
            <ErrorBox msg="Gagal memuat rekap mingguan. Coba muat ulang halaman." />
          ) : weekly ? (
            <RekapView rekap={weekly} />
          ) : (
            <Empty msg="Rekap AI belum tersedia." />
          )
        ) : (
          monthlyState === 'loading' || monthlyState === 'idle' ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : monthlyState === 'error' ? (
            <ErrorBox msg="Gagal memuat rekap bulanan. Coba muat ulang halaman." />
          ) : monthly ? (
            <RekapView rekap={monthly} />
          ) : (
            <Empty msg="Rekap AI belum tersedia." />
          )
        )}
      </SectionCard>

      {/* Ulasan penerima */}
      <SectionCard title="Ulasan Penerima" delay={0.2}>
        {reviewsState === 'loading' ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : reviewsState === 'error' ? (
          <ErrorBox msg="Gagal memuat ulasan." />
        ) : reviews.length > 0 ? (
          <div className="flex flex-col gap-3">
            {reviews.map((r, i) => (
              <div key={i} className="flex flex-col gap-1 pb-3"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <StarRating rating={r.rating} />
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatDate(r.created_at)}</span>
                </div>
                {r.comment && (
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{r.comment}</p>
                )}
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{r.school_name}</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </SectionCard>

      </div>

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </motion.div>
  );
}
