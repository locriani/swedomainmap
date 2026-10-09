import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('renders a pressed toggle button in toggle mode when the item is picked', () => {
    const custom: RoleSelection = { kind: 'custom', itemIds: new Set(['swift']) };
    render(<ItemPill item={item} selection={custom} highlight={false} onToggle={() => {}} />);
    const pill = screen.getByRole('button', { name: 'Swift' });
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(pill).toHaveAttribute('data-in-scope', 'true');
  });

  it('renders an unpressed toggle button when the item is not picked', () => {
    const custom: RoleSelection = { kind: 'custom', itemIds: new Set() };
    render(<ItemPill item={item} selection={custom} highlight={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Swift' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('emits onToggle when a toggle pill is clicked', () => {
    const onToggle = vi.fn();
    const custom: RoleSelection = { kind: 'custom', itemIds: new Set() };
    render(<ItemPill item={item} selection={custom} highlight={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Swift' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows membership color in toggle mode even when highlight is off', () => {
    const custom: RoleSelection = { kind: 'custom', itemIds: new Set(['swift']) };
    render(<ItemPill item={item} selection={custom} highlight={false} onToggle={() => {}} />);
    // Emerald classes must be present — an editor that hides which items are
    // picked isn't usable.
    expect(screen.getByRole('button', { name: 'Swift' }).className).toContain('emerald');
  });

  it('keeps the neutral style when highlight is off and not in toggle mode', () => {
    render(<ItemPill item={item} selection={ios} highlight={false} />);
    expect(screen.getByTestId('item-pill').className).not.toContain('emerald');
  });
});
