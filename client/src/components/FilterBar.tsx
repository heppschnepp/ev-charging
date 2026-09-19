import type { FilterType } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  active: FilterType;
  onChange: (f: FilterType) => void;
  counts: Record<FilterType, number>;
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'operational', label: 'Operational' },
  { id: 'fast', label: 'Fast charge' },
  { id: 'free', label: 'Free' },
];

export function FilterBar({ active, onChange, counts }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
            active === f.id
              ? 'bg-ev-600 text-white shadow-sm'
              : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700',
          )}
        >
          {f.label}
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              active === f.id ? 'bg-ev-700 text-ev-100' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
            )}
          >
            {counts[f.id]}
          </span>
        </button>
      ))}
    </div>
  );
}
