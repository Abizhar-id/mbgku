'use client';

export type FilterOption = 'semua' | 'terbaik' | 'perlu_perhatian';

const OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'semua',           label: 'Semua' },
  { value: 'terbaik',         label: 'Terbaik' },
  { value: 'perlu_perhatian', label: 'Perlu Perhatian' },
];

export default function FilterPills({
  value, onChange,
}: { value: FilterOption; onChange: (v: FilterOption) => void }) {
  return (
    <div className="flex gap-2 w-full">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: active ? 'var(--navy)' : 'var(--bg-card)',
              color: active ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
