'use client';

import Link from 'next/link';
import type { SPPG } from '@/types/sppg';

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className="w-3 h-3"
          style={{ color: s <= Math.round(rating) ? 'var(--gold)' : 'var(--border)' }}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function Card({ sppg, kind }: { sppg: SPPG; kind: 'best' | 'worst' }) {
  const border = kind === 'best' ? 'var(--border-best)' : 'var(--border-worst)';
  const label  = kind === 'best' ? 'Peringkat Teratas' : 'Perlu Perhatian';
  const labelColor = kind === 'best' ? 'var(--gold-text)' : 'var(--delta-down)';
  return (
    <Link href={`/sppg/${sppg.id}`}
      className="flex-1 rounded-2xl p-4 block transition-transform hover:-translate-y-0.5"
      style={{ backgroundColor: 'var(--bg-card)', border: `1.5px solid ${border}` }}>
      <p className="text-xs font-semibold mb-2" style={{ color: labelColor }}>{label}</p>
      <p className="font-bold text-sm mb-1 leading-tight" style={{ color: 'var(--text-primary)' }}>{sppg.name}</p>
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
