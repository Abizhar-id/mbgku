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
            className={`pill text-xs px-3.5 py-2 ${active ? 'active' : ''}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
