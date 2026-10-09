import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfiles } from './useProfiles';

const KEY = 'swedomainmap.profiles.v1';
const STATE_KEY = 'swedomainmap.state.v1';
// Real item ids from the data layer (slugified labels in `categories.ts`).
const SWIFT = 'swift';
const LANG_C = 'lang-c';

function seedRegistry(profiles: unknown[]) {
  window.localStorage.setItem(KEY, JSON.stringify({ v: 1, profiles }));
}

describe('useProfiles', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with an empty registry when storage is empty', () => {
    const { result } = renderHook(() => useProfiles());
    expect(result.current.profiles).toEqual([]);
  });

  it('round-trips a saved profile through localStorage', async () => {
    const { result, unmount } = renderHook(() => useProfiles());

    let created!: ReturnType<typeof result.current.saveProfile>;
    act(() => {
      created = result.current.saveProfile({
        name: 'Backend sr',
        selection: { kind: 'predefined', id: 'backend' },
        level: 'sr',
        highlight: false,
      });
    });

    expect(created.name).toBe('Backend sr');
    expect(created.id).toBeTruthy();
    expect(created.v).toBe(1);
    // Debounce is 100ms — wait for the write, then remount to read it back.
    await waitFor(() => expect(window.localStorage.getItem(KEY)).not.toBeNull());
    expect(result.current.profiles).toHaveLength(1);

    unmount();
    const reloaded = renderHook(() => useProfiles()).result;
    expect(reloaded.current.profiles).toEqual([created]);
  });

  it('stamps the dataset data-version on save', () => {
    const { result } = renderHook(() => useProfiles());
    let created!: ReturnType<typeof result.current.saveProfile>;
    act(() => {
      created = result.current.saveProfile({
        name: 'X',
        selection: { kind: 'custom', itemIds: [SWIFT] },
        level: 'mid',
        highlight: true,
      });
    });
    // 8 hex chars, stable for the current dataset.
    expect(created.dataVersion).toMatch(/^[0-9a-f]{8}$/);
  });

  it('supports overwrite, rename, duplicate, and delete', () => {
    const { result } = renderHook(() => useProfiles());

    let created!: ReturnType<typeof result.current.saveProfile>;
    act(() => {
      created = result.current.saveProfile({
        name: 'Original',
        selection: { kind: 'custom', itemIds: [SWIFT] },
        level: 'jr',
        highlight: true,
      });
    });
    const id = created.id;

    act(() =>
      result.current.overwriteProfile(id, {
        selection: { kind: 'custom', itemIds: [LANG_C] },
        level: 'staff',
        highlight: false,
      }),
    );
    expect(result.current.profiles[0]).toMatchObject({
      id,
      name: 'Original',
      level: 'staff',
      highlight: false,
    });
    expect(result.current.profiles[0].selection).toEqual({ kind: 'custom', itemIds: [LANG_C] });

    act(() => result.current.renameProfile(id, '  Renamed  '));
    expect(result.current.profiles[0].name).toBe('Renamed');

    act(() => result.current.duplicateProfile(id));
    expect(result.current.profiles).toHaveLength(2);
    expect(result.current.profiles[0].name).toBe('Renamed');
    expect(result.current.profiles[1].name).toBe('Renamed (copy)');
    expect(result.current.profiles[1].id).not.toBe(id);

    act(() => result.current.deleteProfile(id));
    expect(result.current.profiles.map((p) => p.id)).toEqual([result.current.profiles[0].id]);
    expect(result.current.profiles[0].name).toBe('Renamed (copy)');
  });

  it('falls back to an empty registry on malformed JSON, without crashing', () => {
    window.localStorage.setItem(KEY, '{not-json');
    const { result } = renderHook(() => useProfiles());
    expect(result.current.profiles).toEqual([]);
  });

  it('drops profiles with unknown role ids and filters unknown item ids on load', () => {
    seedRegistry([
      {
        id: 'stale-role',
        v: 1,
        name: 'Unicorn',
        selection: { kind: 'predefined', id: 'unicorn' },
        level: 'sr',
        highlight: true,
        savedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'mixed-custom',
        v: 1,
        name: 'Mixed',
        selection: { kind: 'custom', itemIds: [SWIFT, 'NONSENSE_ITEM', LANG_C] },
        level: 'mid',
        highlight: true,
        savedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const { result } = renderHook(() => useProfiles());
    expect(result.current.profiles.map((p) => p.id)).toEqual(['mixed-custom']);
    expect(result.current.profiles[0].selection).toEqual({
      kind: 'custom',
      itemIds: [SWIFT, LANG_C],
    });
  });

  it('survives corrupt and partial registry shapes', () => {
    for (const raw of ['42', '"str"', 'null', '{"v":2,"profiles":[]}', '{"v":1,"profiles":"x"}']) {
      window.localStorage.setItem(KEY, raw);
      const { result } = renderHook(() => useProfiles());
      expect(result.current.profiles).toEqual([]);
      window.localStorage.clear();
    }
    // Partial: garbage entries are dropped, valid siblings survive.
    seedRegistry([
      'garbage',
      null,
      {
        id: 'ok',
        v: 1,
        name: 'Valid',
        selection: { kind: 'predefined', id: 'ios' },
        level: 'jr',
        highlight: true,
        savedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const { result } = renderHook(() => useProfiles());
    expect(result.current.profiles.map((p) => p.id)).toEqual(['ok']);
  });

  it('never touches swedomainmap.state.v1 (concurrent-key isolation)', async () => {
    const stateV1 = JSON.stringify({
      v: 1,
      selection: { kind: 'predefined', id: 'ios' },
      highlight: true,
      level: 'mid',
    });
    window.localStorage.setItem(STATE_KEY, stateV1);

    const { result } = renderHook(() => useProfiles());
    act(() => {
      const created = result.current.saveProfile({
        name: 'Isolation',
        selection: { kind: 'predefined', id: 'backend' },
        level: 'sr',
        highlight: true,
      });
      result.current.renameProfile(created.id, 'Renamed');
      result.current.deleteProfile(created.id);
    });
    await waitFor(() => expect(window.localStorage.getItem(KEY)).not.toBeNull());

    expect(window.localStorage.getItem(STATE_KEY)).toBe(stateV1);
  });

  it('swallows storage write failures (quota / private mode)', async () => {
    // The test setup swaps in a MemoryStorage instance, so spy on the
    // instance itself — Storage.prototype is not in its chain.
    const setItemSpy = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

    const { result } = renderHook(() => useProfiles());
    act(() =>
      result.current.saveProfile({
        name: 'Kept in memory',
        selection: { kind: 'predefined', id: 'ios' },
        level: 'jr',
        highlight: true,
      }),
    );

    // The in-memory registry still updated; nothing threw.
    expect(result.current.profiles).toHaveLength(1);

    // Debounce fires at ~100ms: the write throws and must stay swallowed.
    await new Promise((r) => setTimeout(r, 150));
    expect(setItemSpy).toHaveBeenCalled();
    expect(result.current.profiles).toHaveLength(1);
  });
});
