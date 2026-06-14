'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { SPPG } from '@/types/sppg';

function rankStyle(rank: number) {
  if (rank === 1) return { bg: 'var(--gold)',   color: '#FFFFFF' };  // emas
  if (rank === 2) return { bg: '#A8A8A8',       color: '#FFFFFF' };  // perak
  if (rank === 3) return { bg: '#CD7F32',       color: '#FFFFFF' };  // perunggu
  return           { bg: 'var(--bg-surface)',   color: 'var(--text-secondary)' };  // abu (4+)
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className="w-3.5 h-3.5"
          style={{ color: s <= Math.round(rating) ? 'var(--gold)' : 'var(--border)' }}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function SPPGCard({ sppg }: { sppg: SPPG }) {
  const rs = rankStyle(sppg.rank);
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
      <Link href={`/sppg/${sppg.id}`}
        className="card card-hover-lift flex items-center gap-4 p-5">
        {/* Rank badge */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shrink-0"
          style={{ backgroundColor: rs.bg, color: rs.color }}>
          {sppg.rank}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>{sppg.name}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sppg.address}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
            <span className="flex items-center gap-1">
              <Stars rating={sppg.avg_rating} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{sppg.avg_rating.toFixed(1)}</span>
            </span>
            <span className="text-xs" aria-hidden="true">·</span>
            <span className="text-xs">Ketepatan {sppg.delivery_rate}%</span>
            <span className="text-xs" aria-hidden="true">·</span>
            <span className="text-xs">{sppg.total_feedback} ulasan</span>
          </div>
        </div>
        {/* Delivery rate */}
        <div className="text-right shrink-0">
          <p className="font-bold text-xl" style={{ color: 'var(--navy)' }}>{sppg.delivery_rate}%</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>tepat</p>
        </div>
      </Link>
    </motion.div>
  );
}
