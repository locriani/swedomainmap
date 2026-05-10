import type {
  Category,
  CategoryCoverage,
  Coverage,
  Item,
  Level,
  RoleId,
  RoleSelection,
} from './types';

/**
 * Derive a stable slug from a label. Lowercase, alphanumerics + hyphens, no
 * leading/trailing hyphens, no double hyphens. Used by the data layer's `i()`
 * helper to assign each item an `id` automatically. Pure function — same label
 * in always yields same slug out (covered by a determinism test).
 */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Default per-item-per-role level when `Item.levels[role]` is unset. */
export const DEFAULT_LEVEL: Level = 'mid';

const LEVEL_RANK: Record<Level, number> = { jr: 0, mid: 1, sr: 2, staff: 3 };

export function levelRank(l: Level): number {
  return LEVEL_RANK[l];
}

/** Minimum level at which `roleId` is expected to know `item`. */
export function effectiveLevel(item: Item, roleId: RoleId): Level {
  return item.levels?.[roleId] ?? DEFAULT_LEVEL;
}

/**
 * Whether `item` is in scope for `selection` at `level`, plus whether the role
 * is expected to know it *later* than `level` (the "future" muted state).
 *
 * Custom selection: ignores `level` entirely — the user picked items by hand.
 * Predefined: in-scope iff item lists the role AND `effectiveLevel(item, role) <= level`.
 *             future iff item lists the role AND `effectiveLevel(item, role) > level`.
 */
export function isItemInScope(
  item: Item,
  selection: RoleSelection | null,
  level: Level = DEFAULT_LEVEL,
): { inScope: boolean; future: boolean } {
  if (selection === null) return { inScope: false, future: false };
  if (selection.kind === 'custom') {
    return { inScope: selection.itemIds.has(item.id), future: false };
  }
  if (!item.roles.includes(selection.id)) {
    return { inScope: false, future: false };
  }
  const need = effectiveLevel(item, selection.id);
  if (LEVEL_RANK[need] <= LEVEL_RANK[level]) {
    return { inScope: true, future: false };
  }
  return { inScope: false, future: true };
}

export function computeCoverage(
  categories: readonly Category[],
  selection: RoleSelection | null,
  level: Level = DEFAULT_LEVEL,
): Coverage {
  let total = 0;
  let scoped = 0;
  const byCategory = new Map<string, CategoryCoverage>();

  for (const cat of categories) {
    let catScoped = 0;
    for (const item of cat.items) {
      if (isItemInScope(item, selection, level).inScope) catScoped += 1;
    }
    total += cat.items.length;
    scoped += catScoped;
    byCategory.set(cat.id, { categoryId: cat.id, total: cat.items.length, scoped: catScoped });
  }

  return { total, scoped, byCategory };
}
