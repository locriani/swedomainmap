import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryCard } from './CategoryCard';
import type { Category, RoleSelection } from '../../domain/types';

const cat: Category = {
  id: 'lang',
  name: 'Languages',
  items: [
    { id: 'swift', label: 'Swift', roles: ['ios'] },
    { id: 'go', label: 'Go', roles: ['backend'] },
    { id: 'typescript', label: 'TypeScript', roles: ['ios', 'backend'] },
  ],
};

const iosSelection: RoleSelection = { kind: 'predefined', id: 'ios' };

describe('CategoryCard', () => {
  it('renders the category name and all items', () => {
    render(
      <CategoryCard
        category={cat}
        coverage={{ categoryId: 'lang', total: 3, scoped: 0 }}
        selection={null}
        highlight={false}
      />,
    );
    expect(screen.getByText('Languages')).toBeInTheDocument();
    expect(screen.getByText('Swift')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('shows total only when no selection', () => {
    const { container } = render(
      <CategoryCard
        category={cat}
        coverage={{ categoryId: 'lang', total: 3, scoped: 0 }}
        selection={null}
        highlight={false}
      />,
    );
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header!.textContent).toContain('3');
    expect(header!.textContent).not.toContain('/');
  });

  it('shows scoped/total ratio when role is selected', () => {
    const { container } = render(
      <CategoryCard
        category={cat}
        coverage={{ categoryId: 'lang', total: 3, scoped: 2 }}
        selection={iosSelection}
        highlight={true}
      />,
    );
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header!.textContent).toMatch(/2\s*\/\s*3/);
  });

  it('marks pills with correct in-scope state', () => {
    render(
      <CategoryCard
        category={cat}
        coverage={{ categoryId: 'lang', total: 3, scoped: 2 }}
        selection={iosSelection}
        highlight={true}
      />,
    );
    const pills = screen.getAllByTestId('item-pill');
    const swift = pills.find((p) => p.textContent === 'Swift');
    const go = pills.find((p) => p.textContent === 'Go');
    expect(swift).toHaveAttribute('data-in-scope', 'true');
    expect(go).toHaveAttribute('data-in-scope', 'false');
  });

  it('marks pills correctly for a custom selection', () => {
    const customSelection: RoleSelection = {
      kind: 'custom',
      itemIds: new Set(['go']),
    };
    render(
      <CategoryCard
        category={cat}
        coverage={{ categoryId: 'lang', total: 3, scoped: 1 }}
        selection={customSelection}
        highlight={true}
      />,
    );
    const pills = screen.getAllByTestId('item-pill');
    const go = pills.find((p) => p.textContent === 'Go');
    const swift = pills.find((p) => p.textContent === 'Swift');
    expect(go).toHaveAttribute('data-in-scope', 'true');
    expect(swift).toHaveAttribute('data-in-scope', 'false');
  });
});
