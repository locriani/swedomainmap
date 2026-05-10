import { useCallback, useMemo } from 'react';
import { ROLES } from '../../data/roles';
import { LEVELS, type Level, type RoleId, type RoleSelection } from '../../domain/types';
import { DEFAULT_LEVEL } from '../../domain/scope';
import { CATEGORIES } from '../../data/categories';
import { usePersistedState } from './usePersistedState';

/**
 * Single source of truth for the user's view configuration:
 * - `selection`: predefined role / custom item-set / nothing.
 * - `highlight`: whether to apply scope highlighting.
 *
 * Persists to one localStorage key (`STORAGE_KEY` below). On load, the loader
 * defends against the dataset shifting underneath persisted state — stale role
 * ids are dropped, missing item ids are filtered out — so a user returning
 * after a deploy never sees a broken selection.
 *
 * The internal storage shape (`PersistedV1`) uses an `itemIds: string[]` so it
 * round-trips through `JSON.stringify` cleanly. The hook converts to/from a
 * `ReadonlySet<string>` at the public-API boundary, since `Set.has()` is what
 * `isItemInScope` wants.
 */

const STORAGE_KEY = 'swedomainmap.state.v1';

interface PersistedV1 {
  v: 1;
  selection: PersistedSelection | null;
  highlight: boolean;
  level: Level;
}

type PersistedSelection =
  | { kind: 'predefined'; id: string }
  | { kind: 'custom'; itemIds: string[]; name?: string };

const DEFAULTS: PersistedV1 = {
  v: 1,
  selection: { kind: 'predefined', id: 'ios' },
  highlight: true,
  level: DEFAULT_LEVEL,
};

export interface UseRoleSelection {
  selection: RoleSelection | null;
  highlight: boolean;
  level: Level;
  setSelection: (s: RoleSelection | null) => void;
  setHighlight: (h: boolean) => void;
  setLevel: (l: Level) => void;
  toggleCustomItem: (itemId: string) => void;
  clearCustom: () => void;
  /** Convenience: starts a fresh empty custom selection (overwrites any current). */
  startCustom: () => void;
}

export function useRoleSelection(): UseRoleSelection {
  const knownItemIds = useMemo(
    () => new Set(CATEGORIES.flatMap((c) => c.items.map((i) => i.id))),
    [],
  );
  const knownRoleIds = useMemo(() => new Set(ROLES.map((r) => r.id)), []);

  const [stored, setStored] = usePersistedState<PersistedV1>(
    STORAGE_KEY,
    DEFAULTS,
    (raw) => sanitize(raw, knownRoleIds, knownItemIds),
  );

  const selection = useMemo<RoleSelection | null>(
    () => toRoleSelection(stored.selection),
    [stored.selection],
  );

  const setSelection = useCallback(
    (s: RoleSelection | null) =>
      setStored((prev) => ({ ...prev, selection: fromRoleSelection(s) })),
    [setStored],
  );

  const setHighlight = useCallback(
    (h: boolean) => setStored((prev) => ({ ...prev, highlight: h })),
    [setStored],
  );

  const setLevel = useCallback(
    (l: Level) => setStored((prev) => ({ ...prev, level: l })),
    [setStored],
  );

  const toggleCustomItem = useCallback(
    (itemId: string) => {
      setStored((prev) => {
        const currentSet =
          prev.selection?.kind === 'custom'
            ? new Set(prev.selection.itemIds)
            : new Set<string>();
        if (currentSet.has(itemId)) currentSet.delete(itemId);
        else currentSet.add(itemId);
        const name = prev.selection?.kind === 'custom' ? prev.selection.name : undefined;
        return {
          ...prev,
          selection: { kind: 'custom', itemIds: [...currentSet], name },
        };
      });
    },
    [setStored],
  );

  const clearCustom = useCallback(() => {
    setStored((prev) =>
      prev.selection?.kind === 'custom'
        ? { ...prev, selection: { kind: 'custom', itemIds: [], name: prev.selection.name } }
        : prev,
    );
  }, [setStored]);

  const startCustom = useCallback(() => {
    setStored((prev) => ({ ...prev, selection: { kind: 'custom', itemIds: [] } }));
  }, [setStored]);

  return {
    selection,
    highlight: stored.highlight,
    level: stored.level,
    setSelection,
    setHighlight,
    setLevel,
    toggleCustomItem,
    clearCustom,
    startCustom,
  };
}

function toRoleSelection(s: PersistedSelection | null): RoleSelection | null {
  if (s === null) return null;
  if (s.kind === 'predefined') return { kind: 'predefined', id: s.id as RoleId };
  return { kind: 'custom', itemIds: new Set(s.itemIds), name: s.name };
}

function fromRoleSelection(s: RoleSelection | null): PersistedSelection | null {
  if (s === null) return null;
  if (s.kind === 'predefined') return { kind: 'predefined', id: s.id };
  return { kind: 'custom', itemIds: [...s.itemIds], name: s.name };
}

function sanitize(
  raw: unknown,
  knownRoleIds: ReadonlySet<string>,
  knownItemIds: ReadonlySet<string>,
): PersistedV1 {
  if (!isPersistedV1Shape(raw)) return DEFAULTS;
  const sel = raw.selection;
  let cleanSel: PersistedSelection | null;
  if (sel === null) {
    cleanSel = null;
  } else if (sel.kind === 'predefined') {
    cleanSel = knownRoleIds.has(sel.id) ? { kind: 'predefined', id: sel.id } : null;
  } else {
    cleanSel = {
      kind: 'custom',
      itemIds: sel.itemIds.filter((id) => knownItemIds.has(id)),
      name: sel.name,
    };
  }
  const level: Level = LEVELS.includes(raw.level as Level) ? (raw.level as Level) : DEFAULT_LEVEL;
  return { v: 1, selection: cleanSel, highlight: !!raw.highlight, level };
}

function isPersistedV1Shape(raw: unknown): raw is PersistedV1 {
  if (typeof raw !== 'object' || raw === null) return false;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return false;
  if (typeof o.highlight !== 'boolean') return false;
  // `level` is optional in persisted state for migration ease — sanitize() falls
  // back to DEFAULT_LEVEL if missing or invalid. Don't require it here.
  if (o.selection === null) return true;
  if (typeof o.selection !== 'object' || o.selection === null) return false;
  const s = o.selection as Record<string, unknown>;
  if (s.kind === 'predefined' && typeof s.id === 'string') return true;
  if (s.kind === 'custom' && Array.isArray(s.itemIds)) {
    return s.itemIds.every((id) => typeof id === 'string');
  }
  return false;
}
