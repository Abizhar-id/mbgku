'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { SPPGProfile, ProcessTimeline } from '@/types/sppg';
import type { RekapAI } from '@/types/ai';
import type { PublicFeedback } from '@/types/feedback';
import { fetchSPPGProfile, fetchProcessTimeline } from '@/lib/api/sppg';
import { fetchAIRecap, fetchAIRecapMonthly } from '@/lib/api/ai';
import { fetchPublicFeedback } from '@/lib/api/feedback';

// ── Shared helpers ────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className="w-4 h-4" viewBox="0 0 20 20" fill={s <= Math.round(rating) ? 'var(--gold)' : 'var(--border)'}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      className="rounded-2xl p-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{title}</h2>
      {children}
    </motion.div>
  );
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

  return (
    <motion.div
      className="mx-auto px-4 py-6 flex flex-col gap-4"
      style={{ maxWidth: '520px' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 mb-1 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Kembali
      </button>

      {/* Hero card */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--navy)' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--pastel-blue)' }}>
              Rank #{profile.rank}
            </p>
            <h1 className="font-bold text-white mb-1" style={{ fontSize: '18px' }}>{profile.name}</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{profile.address}</p>
          </div>
          <div className="text-right">
            <StarRating rating={profile.avg_rating} />
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {profile.total_feedback} ulasan
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <div className="flex-1 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Ketepatan Kirim</p>
            <p className="font-bold text-white" style={{ fontSize: '18px' }}>{profile.delivery_rate}%</p>
          </div>
          <div className="flex-1 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Total Ulasan</p>
            <p className="font-bold text-white" style={{ fontSize: '18px' }}>{profile.total_feedback}</p>
          </div>
        </div>
      </div>

      {/* Proses hari ini */}
      <SectionCard title="Proses Hari Ini">
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
                    <button type="button" onClick={() => setLightbox(s.photo_url!)} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.photo_url} alt={`Foto ${stage}`}
                        className="w-full h-36 object-cover rounded-xl" />
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
                    <button type="button" onClick={() => setLightbox(d.photo_url!)} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.photo_url} alt={`Bukti pengiriman ${d.school_name}`}
                        className="w-full max-h-48 object-cover rounded-xl" />
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
      <SectionCard title="Menu Hari Ini">
        {todayMenu ? (
          <div className="flex items-start gap-3">
            {todayMenu.photo_url ? (
              <button type="button" onClick={() => setLightbox(todayMenu.photo_url!)} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={todayMenu.photo_url} alt="Menu hari ini"
                  className="w-16 h-16 object-cover rounded-xl" />
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
      <SectionCard title="Rekap AI">
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={() => setAiTab('weekly')}
            className="pill px-3 py-1.5 text-xs" data-active={aiTab === 'weekly'}
            style={{
              backgroundColor: aiTab === 'weekly' ? 'var(--navy)' : 'var(--bg-surface)',
              color: aiTab === 'weekly' ? '#fff' : 'var(--text-secondary)',
            }}>
            Mingguan
          </button>
          <button type="button" onClick={openMonthly}
            className="pill px-3 py-1.5 text-xs"
            style={{
              backgroundColor: aiTab === 'monthly' ? 'var(--navy)' : 'var(--bg-surface)',
              color: aiTab === 'monthly' ? '#fff' : 'var(--text-secondary)',
            }}>
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
      <SectionCard title="Ulasan Penerima">
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

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </motion.div>
  );
}
