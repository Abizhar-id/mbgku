'use client';

export default function SearchBar({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full">
      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cari SPPG…"
        className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
        aria-label="Cari SPPG"
      />
    </div>
  );
}
