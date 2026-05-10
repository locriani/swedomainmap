import type { Item, Level, RoleSelection } from '../../domain/types';
import {
  DEFAULT_LEVEL,
  effectiveLevel,
  isItemInScope,
} from '../../domain/scope';

interface Props {
  item: Item;
  selection: RoleSelection | null;
  level?: Level;
  highlight: boolean;
}

export function ItemPill({ item, selection, level = DEFAULT_LEVEL, highlight }: Props) {
  const { inScope, future } = isItemInScope(item, selection, level);
  const showHighlight = highlight && selection !== null;

  // Per design research: in-scope items at full color, future items dimmed
  // with a small "earned-at-L_n" badge for discoverability. Out-of-scope
  // (role doesn't list this item at any level) stays the existing dim style.
  const cls = !showHighlight
    ? 'bg-slate-800 text-slate-200 border-slate-700'
    : inScope
      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
      : future
        ? 'bg-slate-900 text-slate-400 border-slate-700 opacity-60 saturate-50'
        : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60';

  // The "future at L_n" badge — shown only when we actually know the
  // role+level (i.e. predefined selection) and the item is gated above.
  const futureBadge =
    showHighlight && future && selection?.kind === 'predefined'
      ? shortLevel(effectiveLevel(item, selection.id))
      : null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all duration-200 ${cls}`}
      data-testid="item-pill"
      data-item-id={item.id}
      data-in-scope={inScope}
      data-future={future}
    >
      <span>{item.label}</span>
      {futureBadge && (
        <span
          className="ml-0.5 text-[10px] uppercase tracking-wide font-semibold text-slate-300/70"
          data-testid="future-badge"
        >
          {futureBadge}
        </span>
      )}
    </span>
  );
}

function shortLevel(l: Level): string {
  // Compact label for inside the pill — "Sr" reads better than "Senior" at 10px.
  return l === 'jr' ? 'Jr' : l === 'mid' ? 'Mid' : l === 'sr' ? 'Sr' : 'Staff';
}
