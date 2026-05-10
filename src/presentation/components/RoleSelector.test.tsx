import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoleSelector } from './RoleSelector';
import type { Role, RoleSelection } from '../../domain/types';

const roles: Role[] = [
  { id: 'ios', name: 'iOS Engineer', description: '' },
  { id: 'backend', name: 'Backend Engineer', description: '' },
];

const noop = {
  onPredefinedChange: () => {},
  onCustomChosen: () => {},
};

describe('RoleSelector', () => {
  it('renders all roles plus none and custom options', () => {
    render(<RoleSelector roles={roles} selection={null} {...noop} />);
    expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '— None —' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Custom selection/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'iOS Engineer' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Backend Engineer' })).toBeInTheDocument();
  });

  it('reflects current predefined value', () => {
    const sel: RoleSelection = { kind: 'predefined', id: 'backend' };
    render(<RoleSelector roles={roles} selection={sel} {...noop} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('backend');
  });

  it('reflects custom selection in the dropdown', () => {
    const sel: RoleSelection = { kind: 'custom', itemIds: new Set() };
    render(<RoleSelector roles={roles} selection={sel} {...noop} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('__custom__');
  });

  it('emits role id when selecting a predefined option', () => {
    const onPredefinedChange = vi.fn();
    render(
      <RoleSelector
        roles={roles}
        selection={null}
        onPredefinedChange={onPredefinedChange}
        onCustomChosen={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ios' } });
    expect(onPredefinedChange).toHaveBeenCalledWith('ios');
  });

  it('emits null when selecting the none option', () => {
    const sel: RoleSelection = { kind: 'predefined', id: 'ios' };
    const onPredefinedChange = vi.fn();
    render(
      <RoleSelector
        roles={roles}
        selection={sel}
        onPredefinedChange={onPredefinedChange}
        onCustomChosen={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onPredefinedChange).toHaveBeenCalledWith(null);
  });

  it('calls onCustomChosen when picking the custom option', () => {
    const onCustomChosen = vi.fn();
    render(
      <RoleSelector
        roles={roles}
        selection={null}
        onPredefinedChange={() => {}}
        onCustomChosen={onCustomChosen}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__custom__' } });
    expect(onCustomChosen).toHaveBeenCalled();
  });
});
