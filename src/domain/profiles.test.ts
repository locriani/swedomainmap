import { describe, expect, it } from 'vitest';
import {
  EMPTY_REGISTRY,
  addProfile,
  computeDataVersion,
  createProfileSnapshot,
  deleteProfile,
  duplicateProfile,
  newProfileId,
  overwriteProfile,
  renameProfile,
  sanitizeRegistry,
} from './profiles';
import type { ProfileSnapshot } from './profiles';

const ROLE_IDS = new Set(['ios', 'backend']);
const ITEM_IDS = new Set(['swift', 'lang-c']);
const NOW = () => '2026-01-01T00:00:00.000Z';

function snapshot(overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return {
    id: 'p1',
    v: 1,
    name: 'Backend sr',
    selection: { kind: 'predefined', id: 'backend' },
    level: 'sr',
    highlight: true,
    savedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeDataVersion', () => {
  it('matches the FNV-1a reference vectors (empty input is the offset basis)', () => {
    expect(computeDataVersion([])).toBe('811c9dc5');
    expect(computeDataVersion(['a'])).toBe('e40c292c');
    // Pinned from two independent implementations at introduction. Never
    // change the recipe — this tag detects stale share links and imports.
    expect(computeDataVersion(['swift', 'lang-c'])).toBe('664edb32');
  });

  it('is deterministic and order-sensitive', () => {
    const ids = ['lang-c', 'swift', 'go'];
    expect(computeDataVersion(ids)).toBe(computeDataVersion(['lang-c', 'swift', 'go']));
    expect(computeDataVersion(ids)).not.toBe(computeDataVersion([...ids].reverse()));
  });

  it('changes when the dataset changes', () => {
    expect(computeDataVersion(['swift', 'lang-c'])).not.toBe(
      computeDataVersion(['swift', 'lang-c', 'removed-item']),
    );
  });
});

