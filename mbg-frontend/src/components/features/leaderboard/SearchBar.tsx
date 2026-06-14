'use client';

export default function SearchBar({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full">
      <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cari SPPG…"
        className="field pl-11 pr-3 text-sm"
        style={{ height: '48px' }}
        aria-label="Cari SPPG"
      />
    </div>
  );
}
