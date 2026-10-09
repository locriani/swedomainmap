import { useId } from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

/**
 * Global item search for the main map. Controlled so the parent (App) owns
 * the query and applies `filterCategories` to the grid — the box itself has
 * no filtering logic.
 */
export function SearchBox({ value, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 text-sm" data-testid="item-search">
      <label htmlFor={id} className="text-slate-400">
        Search
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Filter the whole map…"
          data-testid="item-search-input"
          className="w-52 sm:w-64 bg-slate-900 border border-slate-700 text-slate-200 rounded-md pl-3 pr-8 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
        />
        {value !== '' && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            data-testid="clear-search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
