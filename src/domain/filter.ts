import type { Category } from './types';

/**
 * Pure text filter over the category tree: keeps items whose label contains
 * the query (case-insensitive, whitespace-trimmed) and drops categories left
 * with no matching items. An empty or whitespace-only query returns the input
 * unchanged.
 *
 * Shared by the main-map search and the CustomRoleEditor drawer so both
 * surfaces filter identically instead of owning two copies of the same rule.
 */
export function filterCategories(
  categories: readonly Category[],
  query: string,
): readonly Category[] {
  const q = query.trim().toLowerCase();
  if (!q) return categories;
  return categories
    .map((c) => ({ ...c, items: c.items.filter((i) => i.label.toLowerCase().includes(q)) }))
    .filter((c) => c.items.length > 0);
}
