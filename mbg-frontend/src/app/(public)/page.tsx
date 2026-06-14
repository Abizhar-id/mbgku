'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SPPG } from '@/types/sppg';
import { fetchSPPGList } from '@/lib/api/sppg';
import PodiumRow from '@/components/features/leaderboard/PodiumRow';
import SearchBar from '@/components/features/leaderboard/SearchBar';
import FilterPills, { type FilterOption } from '@/components/features/leaderboard/FilterPills';
import SPPGCard from '@/components/features/leaderboard/SPPGCard';

// ── YouTube IFrame API typing ─────────────────────────────────────────────────
type YTPlayer = { playVideo: () => void; pauseVideo: () => void; destroy: () => void };
type YTPlayerCtor = new (el: string, opts: Record<string, unknown>) => YTPlayer;

declare global {
  interface Window {
    YT?: { Player: YTPlayerCtor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const HERO_VIDEO_ID = 'p2eNE-qevXM';

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl ${className}`} style={{ backgroundColor: 'var(--bg-surface)' }} />;
}

// ── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Apa fungsi utama website MBG-ku ini?',
    a: 'Website ini digunakan untuk memantau proses distribusi MBG secara transparan, mulai dari data SPPG, status persiapan makanan, proses pengiriman, hingga informasi penerimaan di sekolah tujuan.',
  },
  {
    q: 'Siapa saja yang dapat mengakses informasi pada website ini?',
    a: 'Informasi umum dapat diakses oleh publik, seperti daftar SPPG, status distribusi, dan ringkasan monitoring. Namun, fitur pengelolaan data hanya dapat diakses oleh akun SPPG atau admin yang memiliki hak login.',
  },
  {
    q: 'Apa arti status Persiapan, Masak, dan Pengantaran?',
    a: 'Status Persiapan berarti bahan atau data distribusi sedang disiapkan. Status Masak berarti makanan sedang diproses oleh SPPG. Status Pengantaran berarti makanan sedang dikirim menuju sekolah penerima.',
  },
  {
    q: 'Apakah data distribusi MBG diperbarui secara real-time?',
    a: 'Data dapat diperbarui secara berkala oleh pihak SPPG melalui sistem. Jika sistem mendukung update langsung, perubahan status distribusi akan tampil secara real-time atau mendekati real-time pada dashboard publik.',
  },
  {
    q: 'Apa fungsi AI Recap pada website ini?',
    a: 'AI Recap berfungsi untuk membuat ringkasan mingguan atau bulanan berdasarkan data distribusi, seperti jumlah pengiriman, status layanan, kendala, keluhan, dan rekomendasi perbaikan agar proses monitoring lebih mudah dianalisis.',
  },
];

const faqItemVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function FAQItem({ item, open, onToggle }: { item: { q: string; a: string }; open: boolean; onToggle: () => void }) {
  return (
    <motion.div
      variants={faqItemVariants}
      className="rounded-xl mb-2 overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-surface)]"
      >
        {/* Icon ? di kiri */}
        <span className="shrink-0 text-base font-bold" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true">?</span>
        <span className="flex-1 text-sm" style={{ color: open ? 'var(--navy)' : 'var(--text-primary)', fontWeight: 500 }}>
          {item.q}
        </span>
        {/* Chevron kanan → rotate 90° saat terbuka */}
        <svg
          className="w-4 h-4 shrink-0"
          style={{ color: 'var(--text-tertiary)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <p className="px-5 pb-4" style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Timeline (Tahapan Distribusi) ────────────────────────────────────────────

function ClipboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c.5 3-2 4.5-2 7a2 2 0 0 0 4 0c0-.7-.2-1.3-.5-1.8C15.5 9.5 17 11.7 17 14a5 5 0 0 1-10 0c0-3.5 3-5.5 5-11Z" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9H3V7Zm11 3h3.5a1 1 0 0 1 .8.4l2.5 3.3a1 1 0 0 1 .2.6V16h-7v-6Z" />
      <circle cx="7" cy="18" r="1.6" stroke="currentColor" strokeWidth={1.8} />
      <circle cx="17.5" cy="18" r="1.6" stroke="currentColor" strokeWidth={1.8} />
    </svg>
  );
}

const TIMELINE_STEPS: { n: number; title: string; desc: string; icon: React.ReactNode }[] = [
  {
    n: 1,
    title: 'Persiapan',
    desc: 'Pihak SPPG menyiapkan data distribusi, jumlah porsi makanan, sekolah tujuan, serta kebutuhan operasional sebelum proses produksi makanan dimulai.',
    icon: <ClipboardIcon />,
  },
  {
    n: 2,
    title: 'Masak',
    desc: 'Makanan diproses oleh SPPG sesuai jumlah kebutuhan dan standar distribusi yang telah ditentukan untuk setiap sekolah penerima.',
    icon: <FlameIcon />,
  },
  {
    n: 3,
    title: 'Konfirmasi Pengiriman',
    desc: 'SPPG melakukan konfirmasi bahwa makanan telah siap dikirim atau sedang dalam proses pengantaran menuju sekolah tujuan.',
    icon: <TruckIcon />,
  },
];

const stepVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function TimelineSection() {
  return (
    <section className="px-6 py-16" style={{ backgroundColor: 'var(--bg-card)' }}>
      <motion.div
        className="max-w-5xl mx-auto"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Label kecil + garis */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.2em' }}>
            Timeline
          </span>
          <span className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        <h2 className="font-bold mb-10" style={{ color: 'var(--navy)', fontSize: '24px', letterSpacing: '-0.01em' }}>
          Tahapan Distribusi MBG
        </h2>

        {/* Grid 3 kolom desktop / 1 kolom mobile */}
        <motion.div
          className="relative grid grid-cols-1 gap-6 md:grid-cols-3"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Garis penghubung horizontal (desktop), di belakang circle */}
          <span
            className="hidden md:block absolute h-px z-0"
            style={{ top: '24px', left: '16.67%', right: '16.67%', backgroundColor: 'var(--border)' }}
            aria-hidden="true"
          />

          {TIMELINE_STEPS.map((step) => (
            <motion.div key={step.n} variants={stepVariants} className="relative z-10 flex flex-col items-center text-center">
              {/* Circle nomor navy */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: 'var(--navy)', fontSize: '18px', transition: 'transform 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {step.n}
              </div>
              {/* Icon di bawah nomor */}
              <div className="mt-3" style={{ color: 'var(--navy)' }} aria-hidden="true">
                {step.icon}
              </div>
              <p className="mt-2 font-semibold" style={{ color: 'var(--navy)', fontSize: '15px' }}>
                {step.title}
              </p>
              <p className="mt-1.5 mx-auto" style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, maxWidth: '200px' }}>
                {step.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}

function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="px-4 py-16" style={{ backgroundColor: 'var(--bg-surface)' }}>
      <motion.div
        className="mx-auto max-w-[760px]"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Label kecil + garis */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-semibold uppercase"
            style={{ color: 'var(--text-secondary)', letterSpacing: '0.2em' }}>
            F.A.Q
          </span>
          <span className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        <h2 className="font-bold mb-8 text-left" style={{ color: 'var(--navy)', fontSize: '24px', letterSpacing: '-0.01em' }}>
          Pertanyaan yang Sering Ditanyakan
        </h2>

        {/* Accordion list, stagger masuk */}
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {FAQ_ITEMS.map((item, i) => (
            <FAQItem
              key={i}
              item={item}
              open={openIdx === i}
              onToggle={() => setOpenIdx((prev) => (prev === i ? null : i))}
            />
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}

export default function LeaderboardPage() {
  const [sppgs,   setSPPGs]   = useState<SPPG[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<FilterOption>('semua');

  // Hero background video (YouTube IFrame API)
  const [isPlaying, setIsPlaying] = useState(true);
  const playerRef = useRef<YTPlayer | null>(null);
  const heroVideoRef = useRef<HTMLDivElement | null>(null);
  // Lazy-load video: jangan muat skrip YouTube saat render pertama (hemat LCP).
  const [loadVideo, setLoadVideo] = useState(false);

  useEffect(() => {
    fetchSPPGList()
      .then(setSPPGs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }, []);

  // Trigger lazy-load: hanya di desktop (video disembunyikan di mobile), saat hero
  // terlihat ATAU setelah 3 detik — mana yang lebih dulu. Tidak memuat skrip
  // YouTube saat render awal agar tidak menghambat LCP.
  useEffect(() => {
    if (loadVideo) return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(min-width: 768px)').matches) return; // mobile: lewati

    const trigger = () => setLoadVideo(true);
    const timer = window.setTimeout(trigger, 3000);

    let observer: IntersectionObserver | null = null;
    const el = heroVideoRef.current;
    if (el && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => { if (entries.some((e) => e.isIntersecting)) trigger(); },
        { rootMargin: '200px' },
      );
      observer.observe(el);
    }

    return () => { window.clearTimeout(timer); observer?.disconnect(); };
  }, [loadVideo]);

  // Init YouTube background player setelah loadVideo aktif. Script dimuat sekali.
  useEffect(() => {
    if (!loadVideo) return;

    const createPlayer = () => {
      if (!window.YT || playerRef.current || !document.getElementById('yt-bg')) return;
      playerRef.current = new window.YT.Player('yt-bg', {
        videoId: HERO_VIDEO_ID,
        playerVars: { autoplay: 1, mute: 1, loop: 1, controls: 0, playlist: HERO_VIDEO_ID, rel: 0, playsinline: 1 },
        events: { onReady: (e: { target: YTPlayer }) => e.target.playVideo() },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = createPlayer;
    }

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [loadVideo]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
    setIsPlaying((p) => !p);
  };

  const sorted = useMemo(() => [...sppgs].sort((a, b) => a.rank - b.rank), [sppgs]);

  const filtered = useMemo(() => {
    let r = sorted;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((s) => s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q));
    }
    if (filter === 'terbaik')         r = r.filter((s) => s.rank === 1);
    if (filter === 'perlu_perhatian') r = r.filter((s) => s.rank === sorted.length);
    return r;
  }, [sorted, search, filter]);

  const best  = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex items-center overflow-hidden bg-gradient-navy h-screen">
        {/* Video background (desktop). Mobile fallback: gradient navy.
            Poster = gradient navy section (tampil sebelum iframe dimuat → tanpa flash). */}
        <div ref={heroVideoRef} className="hidden md:block absolute inset-0 z-0" aria-hidden="true">
          <div className="yt-bg-wrap absolute inset-0 overflow-hidden">
            {loadVideo && <div id="yt-bg" />}
          </div>
          {/* Overlay gelap agar teks terbaca */}
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(7,30,73,0.45)' }} />
        </div>

        <motion.div
          className="relative z-10 w-full mx-auto px-4 lg:px-8 max-w-[520px] lg:max-w-6xl pt-20 pb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold mb-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'var(--gold)' }}>
            Portal Transparansi Publik
          </span>
          <h1 className="font-bold text-white leading-tight max-w-3xl"
            style={{ fontSize: 'clamp(28px, 5vw, 44px)', letterSpacing: '-0.02em' }}>
            Transparansi Program Makan Bergizi Gratis
          </h1>
          <p className="mt-4 max-w-2xl" style={{ color: 'rgba(255,255,255,0.72)', fontSize: '16px' }}>
            Pantau performa setiap Satuan Pelayanan Pemenuhan Gizi (SPPG) secara terbuka:
            ketepatan pengiriman, menu harian, dan penilaian langsung dari penerima manfaat.
          </p>
        </motion.div>

        {/* Tombol play/pause (desktop) */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Jeda video latar' : 'Putar video latar'}
          className="hidden md:flex absolute bottom-6 right-6 z-20 w-12 h-12 rounded-full items-center justify-center text-white"
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.4)',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.35)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Scaling iframe agar cover penuh (teknik 16:9) */}
        <style jsx global>{`
          .yt-bg-wrap #yt-bg {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 177.78vh;
            min-width: 100%;
            height: 56.25vw;
            min-height: 100%;
            transform: translate(-50%, -50%);
            border: 0;
            pointer-events: none;
          }
        `}</style>
      </section>

      {/* ── Konten ────────────────────────────────────────────────────────── */}
      <div className="mx-auto flex flex-col gap-6 px-4 py-8 max-w-[520px] lg:max-w-6xl lg:px-8 lg:py-10">
        <div>
          <h2 className="font-bold" style={{ color: 'var(--navy)', fontSize: '22px', letterSpacing: '-0.01em' }}>
            Leaderboard SPPG
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Peringkat berdasarkan ketepatan pengiriman dan penilaian penerima.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : error ? (
          <div className="rounded-2xl p-4 text-sm" style={{ backgroundColor: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}>
            {error}. Pastikan backend berjalan di localhost:8000.
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            {/* Kolom kiri: sticky saat scroll di desktop */}
            <div className="flex flex-col gap-4 lg:w-80 lg:shrink-0 lg:sticky lg:top-24">
              {best && worst && best.id !== worst.id && <PodiumRow best={best} worst={worst} />}
              <SearchBar value={search} onChange={setSearch} />
              <FilterPills value={filter} onChange={setFilter} />
            </div>

            {/* Kolom kanan: list SPPG */}
            <motion.div className="flex flex-col gap-3 flex-1 min-w-0" variants={listVariants} initial="hidden" animate="visible">
              {filtered.map((s) => <SPPGCard key={s.id} sppg={s} />)}
              {filtered.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Tidak ada SPPG ditemukan.</p>
              )}
            </motion.div>
          </div>
        )}
      </div>

      {/* ── Tahapan Distribusi MBG ────────────────────────────────────────── */}
      <TimelineSection />

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <FAQSection />

      {/* ── Footer / Credit ───────────────────────────────────────────────── */}
      <footer
        className="py-4 px-4 text-center"
        style={{
          backgroundColor: 'var(--navy)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '12px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        © 2026 Kata bijar kita ikut OLIVIA | OLIVIA 2026. Video background source: BGN YouTube Channel.
      </footer>
    </>
  );
}
