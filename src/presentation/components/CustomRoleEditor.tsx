import { useEffect, useId, useMemo, useState } from 'react';
import { CATEGORIES } from '../../data/categories';

interface Props {
  open: boolean;
  selectedItemIds: ReadonlySet<string>;
  onToggle: (itemId: string) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Modal-ish drawer for picking a custom selection of items. Live: every checkbox
 * change toggles the corresponding item in the parent's state immediately, so
 * the underlying map updates as the user works. Closes on Escape or backdrop
 * click.
 */
export function CustomRoleEditor({
  open,
  selectedItemIds,
  onToggle,
  onClear,
  onClose,
}: Props) {
  const titleId = useId();
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((c) => ({
      ...c,
      items: c.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((c) => c.items.length > 0);
  }, [filter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="custom-editor"
    >
      <button
        type="button"
        aria-label="Close custom editor"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-xl h-full bg-slate-950 border-l border-slate-800 flex flex-col shadow-2xl">
        <header className="flex items-center justify-between gap-3 p-4 border-b border-slate-800">
          <div>
            <h2 id={titleId} className="text-slate-100 font-semibold">
              Custom selection
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedItemIds.size} item{selectedItemIds.size === 1 ? '' : 's'} selected
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm rounded-md border border-slate-700 bg-slate-900 text-slate-200 px-2.5 py-1.5 hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </header>
        <div className="p-4 border-b border-slate-800">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter items…"
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {filtered.map((cat) => (
            <section key={cat.id}>
              <h3 className="text-slate-300 text-xs uppercase tracking-wide font-medium mb-2">
                {cat.name}
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                {cat.items.map((item) => {
                  const checked = selectedItemIds.has(item.id);
                  return (
                    <li key={item.id}>
                      <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer hover:text-slate-100">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggle(item.id)}
                          className="accent-emerald-500"
                          data-testid={`custom-checkbox-${item.id}`}
                        />
                        <span>{item.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No items match "{filter}".</p>
          )}
        </div>
      </div>
    </div>
  );
}
