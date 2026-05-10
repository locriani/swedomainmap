import { useEffect, useRef, useState } from 'react';

/**
 * Like `useState`, but persists JSON-serializable values to localStorage under
 * the given key. On first render it calls `loader` with whatever (possibly null
 * or malformed) value comes out of storage and expects a clean, validated state
 * back. On every subsequent change it writes the new state, debounced 100ms to
 * avoid hammering storage during rapid edits (e.g. dragging a slider).
 *
 * Errors during read or write are swallowed — localStorage can throw under
 * Safari private mode, quota exhaustion, or when disabled by the user. We treat
 * a working in-memory state as more important than persistence guarantees.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  loader: (raw: unknown) => T,
): readonly [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = readStorage(key);
      return loader(raw);
    } catch {
      return initial;
    }
  });

  // Debounce writes so a flurry of state changes only triggers one write.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Ignore — storage failures shouldn't crash the app.
      }
    }, 100);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [key, state]);

  return [state, setState] as const;
}

function readStorage(key: string): unknown {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
