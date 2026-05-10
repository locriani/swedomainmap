import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';
import type { Coverage, Role, RoleSelection } from '../../domain/types';

const roles: Role[] = [
  { id: 'ios', name: 'iOS Engineer', description: 'Native Apple apps.' },
  { id: 'backend', name: 'Backend Engineer', description: 'Servers.' },
];

const coverage = (scoped: number, total: number): Coverage => ({
  total,
  scoped,
  byCategory: new Map([['x', { categoryId: 'x', total, scoped }]]),
});

const noopProps = {
  level: 'mid' as const,
  onPredefinedChange: () => {},
  onCustomChosen: () => {},
  onEditCustom: () => {},
  onLevelChange: () => {},
  onHighlightChange: () => {},
};

describe('Header', () => {
  it('renders the title', () => {
    render(
      <Header
        roles={roles}
        selection={null}
        selectedRoleObj={null}
        highlight={false}
        coverage={coverage(0, 100)}
        {...noopProps}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/domain map/i);
  });

  it('shows total-only summary when no selection', () => {
    render(
      <Header
        roles={roles}
        selection={null}
        selectedRoleObj={null}
        highlight={false}
        coverage={coverage(0, 100)}
        {...noopProps}
      />,
    );
    const summary = screen.getByTestId('scope-summary');
    expect(summary).toHaveTextContent(/Pick a role above/i);
    expect(summary).toHaveTextContent('100');
    expect(summary).toHaveTextContent('1 categories');
  });

  it('shows scoped summary when predefined role is selected', () => {
    const sel: RoleSelection = { kind: 'predefined', id: 'ios' };
    render(
      <Header
        roles={roles}
        selection={sel}
        selectedRoleObj={roles[0]}
        highlight={true}
        coverage={coverage(40, 100)}
        {...noopProps}
      />,
    );
    const summary = screen.getByTestId('scope-summary');
    expect(summary).toHaveTextContent('iOS Engineer');
    expect(summary).toHaveTextContent('40');
    expect(summary).toHaveTextContent('100');
    expect(summary).toHaveTextContent(/typical areas/i);
  });

  it('shows custom summary when custom selection is active', () => {
    const sel: RoleSelection = { kind: 'custom', itemIds: new Set(['a', 'b']) };
    render(
      <Header
        roles={roles}
        selection={sel}
        selectedRoleObj={null}
        highlight={true}
        coverage={coverage(2, 100)}
        {...noopProps}
      />,
    );
    const summary = screen.getByTestId('scope-summary');
    expect(summary).toHaveTextContent(/Custom selection/);
    expect(summary).toHaveTextContent('2');
    expect(summary).toHaveTextContent('100');
  });

  it('disables the highlight toggle when no selection', () => {
    render(
      <Header
        roles={roles}
        selection={null}
        selectedRoleObj={null}
        highlight={false}
        coverage={coverage(0, 100)}
        {...noopProps}
      />,
    );
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('emits role change events through onPredefinedChange', () => {
    const onPredefinedChange = vi.fn();
    render(
      <Header
        roles={roles}
        selection={null}
        selectedRoleObj={null}
        highlight={false}
        coverage={coverage(0, 100)}
        level="mid"
        onPredefinedChange={onPredefinedChange}
        onCustomChosen={() => {}}
        onEditCustom={() => {}}
        onLevelChange={() => {}}
        onHighlightChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'backend' } });
    expect(onPredefinedChange).toHaveBeenCalledWith('backend');
  });

  it('shows an "Edit custom" button when custom selection is active', () => {
    const sel: RoleSelection = { kind: 'custom', itemIds: new Set(['a']) };
    const onEditCustom = vi.fn();
    render(
      <Header
        roles={roles}
        selection={sel}
        selectedRoleObj={null}
        highlight={true}
        coverage={coverage(1, 100)}
        level="mid"
        onEditCustom={onEditCustom}
        onPredefinedChange={() => {}}
        onCustomChosen={() => {}}
        onLevelChange={() => {}}
        onHighlightChange={() => {}}
      />,
    );
    const btn = screen.getByRole('button', { name: /Edit custom/i });
    fireEvent.click(btn);
    expect(onEditCustom).toHaveBeenCalled();
  });

  it('disables the LevelSelector for null and custom selections', () => {
    const { rerender } = render(
      <Header
        roles={roles}
        selection={null}
        selectedRoleObj={null}
        highlight={false}
        coverage={coverage(0, 100)}
        {...noopProps}
      />,
    );
    // Find any radio in the level selector and check its disabled state.
    const midButtons = screen.getAllByRole('radio', { name: /Mid/i });
    expect(midButtons.find((b) => b.hasAttribute('disabled'))).toBeDefined();

    const customSel: RoleSelection = { kind: 'custom', itemIds: new Set() };
    rerender(
      <Header
        roles={roles}
        selection={customSel}
        selectedRoleObj={null}
        highlight={true}
        coverage={coverage(0, 100)}
        {...noopProps}
      />,
    );
    expect(
      screen.getAllByRole('radio', { name: /Mid/i }).find((b) => b.hasAttribute('disabled')),
    ).toBeDefined();

    const sel: RoleSelection = { kind: 'predefined', id: 'ios' };
    rerender(
      <Header
        roles={roles}
        selection={sel}
        selectedRoleObj={roles[0]}
        highlight={true}
        coverage={coverage(0, 100)}
        {...noopProps}
      />,
    );
    expect(
      screen.getAllByRole('radio', { name: /Mid/i }).every((b) => !b.hasAttribute('disabled')),
    ).toBe(true);
  });
});
