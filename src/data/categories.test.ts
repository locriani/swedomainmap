import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import { ALL_ROLE_IDS, ROLES } from './roles';
import { computeCoverage, slugify } from '../domain/scope';
import { LEVELS, type RoleId, type RoleSelection } from '../domain/types';

/** Convenience for the Phase 1+ tests — wraps a RoleId in the discriminated union. */
const pre = (id: RoleId): RoleSelection => ({ kind: 'predefined', id });

describe('data integrity', () => {
  it('ROLES set matches the RoleId domain union', () => {
    // Compile-time check: every ROLES entry must satisfy RoleId. Adding a role
    // to ROLES without updating the union in domain/types.ts is a type error.
    // This test guards the runtime side: the union and the data agree on the
    // exact set of ids (no missing, no extras, in any order).
    const expected: Record<RoleId, true> = {
      ios: true, android: true, frontend: true, backend: true, fullstack: true,
      devops: true, platform: true, cloud: true, 'data-eng': true, ml: true,
      embedded: true, game: true, security: true, qa: true, dba: true,
      systems: true, em: true, staff: true, arch: true, devrel: true,
      xr: true, blockchain: true,
      // Phase 1 additions.
      sre: true, mlops: true, 'ai-app': true, 'data-sci': true,
      'analytics-eng': true, 'product-eng': true, dx: true, growth: true,
      'design-eng': true, 'dist-sys': true, perf: true, obs: true,
      privacy: true, a11y: true,
    };
    const ids = new Set(ROLES.map((r) => r.id));
    expect(ids).toEqual(new Set(Object.keys(expected)));
  });

  it('has unique role ids', () => {
    const ids = ROLES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique category ids', () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every category has at least one item', () => {
    for (const cat of CATEGORIES) {
      expect(cat.items.length).toBeGreaterThan(0);
    }
  });

  it('every item references only known roles', () => {
    const known = new Set(ALL_ROLE_IDS);
    for (const cat of CATEGORIES) {
      for (const item of cat.items) {
        for (const role of item.roles) {
          expect(known.has(role)).toBe(true);
        }
      }
    }
  });

  it('every item is in scope for at least one role', () => {
    for (const cat of CATEGORIES) {
      for (const item of cat.items) {
        expect(item.roles.length).toBeGreaterThan(0);
      }
    }
  });

  it('every item has a non-empty id', () => {
    for (const cat of CATEGORIES) {
      for (const item of cat.items) {
        expect(item.id.length).toBeGreaterThan(0);
      }
    }
  });

  it('item ids are globally unique across categories', () => {
    const ids: string[] = [];
    for (const cat of CATEGORIES) {
      for (const item of cat.items) {
        ids.push(item.id);
      }
    }
    const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    expect(dupes, `duplicate item ids: ${dupes.join(', ')}`).toEqual([]);
  });

  it('every levels key is also in the item.roles list', () => {
    for (const cat of CATEGORIES) {
      for (const item of cat.items) {
        if (!item.levels) continue;
        for (const role of Object.keys(item.levels) as RoleId[]) {
          expect(
            item.roles,
            `item "${item.label}" annotates level for role "${role}" but doesn't list it in roles`,
          ).toContain(role);
        }
      }
    }
  });

  it('every levels value is a valid Level', () => {
    const validLevels = new Set<string>(LEVELS);
    for (const cat of CATEGORIES) {
      for (const item of cat.items) {
        if (!item.levels) continue;
        for (const [role, lvl] of Object.entries(item.levels)) {
          expect(validLevels.has(lvl as string), `bad level "${lvl}" for ${item.label}/${role}`).toBe(true);
        }
      }
    }
  });

  it('item ids match slugify(label) — except for explicit overrides', () => {
    // Most items use the `i()` helper which auto-slugs. A small allowlist of
    // explicit overrides exists for cases where two labels collide (e.g. "C"
    // and "C++" both slug to "c"). Adding to this list should be deliberate —
    // prefer disambiguating the label first.
    const EXPLICIT_OVERRIDES = new Set(['lang-c', 'lang-cpp']);
    for (const cat of CATEGORIES) {
      for (const item of cat.items) {
        if (EXPLICIT_OVERRIDES.has(item.id)) continue;
        expect(
          item.id,
          `item "${item.label}" id "${item.id}" doesn't match slugify (add to overrides if intentional)`,
        ).toBe(slugify(item.label));
      }
    }
  });
});

describe('coverage smoke tests for known roles', () => {
  it('each role has a non-empty, non-total scope', () => {
    for (const role of ROLES) {
      const cov = computeCoverage(CATEGORIES, pre(role.id));
      expect(cov.scoped).toBeGreaterThan(0);
      expect(cov.scoped).toBeLessThanOrEqual(cov.total);
    }
  });

  it('iOS scope covers core Apple frameworks', () => {
    const cov = computeCoverage(CATEGORIES, pre('ios'));
    const mobile = cov.byCategory.get('mobile');
    expect(mobile).toBeDefined();
    expect(mobile!.scoped).toBeGreaterThanOrEqual(15);
  });

  it('total item count is comprehensive (>300)', () => {
    const cov = computeCoverage(CATEGORIES, null);
    expect(cov.total).toBeGreaterThan(300);
  });

  // Phase 1 — pragmatic floors so each new role has visible coverage.
  // Tighten as the dataset grows. These counts include items the role picks up
  // via shared groups (ALL, ALL_BUT_EM, WEB, APP_BUILDERS, etc.) plus explicit
  // additions made when the role was introduced.
  const NEW_ROLE_FLOORS: ReadonlyArray<readonly [RoleId, number]> = [
    ['sre', 30],
    ['mlops', 15],
    ['ai-app', 12],
    ['data-sci', 25],
    ['analytics-eng', 18],
    ['product-eng', 30],
    ['dx', 30],
    ['growth', 25],
    ['design-eng', 20],
    ['dist-sys', 25],
    ['perf', 15],
    ['obs', 13],
    ['privacy', 20],
    ['a11y', 12],
  ];

  for (const [roleId, floor] of NEW_ROLE_FLOORS) {
    it(`new role "${roleId}" has at least ${floor} in-scope items`, () => {
      const cov = computeCoverage(CATEGORIES, pre(roleId));
      expect(cov.scoped).toBeGreaterThanOrEqual(floor);
    });
  }
});

describe('level-mode smoke tests', () => {
  // For roles with seeded annotations, going from Jr → Staff should monotonically
  // expand the in-scope set (cumulative semantics). For unannotated roles, every
  // (role, item) pair is at the default Mid threshold, so Jr=0-ish and Mid=Sr=Staff.
  const SEEDED_ROLES: readonly RoleId[] = ['backend', 'frontend', 'ios', 'devops', 'ml'];

  for (const role of SEEDED_ROLES) {
    it(`"${role}" scope is monotone non-decreasing from Jr to Staff`, () => {
      const jr = computeCoverage(CATEGORIES, pre(role), 'jr').scoped;
      const mid = computeCoverage(CATEGORIES, pre(role), 'mid').scoped;
      const sr = computeCoverage(CATEGORIES, pre(role), 'sr').scoped;
      const staff = computeCoverage(CATEGORIES, pre(role), 'staff').scoped;
      expect(jr).toBeLessThanOrEqual(mid);
      expect(mid).toBeLessThanOrEqual(sr);
      expect(sr).toBeLessThanOrEqual(staff);
    });

    it(`"${role}" has at least one item annotated as Jr (foundational)`, () => {
      const jr = computeCoverage(CATEGORIES, pre(role), 'jr').scoped;
      expect(jr).toBeGreaterThan(0);
    });
  }

  it('Mid view matches Phase 2 baseline for an unannotated role (no behavioral regression)', () => {
    // 'qa' has no level annotations — Mid view should match the legacy boolean-only
    // computation (i.e. every role-matching item is in scope).
    const mid = computeCoverage(CATEGORIES, pre('qa'), 'mid').scoped;
    const staff = computeCoverage(CATEGORIES, pre('qa'), 'staff').scoped;
    expect(mid).toBe(staff);
  });
});
