import { useMemo } from 'react';
import { computeCoverage, DEFAULT_LEVEL } from '../../domain/scope';
import type { Category, Coverage, Level, RoleSelection } from '../../domain/types';

/**
 * Memoizes coverage for the current selection + level. Memo key:
 * - `null` and `predefined` are cheap (constant or single id + level).
 * - `custom` keys on a sorted-join of itemIds. Acceptable for selections under
 *   ~200 items; if larger selections become common, switch to a version counter
 *   bumped by `useRoleSelection.toggleCustomItem`.
 */
export function useCoverage(
  categories: readonly Category[],
  selection: RoleSelection | null,
  level: Level = DEFAULT_LEVEL,
): Coverage {
  const memoKey = `${level}|${selectionMemoKey(selection)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- memoKey is the
  // canonical encoding of (selection, level); React's deps comparator can't
  // see into a Set otherwise.
  return useMemo(
    () => computeCoverage(categories, selection, level),
    [categories, memoKey],
  );
}

function selectionMemoKey(selection: RoleSelection | null): string {
  if (selection === null) return 'null';
  if (selection.kind === 'predefined') return `p:${selection.id}`;
  return `c:${[...selection.itemIds].sort().join(',')}`;
}
