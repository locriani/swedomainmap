import type {
  Category,
  CategoryCoverage,
  Level,
  RoleSelection,
} from '../../domain/types';
import { DEFAULT_LEVEL } from '../../domain/scope';
import { ItemPill } from './ItemPill';

interface Props {
  category: Category;
  coverage: CategoryCoverage | undefined;
  selection: RoleSelection | null;
  level?: Level;
  highlight: boolean;
  /**
   * When set (custom selection mode), clicking a pill on the main map toggles
   * that item's membership — the map itself becomes the editor.
   */
  onItemToggle?: (itemId: string) => void;
}

export function CategoryCard({
  category,
  coverage,
  selection,
  level = DEFAULT_LEVEL,
  highlight,
  onItemToggle,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-slate-100 font-semibold text-base">{category.name}</h2>
        {coverage && selection !== null && (
          <span className="text-xs text-slate-400 tabular-nums">
            <span className="text-emerald-400 font-medium">{coverage.scoped}</span>
            <span className="mx-1">/</span>
            <span>{coverage.total}</span>
          </span>
        )}
        {selection === null && coverage && (
          <span className="text-xs text-slate-500 tabular-nums">{coverage.total}</span>
        )}
      </header>
      <div className="flex flex-wrap gap-1.5">
        {category.items.map((item) => (
          <ItemPill
            key={item.id}
            item={item}
            selection={selection}
            level={level}
            highlight={highlight}
            onToggle={onItemToggle ? () => onItemToggle(item.id) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
