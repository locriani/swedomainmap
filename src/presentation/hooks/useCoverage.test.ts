import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCoverage } from './useCoverage';
import type { Category, RoleSelection } from '../../domain/types';

const cats: Category[] = [
  {
    id: 'a',
    name: 'A',
    items: [
      { id: 'a1', label: 'a1', roles: ['ios'] },
      { id: 'a2', label: 'a2', roles: ['backend'] },
    ],
  },
];

const ios: RoleSelection = { kind: 'predefined', id: 'ios' };
const backend: RoleSelection = { kind: 'predefined', id: 'backend' };

describe('useCoverage', () => {
  it('returns coverage for a predefined role', () => {
    const { result } = renderHook(() => useCoverage(cats, ios));
    expect(result.current.scoped).toBe(1);
    expect(result.current.total).toBe(2);
  });

  it('returns zero scoped for null selection', () => {
    const { result } = renderHook(() => useCoverage(cats, null));
    expect(result.current.scoped).toBe(0);
  });

  it('returns coverage for a custom selection', () => {
    const sel: RoleSelection = { kind: 'custom', itemIds: new Set(['a2']) };
    const { result } = renderHook(() => useCoverage(cats, sel));
    expect(result.current.scoped).toBe(1);
  });

  it('memoizes when inputs are unchanged', () => {
    const { result, rerender } = renderHook(({ s }) => useCoverage(cats, s), {
      initialProps: { s: ios as RoleSelection | null },
    });
    const first = result.current;
    rerender({ s: { kind: 'predefined', id: 'ios' } });
    expect(result.current).toBe(first);
  });

  it('recomputes when role changes', () => {
    const { result, rerender } = renderHook(({ s }) => useCoverage(cats, s), {
      initialProps: { s: ios as RoleSelection | null },
    });
    const first = result.current;
    rerender({ s: backend });
    expect(result.current).not.toBe(first);
    expect(result.current.scoped).toBe(1);
  });

  it('memoizes equal custom selections (different Set identity, same contents)', () => {
    const a: RoleSelection = { kind: 'custom', itemIds: new Set(['a1', 'a2']) };
    const b: RoleSelection = { kind: 'custom', itemIds: new Set(['a2', 'a1']) };
    const { result, rerender } = renderHook(({ s }) => useCoverage(cats, s), {
      initialProps: { s: a },
    });
    const first = result.current;
    rerender({ s: b });
    expect(result.current).toBe(first);
  });
});
