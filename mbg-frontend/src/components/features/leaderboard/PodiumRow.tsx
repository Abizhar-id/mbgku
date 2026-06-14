'use client';

import Link from 'next/link';
import type { SPPG } from '@/types/sppg';

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

function TrophyIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 2H6v2H2v3a4 4 0 0 0 4 4 6 6 0 0 0 5 5.91V20H8v2h8v-2h-3v-3.09A6 6 0 0 0 18 11a4 4 0 0 0 4-4V4h-4V2ZM6 9a2 2 0 0 1-2-2V6h2v3Zm14-2a2 2 0 0 1-2 2V6h2v1Z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}

function Card({ sppg, kind }: { sppg: SPPG; kind: 'best' | 'worst' }) {
  const isBest     = kind === 'best';
  const border     = isBest ? 'var(--border-best)' : 'var(--border-worst)';
  const bg         = isBest ? 'var(--gold-light)' : '#FEF2F2';
  const label      = isBest ? 'Peringkat Teratas' : 'Perlu Perhatian';
  const labelColor = isBest ? 'var(--gold-text)' : 'var(--delta-down)';

  return (
    <Link href={`/sppg/${sppg.id}`}
      className="card-hover-lift flex-1 rounded-2xl p-4 block transition"
      style={{ backgroundColor: bg, border: `1.5px solid ${border}`, boxShadow: '0 1px 4px rgba(7,30,73,0.06)' }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: labelColor }}>
        {isBest ? <TrophyIcon /> : <AlertIcon />}
        <p className="text-xs font-bold">{label}</p>
      </div>
      <p className="font-bold text-sm mb-1.5 leading-tight" style={{ color: 'var(--text-primary)' }}>{sppg.name}</p>
      <div className="flex items-center gap-2 mb-1">
        <Stars rating={sppg.avg_rating} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{sppg.avg_rating.toFixed(1)}</span>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Ketepatan {sppg.delivery_rate}%</p>
    </Link>
  );
}

export default function PodiumRow({ best, worst }: { best: SPPG; worst: SPPG }) {
  return (
    <div className="flex gap-3 w-full">
      <Card sppg={best} kind="best" />
      <Card sppg={worst} kind="worst" />
    </div>
  );
}
