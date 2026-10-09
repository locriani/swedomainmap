import { useId } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';

/**
 * First-run hint: a dismissible panel explaining the three controls (role,
 * level, highlight) to a first-time visitor. Dismissal persists under its own
 * storage key — separate from `swedomainmap.state.v1`, so existing users'
 * selections are never touched by hint bookkeeping (locked decision 3).
 */

const STORAGE_KEY = 'swedomainmap.hints.v1';

interface PersistedHintsV1 {
  v: 1;
  dismissed: boolean;
}

const DEFAULTS: PersistedHintsV1 = { v: 1, dismissed: false };

/** Same defensive-load discipline as useRoleSelection: never crash on junk. */
function sanitizeHints(raw: unknown): PersistedHintsV1 {
  if (typeof raw !== 'object' || raw === null) return DEFAULTS;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1 || typeof o.dismissed !== 'boolean') return DEFAULTS;
  return { v: 1, dismissed: o.dismissed };
}

const CONTROLS: ReadonlyArray<{ name: string; tip: string }> = [
  {
    name: 'Role',
    tip: 'Pick a specialty to see what a typical engineer in it is expected to know — or choose “★ Custom selection” to hand-pick items yourself.',
  },
  {
    name: 'Level',
    tip: 'Narrow the map to a seniority. It shows everything expected at that level and below (Junior through Staff).',
  },
  {
    name: 'Highlight scope',
    tip: 'Color the map by scope: green is in scope now, muted with a level badge comes later, dim is out of scope.',
  },
];

export function FirstRunHint() {
  const headingId = useId();
  const [hints, setHints] = usePersistedState<PersistedHintsV1>(
    STORAGE_KEY,
    DEFAULTS,
    sanitizeHints,
  );

  if (hints.dismissed) return null;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="first-run-hint"
      className="mb-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={headingId} className="text-sm font-semibold text-slate-100">
          First time here? Three controls shape the map
        </h2>
        <button
          type="button"
          onClick={() => setHints({ v: 1, dismissed: true })}
          data-testid="dismiss-hint"
          className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          Got it
        </button>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm text-slate-400">
        {CONTROLS.map((c) => (
          <div key={c.name} className="flex flex-col sm:flex-row sm:gap-2">
            <dt className="shrink-0 font-medium text-slate-300 sm:w-32">{c.name}</dt>
            <dd>{c.tip}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
