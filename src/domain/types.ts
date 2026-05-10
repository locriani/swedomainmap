/**
 * Closed set of role identifiers. The domain layer owns this union so item
 * declarations in the data layer are checked at compile time. A data-layer
 * test asserts that ROLES exactly matches this union at runtime.
 */
export type RoleId =
  | 'ios'
  | 'android'
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'devops'
  | 'platform'
  | 'cloud'
  | 'data-eng'
  | 'ml'
  | 'embedded'
  | 'game'
  | 'security'
  | 'qa'
  | 'dba'
  | 'systems'
  | 'em'
  | 'staff'
  | 'arch'
  | 'devrel'
  | 'xr'
  | 'blockchain'
  // Phase 1 additions — closes role-coverage gaps (see plan).
  | 'sre'
  | 'mlops'
  | 'ai-app'
  | 'data-sci'
  | 'analytics-eng'
  | 'product-eng'
  | 'dx'
  | 'growth'
  | 'design-eng'
  | 'dist-sys'
  | 'perf'
  | 'obs'
  | 'privacy'
  | 'a11y';

export interface Role {
  id: RoleId;
  name: string;
  description: string;
}

/**
 * Seniority level — what a typical engineer at that level is expected to know.
 * Cumulative semantics: a Senior is expected to know everything at Senior and
 * below. Industry-standard 4-level vocabulary (Jr / Mid / Sr / Staff) — see
 * the design doc for sources.
 */
export type Level = 'jr' | 'mid' | 'sr' | 'staff';
export const LEVELS: readonly Level[] = ['jr', 'mid', 'sr', 'staff'] as const;

export const LEVEL_LABELS: Record<Level, string> = {
  jr: 'Junior',
  mid: 'Mid',
  sr: 'Senior',
  staff: 'Staff',
};

export interface Item {
  /**
   * Globally unique slug, derived from `label` by default in the data layer's
   * `i()` helper. Stable enough to use as a localStorage key for the custom
   * role mode (see `RoleSelection` below). The data tests assert uniqueness.
   */
  id: string;
  label: string;
  roles: readonly RoleId[];
  /**
   * Optional minimum-level threshold per role. If `levels[role]` is missing,
   * the role is expected to know the item at `'mid'` (the calibrated default).
   * If set, the role is expected to know it at that level and above. So
   * `levels: { backend: 'sr' }` means: a Sr or Staff backend should know it,
   * but a Mid backend has not yet "earned" it.
   *
   * Only roles already in `roles` should appear as keys (a data test enforces).
   */
  levels?: Partial<Record<RoleId, Level>>;
}

export interface Category {
  id: string;
  name: string;
  items: readonly Item[];
}

/**
 * What the user is currently filtering by. A predefined role is one from the
 * `ROLES` table (kept strict via `RoleId`). A custom selection is an arbitrary
 * subset of item ids the user picked themselves — it lives in localStorage and
 * does NOT participate in the `RoleId` union (so the data invariants stay tight).
 */
export type RoleSelection =
  | { readonly kind: 'predefined'; readonly id: RoleId }
  | { readonly kind: 'custom'; readonly itemIds: ReadonlySet<string>; readonly name?: string };

export interface CategoryCoverage {
  categoryId: string;
  total: number;
  scoped: number;
}

export interface Coverage {
  total: number;
  scoped: number;
  byCategory: ReadonlyMap<string, CategoryCoverage>;
}