describe('newProfileId', () => {
  it('produces unique non-empty ids', () => {
    const a = newProfileId();
    const b = newProfileId();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe('createProfileSnapshot', () => {
  it('fills id, v, and savedAt; trims the name', () => {
    const s = createProfileSnapshot(
      {
        name: '  My profile  ',
        selection: { kind: 'predefined', id: 'ios' },
        level: 'jr',
        highlight: false,
        dataVersion: 'abcd1234',
      },
      'fixed-id',
      '2026-02-03T04:05:06.000Z',
    );
    expect(s).toEqual({
      id: 'fixed-id',
      v: 1,
      name: 'My profile',
      selection: { kind: 'predefined', id: 'ios' },
      level: 'jr',
      highlight: false,
      savedAt: '2026-02-03T04:05:06.000Z',
      dataVersion: 'abcd1234',
    });
  });

  it('falls back to Untitled for a blank name and omits an unset dataVersion', () => {
    const s = createProfileSnapshot(
      {
        name: '   ',
        selection: { kind: 'custom', itemIds: ['swift'] },
        level: 'mid',
        highlight: true,
      },
      'x',
      NOW(),
    );
    expect(s.name).toBe('Untitled');
    expect('dataVersion' in s).toBe(false);
  });
});

describe('registry CRUD', () => {
  const registry = {
    v: 1 as const,
    profiles: [
      snapshot({ id: 'p1', name: 'First' }),
      snapshot({ id: 'p2', name: 'Second', selection: { kind: 'custom', itemIds: ['swift'] } }),
    ],
  };

  it('addProfile appends without mutating the input', () => {
    const next = addProfile(registry, snapshot({ id: 'p3', name: 'Third' }));
    expect(next.profiles).toHaveLength(3);
    expect(next.profiles.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(registry.profiles).toHaveLength(2);
  });

  it('renameProfile renames only the target and trims the name', () => {
    const next = renameProfile(registry, 'p2', '  Renamed  ');
    expect(next.profiles[1].name).toBe('Renamed');
    expect(next.profiles[0].name).toBe('First');
    expect(registry.profiles[1].name).toBe('Second');
  });

  it('renameProfile is a no-op for blank names and unknown ids', () => {
    expect(renameProfile(registry, 'p2', '   ')).toBe(registry);
    expect(renameProfile(registry, 'nope', 'X')).toBe(registry);
  });

  it('deleteProfile removes only the target and is a no-op for unknown ids', () => {
    expect(deleteProfile(registry, 'p1').profiles.map((p) => p.id)).toEqual(['p2']);
    expect(deleteProfile(registry, 'nope')).toBe(registry);
  });

  it('duplicateProfile copies with a fresh id, "(copy)" name, and inserts after the source', () => {
    const next = duplicateProfile(registry, 'p1', 'copy-id', NOW());
    expect(next.profiles.map((p) => p.id)).toEqual(['p1', 'copy-id', 'p2']);
    const copy = next.profiles[1];
    expect(copy.name).toBe('First (copy)');
    expect(copy.savedAt).toBe(NOW());
    // Everything except identity/name/timestamp is carried over.
    expect(copy.selection).toEqual(registry.profiles[0].selection);
    expect(copy.level).toBe(registry.profiles[0].level);
  });

  it('duplicateProfile is a no-op for unknown ids', () => {
    expect(duplicateProfile(registry, 'nope', 'x', NOW())).toBe(registry);
  });

  it('overwriteProfile replaces view config + savedAt but keeps the name', () => {
    const next = overwriteProfile(
      registry,
      'p2',
      { selection: { kind: 'custom', itemIds: ['lang-c'] }, level: 'staff', highlight: false },
      NOW(),
    );
    const target = next.profiles[1];
    expect(target.name).toBe('Second');
    expect(target.selection).toEqual({ kind: 'custom', itemIds: ['lang-c'] });
    expect(target.level).toBe('staff');
    expect(target.highlight).toBe(false);
    expect(target.savedAt).toBe(NOW());
    expect(next.profiles[0]).toEqual(registry.profiles[0]);
  });

  it('overwriteProfile is a no-op for unknown ids', () => {
    expect(
      overwriteProfile(registry, 'nope', {
        selection: { kind: 'predefined', id: 'ios' },
        level: 'jr',
        highlight: true,
      }),
    ).toBe(registry);
  });
});

describe('sanitizeRegistry', () => {
  it('returns an empty registry for absent, malformed, or wrong-version input', () => {
    expect(sanitizeRegistry(null, ROLE_IDS, ITEM_IDS, NOW)).toEqual(EMPTY_REGISTRY);
    expect(sanitizeRegistry(undefined, ROLE_IDS, ITEM_IDS, NOW)).toEqual(EMPTY_REGISTRY);
    expect(sanitizeRegistry('nope', ROLE_IDS, ITEM_IDS, NOW)).toEqual(EMPTY_REGISTRY);
    expect(sanitizeRegistry([1, 2, 3], ROLE_IDS, ITEM_IDS, NOW)).toEqual(EMPTY_REGISTRY);
    expect(sanitizeRegistry({ v: 2, profiles: [] }, ROLE_IDS, ITEM_IDS, NOW)).toEqual(EMPTY_REGISTRY);
    expect(sanitizeRegistry({ v: 1, profiles: 'nope' }, ROLE_IDS, ITEM_IDS, NOW)).toEqual(EMPTY_REGISTRY);
  });

  it('round-trips a well-formed registry unchanged', () => {
    const reg = {
      v: 1 as const,
      profiles: [
        snapshot({ id: 'a', name: 'iOS jr', selection: { kind: 'predefined', id: 'ios' }, level: 'jr', highlight: false, dataVersion: '811c9dc5' }),
        snapshot({ id: 'b', selection: { kind: 'custom', itemIds: ['swift', 'lang-c'] } }),
      ],
    };
    expect(sanitizeRegistry(reg, ROLE_IDS, ITEM_IDS, NOW)).toEqual(reg);
  });

  it('drops profiles with unknown role ids but keeps their valid siblings', () => {
    const raw = {
      v: 1,
      profiles: [
        snapshot({ id: 'good', name: 'Backend', selection: { kind: 'predefined', id: 'backend' } }),
        // Plain literal, not the typed factory: the stale role id is
        // deliberately invalid at runtime.
        {
          id: 'stale',
          v: 1,
          name: 'Unicorn',
          selection: { kind: 'predefined', id: 'unicorn' },
          level: 'sr',
          highlight: true,
          savedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const clean = sanitizeRegistry(raw, ROLE_IDS, ITEM_IDS, NOW);
    expect(clean.profiles.map((p) => p.id)).toEqual(['good']);
  });

  it('filters unknown item ids (and dedupes) but keeps the custom profile', () => {
    const raw = {
      v: 1,
      profiles: [
        snapshot({
          id: 'custom',
          selection: { kind: 'custom', itemIds: ['swift', 'GONE', 'swift', 'lang-c'] },
        }),
      ],
    };
    const clean = sanitizeRegistry(raw, ROLE_IDS, ITEM_IDS, NOW);
    expect(clean.profiles[0].selection).toEqual({ kind: 'custom', itemIds: ['swift', 'lang-c'] });
  });

  it('drops structurally malformed snapshots without throwing', () => {
    const raw = {
      v: 1,
      profiles: [
        'a string',
        null,
        42,
        {},
        { id: '', name: 'no id', selection: { kind: 'predefined', id: 'ios' } },
        { id: 'no-selection', name: 'x' },
        { id: 'bad-custom', name: 'x', selection: { kind: 'custom', itemIds: ['swift', 7] } },
        snapshot({ id: 'dup' }),
        snapshot({ id: 'dup', name: 'duplicate id' }),
        snapshot({ id: 'kept' }),
      ],
    };
    const clean = sanitizeRegistry(raw, ROLE_IDS, ITEM_IDS, NOW);
    // First 'dup' wins; the second is dropped alongside the malformed entries.
    expect(clean.profiles.map((p) => p.id)).toEqual(['dup', 'kept']);
  });

  it('repairs damaged fields: bad level, blank name, invalid savedAt, bad dataVersion', () => {
    const raw = {
      v: 1,
      profiles: [
        {
          id: 'r1',
          v: 1,
          name: '   ',
          selection: { kind: 'predefined', id: 'ios' },
          level: 'wizard',
          highlight: 'yes',
          savedAt: 'not-a-date',
          dataVersion: 42,
        },
      ],
    };
    const clean = sanitizeRegistry(raw, ROLE_IDS, ITEM_IDS, NOW);
    expect(clean.profiles[0]).toEqual({
      id: 'r1',
      v: 1,
      name: 'Untitled',
      selection: { kind: 'predefined', id: 'ios' },
      level: 'mid', // DEFAULT_LEVEL
      highlight: true, // coerced
      savedAt: NOW(), // repaired with the injected clock
    });
    expect('dataVersion' in clean.profiles[0]).toBe(false);
  });
});
