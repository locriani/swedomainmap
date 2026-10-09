import type { RoleSelection } from '../../domain/types';

interface LegendEntry {
  dotClass: string;
  label: string;
}

/**
 * Explains the highlight colors for the current selection. Labels adapt to the
 * selection kind: a predefined role scopes by "expected to know" (including
 * the muted future state), while a custom selection is simply picked vs not.
 */
export function HighlightLegend({ selection }: { selection: RoleSelection }) {
  const isPredefined = selection.kind === 'predefined';
  const entries: readonly LegendEntry[] = isPredefined
    ? [
        { dotClass: 'bg-emerald-500/70 border-emerald-400/60', label: 'In scope' },
        { dotClass: 'bg-slate-700 border-slate-600 opacity-70', label: 'Earned later (badge shows the level)' },
        { dotClass: 'bg-slate-800 border-slate-700 opacity-70', label: 'Not in scope' },
      ]
    : [
        { dotClass: 'bg-emerald-500/70 border-emerald-400/60', label: 'In your selection' },
        { dotClass: 'bg-slate-800 border-slate-700 opacity-70', label: 'Not selected' },
      ];

  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400"
      data-testid="highlight-legend"
      aria-label="Highlight color legend"
    >
      {entries.map((e) => (
        <li key={e.label} className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full border ${e.dotClass}`} />
          <span>{e.label}</span>
        </li>
      ))}
    </ul>
  );
}
