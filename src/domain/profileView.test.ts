import { describe, expect, it } from 'vitest';
import { createProfileSnapshot, type ProfileSnapshot } from './profiles';
import { profileSummary, viewsMatch, type ViewSnapshot } from './profileView';
import type { RoleId } from './types';

function profile(selection: ProfileSnapshot['selection'], level: ProfileSnapshot['level'] = 'mid', highlight = true): ProfileSnapshot {
  return createProfileSnapshot({ name: 'P', selection, level, highlight }, 'id-1', '2026-01-01T00:00:00Z');
}

const view = (selection: ViewSnapshot['selection'], level: ViewSnapshot['level'] = 'mid', highlight = true): ViewSnapshot => ({
  selection,
  level,
  highlight,
});

describe('viewsMatch', () => {
  it('matches a predefined view to an identical profile', () => {
    expect(viewsMatch(view({ kind: 'predefined', id: 'backend' }), profile({ kind: 'predefined', id: 'backend' }))).toBe(true);
  });

  it('does not match when the role differs', () => {
    expect(viewsMatch(view({ kind: 'predefined', id: 'backend' }), profile({ kind: 'predefined', id: 'ios' }))).toBe(false);
  });

  it('compares custom selections as sets, ignoring order', () => {
    const p = profile({ kind: 'custom', itemIds: ['a', 'b', 'c'] });
    expect(viewsMatch(view({ kind: 'custom', itemIds: new Set(['c', 'a', 'b']) }), p)).toBe(true);
    expect(viewsMatch(view({ kind: 'custom', itemIds: new Set(['a', 'b']) }), p)).toBe(false);
    expect(viewsMatch(view({ kind: 'custom', itemIds: new Set(['a', 'b', 'c', 'd']) }), p)).toBe(false);
  });

  it('does not match when only the level or highlight differs', () => {
    const p = profile({ kind: 'predefined', id: 'backend' }, 'sr', true);
    expect(viewsMatch(view({ kind: 'predefined', id: 'backend' }, 'staff', true), p)).toBe(false);
    expect(viewsMatch(view({ kind: 'predefined', id: 'backend' }, 'sr', false), p)).toBe(false);
  });

  it('never matches a null live selection', () => {
    expect(viewsMatch(view(null), profile({ kind: 'predefined', id: 'backend' }))).toBe(false);
  });
});

describe('profileSummary', () => {
  const resolveRoleName = (id: RoleId) => (id === 'backend' ? 'Backend Engineer' : id);

  it('renders role name and level label for predefined profiles', () => {
    expect(profileSummary(profile({ kind: 'predefined', id: 'backend' }, 'sr'), resolveRoleName)).toBe(
      'Backend Engineer · Senior',
    );
  });

  it('renders an item count for custom profiles, with singular handling', () => {
    expect(profileSummary(profile({ kind: 'custom', itemIds: ['a', 'b'] }), resolveRoleName)).toBe('2 items');
    expect(profileSummary(profile({ kind: 'custom', itemIds: ['a'] }), resolveRoleName)).toBe('1 item');
  });
});
