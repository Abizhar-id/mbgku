'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { SPPG } from '@/types/sppg';
import { fetchSPPGList } from '@/lib/api/sppg';
import PodiumRow from '@/components/features/leaderboard/PodiumRow';
import SearchBar from '@/components/features/leaderboard/SearchBar';
import FilterPills, { type FilterOption } from '@/components/features/leaderboard/FilterPills';
import SPPGCard from '@/components/features/leaderboard/SPPGCard';

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl ${className}`} style={{ backgroundColor: 'var(--bg-surface)' }} />;
}

export default function LeaderboardPage() {
  const [sppgs,   setSPPGs]   = useState<SPPG[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<FilterOption>('semua');

  useEffect(() => {
    fetchSPPGList()
      .then(setSPPGs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }, []);

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
    <div className="mx-auto flex flex-col gap-4 px-4 py-6 max-w-[520px] lg:max-w-5xl lg:px-8 lg:py-8">
      <div>
        <h1 className="font-bold" style={{ color: 'var(--navy)', fontSize: '20px' }}>Leaderboard SPPG</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Transparansi performa program Makan Bergizi Gratis</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : error ? (
        <div className="rounded-2xl p-4 text-sm" style={{ backgroundColor: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}>
          {error} — pastikan backend berjalan di localhost:8000.
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
          {/* Kolom kiri — sticky saat scroll di desktop */}
          <div className="flex flex-col gap-4 lg:w-80 lg:shrink-0 lg:sticky lg:top-6">
            {best && worst && best.id !== worst.id && <PodiumRow best={best} worst={worst} />}
            <SearchBar value={search} onChange={setSearch} />
            <FilterPills value={filter} onChange={setFilter} />
          </div>

          {/* Kolom kanan — list SPPG */}
          <motion.div className="flex flex-col gap-3 flex-1 min-w-0" variants={listVariants} initial="hidden" animate="visible">
            {filtered.map((s) => <SPPGCard key={s.id} sppg={s} />)}
            {filtered.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Tidak ada SPPG ditemukan.</p>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
