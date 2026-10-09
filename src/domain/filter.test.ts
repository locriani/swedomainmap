import { describe, expect, it } from 'vitest';
import { filterCategories } from './filter';
import type { Category } from './types';

const languages: Category = {
  id: 'lang',
  name: 'Languages',
  items: [
    { id: 'swift', label: 'Swift', roles: ['ios'] },
    { id: 'go', label: 'Go', roles: ['backend'] },
  ],
};

const tools: Category = {
  id: 'tools',
  name: 'Tools',
  items: [{ id: 'xcode', label: 'Xcode', roles: ['ios'] }],
};

describe('filterCategories', () => {
  it('returns the input unchanged for an empty query', () => {
    const cats = [languages, tools];
    expect(filterCategories(cats, '')).toBe(cats);
    expect(filterCategories(cats, '   ')).toBe(cats);
  });

  it('matches case-insensitively on item labels', () => {
    const result = filterCategories([languages, tools], 'SWIFT');
    expect(result).toHaveLength(1);
    expect(result[0]!.items.map((i) => i.id)).toEqual(['swift']);
  });

  it('drops categories with no matching items', () => {
    const result = filterCategories([languages, tools], 'swift');
    expect(result.map((c) => c.id)).toEqual(['lang']);
  });

  it('trims surrounding whitespace from the query', () => {
    const result = filterCategories([languages, tools], '  xcode  ');
    expect(result.map((c) => c.id)).toEqual(['tools']);
  });

  it('matches substrings inside labels, not just whole labels', () => {
    const result = filterCategories([languages, tools], 'wift');
    expect(result.map((c) => c.id)).toEqual(['lang']);
    expect(result[0]!.items.map((i) => i.id)).toEqual(['swift']);
  });

  it('returns no categories when nothing matches', () => {
    expect(filterCategories([languages, tools], 'typ')).toHaveLength(0);
  });
});
