import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRoleSelection } from './useRoleSelection';

const KEY = 'swedomainmap.state.v1';

describe('useRoleSelection', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('starts at the default predefined ios selection when storage is empty', () => {
    const { result } = renderHook(() => useRoleSelection());
    expect(result.current.selection).toEqual({ kind: 'predefined', id: 'ios' });
    expect(result.current.highlight).toBe(true);
  });

  it('restores a predefined selection from localStorage', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ v: 1, selection: { kind: 'predefined', id: 'backend' }, highlight: false }),
    );
    const { result } = renderHook(() => useRoleSelection());
    expect(result.current.selection).toEqual({ kind: 'predefined', id: 'backend' });
    expect(result.current.highlight).toBe(false);
  });

  it('drops a stale predefined id from localStorage', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ v: 1, selection: { kind: 'predefined', id: 'unicorn' }, highlight: true }),
    );
    const { result } = renderHook(() => useRoleSelection());
    expect(result.current.selection).toBeNull();
  });

  it('falls back to defaults on corrupt JSON', () => {
    window.localStorage.setItem(KEY, '{not-json');
    const { result } = renderHook(() => useRoleSelection());
    expect(result.current.selection).toEqual({ kind: 'predefined', id: 'ios' });
  });

  it('toggleCustomItem adds and removes ids', () => {
    const { result } = renderHook(() => useRoleSelection());
    act(() => result.current.startCustom());
    act(() => result.current.toggleCustomItem('swift'));
    expect(result.current.selection).toEqual({
      kind: 'custom',
      itemIds: new Set(['swift']),
      name: undefined,
    });
    act(() => result.current.toggleCustomItem('swift'));
    expect(
      (result.current.selection as { itemIds: ReadonlySet<string> }).itemIds.size,
    ).toBe(0);
  });

  it('filters out unknown item ids when restoring a custom selection', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 1,
        selection: { kind: 'custom', itemIds: ['swift', 'NONSENSE_ITEM'] },
        highlight: true,
      }),
    );
    const { result } = renderHook(() => useRoleSelection());
    const sel = result.current.selection as {
      kind: 'custom';
      itemIds: ReadonlySet<string>;
    };
    expect(sel.kind).toBe('custom');
    expect(sel.itemIds.has('swift')).toBe(true);
    expect(sel.itemIds.has('NONSENSE_ITEM')).toBe(false);
  });
});
