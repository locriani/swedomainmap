import '@testing-library/jest-dom/vitest';

/**
 * vitest 2 + jsdom 25 doesn't ship a real `Storage` implementation by default
 * (window.localStorage is a plain `{}`), so any code that calls `.getItem` /
 * `.setItem` / `.clear` blows up. Install a small in-memory polyfill that
 * matches the Web Storage API surface we actually use, scoped per test file
 * (jsdom rebuilds the window for each test file with `globals: true`).
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(window, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});
