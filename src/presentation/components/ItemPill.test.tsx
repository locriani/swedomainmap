import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemPill } from './ItemPill';
import type { Item, RoleSelection } from '../../domain/types';

describe('ItemPill', () => {
  const item: Item = { id: 'swift', label: 'Swift', roles: ['ios'] };
  const ios: RoleSelection = { kind: 'predefined', id: 'ios' };
  const backend: RoleSelection = { kind: 'predefined', id: 'backend' };

  it('renders the label', () => {
    render(<ItemPill item={item} selection={null} highlight={false} />);
    expect(screen.getByText('Swift')).toBeInTheDocument();
  });

  it('marks in-scope items when role matches', () => {
    render(<ItemPill item={item} selection={ios} highlight={true} />);
    const pill = screen.getByTestId('item-pill');
    expect(pill).toHaveAttribute('data-in-scope', 'true');
  });

  it('marks items out of scope when role differs', () => {
    render(<ItemPill item={item} selection={backend} highlight={true} />);
    const pill = screen.getByTestId('item-pill');
    expect(pill).toHaveAttribute('data-in-scope', 'false');
  });

  it('still records in-scope state in data attribute when highlight is off', () => {
    render(<ItemPill item={item} selection={ios} highlight={false} />);
    const pill = screen.getByTestId('item-pill');
    expect(pill).toHaveAttribute('data-in-scope', 'true');
  });

  it('marks in-scope when item id is in a custom selection', () => {
    const custom: RoleSelection = {
      kind: 'custom',
      itemIds: new Set(['swift']),
    };
    render(<ItemPill item={item} selection={custom} highlight={true} />);
    expect(screen.getByTestId('item-pill')).toHaveAttribute('data-in-scope', 'true');
  });
});
