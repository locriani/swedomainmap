import { describe, expect, it } from 'vitest';
import {
  computeCoverage,
  effectiveLevel,
  isItemInScope,
  levelRank,
  slugify,
} from './scope';
import type { Category, Item, RoleSelection } from './types';

const cats: Category[] = [
  {
    id: 'a',
    name: 'A',
    items: [
      { id: 'a1', label: 'a1', roles: ['ios', 'android'] },
      { id: 'a2', label: 'a2', roles: ['backend'] },
    ],
  },
  {
    id: 'b',
    name: 'B',
    items: [
      { id: 'b1', label: 'b1', roles: ['ios'] },
      { id: 'b2', label: 'b2', roles: [] },
    ],
  },
];

const ios: RoleSelection = { kind: 'predefined', id: 'ios' };
const backend: RoleSelection = { kind: 'predefined', id: 'backend' };

describe('isItemInScope', () => {
  it('returns inScope=true when item lists the role at the default level', () => {
    expect(isItemInScope({ id: 'x', label: 'x', roles: ['ios'] }, ios)).toEqual({
      inScope: true,
      future: false,
    });
  });

  it('returns inScope=false when item does not list the role', () => {
    expect(isItemInScope({ id: 'x', label: 'x', roles: ['android'] }, ios)).toEqual({
      inScope: false,
      future: false,
    });
  });

  it('returns inScope=false for null selection', () => {
    expect(isItemInScope({ id: 'x', label: 'x', roles: ['ios'] }, null)).toEqual({
      inScope: false,
      future: false,
    });
  });

  it('returns inScope=false for empty roles under a predefined selection', () => {
    expect(isItemInScope({ id: 'x', label: 'x', roles: [] }, ios)).toEqual({
      inScope: false,
      future: false,
    });
  });

  it('returns inScope=true when item id is in a custom selection', () => {
    const sel: RoleSelection = { kind: 'custom', itemIds: new Set(['x']) };
    expect(isItemInScope({ id: 'x', label: 'x', roles: [] }, sel)).toEqual({
      inScope: true,
      future: false,
    });
  });

  it('returns inScope=false when item id is not in a custom selection', () => {
    const sel: RoleSelection = { kind: 'custom', itemIds: new Set(['y']) };
    expect(isItemInScope({ id: 'x', label: 'x', roles: ['ios'] }, sel)).toEqual({
      inScope: false,
      future: false,
    });
  });

  describe('level threshold', () => {
    const advanced: Item = {
      id: 'k8s',
      label: 'Kubernetes',
      roles: ['backend'],
      levels: { backend: 'sr' },
    };

    it('returns inScope when level is at or above the per-role threshold', () => {
      expect(isItemInScope(advanced, backend, 'sr')).toEqual({ inScope: true, future: false });
      expect(isItemInScope(advanced, backend, 'staff')).toEqual({ inScope: true, future: false });
    });

    it('returns future=true when level is below the per-role threshold', () => {
      expect(isItemInScope(advanced, backend, 'jr')).toEqual({ inScope: false, future: true });
      expect(isItemInScope(advanced, backend, 'mid')).toEqual({ inScope: false, future: true });
    });

    it('treats missing levels[role] as the default Mid threshold', () => {
      const item: Item = { id: 'x', label: 'x', roles: ['backend'] };
      expect(isItemInScope(item, backend, 'jr')).toEqual({ inScope: false, future: true });
      expect(isItemInScope(item, backend, 'mid')).toEqual({ inScope: true, future: false });
      expect(isItemInScope(item, backend, 'sr')).toEqual({ inScope: true, future: false });
    });

    it('ignores level for items the role does not list at all', () => {
      const item: Item = { id: 'x', label: 'x', roles: ['ios'] };
      expect(isItemInScope(item, backend, 'staff')).toEqual({ inScope: false, future: false });
    });
  });
});

describe('computeCoverage', () => {
  it('counts total items across categories', () => {
    const c = computeCoverage(cats, null);
    expect(c.total).toBe(4);
    expect(c.scoped).toBe(0);
  });

  it('counts scoped items for a predefined role at default level', () => {
    const c = computeCoverage(cats, ios);
    expect(c.scoped).toBe(2);
    expect(c.byCategory.get('a')?.scoped).toBe(1);
    expect(c.byCategory.get('b')?.scoped).toBe(1);
  });

  it('counts scoped items for a custom selection', () => {
    const sel: RoleSelection = { kind: 'custom', itemIds: new Set(['a2', 'b1']) };
    const c = computeCoverage(cats, sel);
    expect(c.scoped).toBe(2);
  });

  it('handles empty categories list', () => {
    const c = computeCoverage([], backend);
    expect(c.total).toBe(0);
    expect(c.scoped).toBe(0);
    expect(c.byCategory.size).toBe(0);
  });

  it('excludes future items from scoped count when level is below threshold', () => {
    const cats2: Category[] = [
      {
        id: 'x',
        name: 'X',
        items: [
          { id: 'foundation', label: 'F', roles: ['backend'], levels: { backend: 'jr' } },
          { id: 'advanced', label: 'A', roles: ['backend'], levels: { backend: 'staff' } },
        ],
      },
    ];
    expect(computeCoverage(cats2, backend, 'jr').scoped).toBe(1);
    expect(computeCoverage(cats2, backend, 'staff').scoped).toBe(2);
  });
});

describe('slugify', () => {
  it('lowercases and replaces non-alphanumerics with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Apple App Store / TestFlight')).toBe('apple-app-store-testflight');
  });

  it('strips leading/trailing hyphens and collapses runs', () => {
    expect(slugify('  --Foo!! Bar--  ')).toBe('foo-bar');
  });

  it('is deterministic — same input always yields same slug', () => {
    const a = slugify('Kubernetes (pods, deployments, services)');
    const b = slugify('Kubernetes (pods, deployments, services)');
    expect(a).toBe(b);
  });
});

describe('levelRank', () => {
  it('orders Jr < Mid < Sr < Staff', () => {
    expect(levelRank('jr')).toBeLessThan(levelRank('mid'));
    expect(levelRank('mid')).toBeLessThan(levelRank('sr'));
    expect(levelRank('sr')).toBeLessThan(levelRank('staff'));
  });
});

describe('effectiveLevel', () => {
  it('returns the explicit per-role level when set', () => {
    const item: Item = { id: 'x', label: 'x', roles: ['ios'], levels: { ios: 'sr' } };
    expect(effectiveLevel(item, 'ios')).toBe('sr');
  });

  it('returns Mid when the role has no explicit level', () => {
    const item: Item = { id: 'x', label: 'x', roles: ['ios'] };
    expect(effectiveLevel(item, 'ios')).toBe('mid');
  });
});
