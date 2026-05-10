import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomRoleEditor } from './CustomRoleEditor';

describe('CustomRoleEditor', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CustomRoleEditor
        open={false}
        selectedItemIds={new Set()}
        onToggle={() => {}}
        onClear={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders categorized checkboxes when open', () => {
    render(
      <CustomRoleEditor
        open={true}
        selectedItemIds={new Set()}
        onToggle={() => {}}
        onClear={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: /Custom selection/i })).toBeInTheDocument();
    // The Languages category renders Swift among others.
    expect(screen.getByText('Swift')).toBeInTheDocument();
  });

  it('reflects selected items as checked', () => {
    render(
      <CustomRoleEditor
        open={true}
        selectedItemIds={new Set(['swift'])}
        onToggle={() => {}}
        onClear={() => {}}
        onClose={() => {}}
      />,
    );
    const checkbox = screen.getByTestId('custom-checkbox-swift') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('emits onToggle when a checkbox is clicked', () => {
    const onToggle = vi.fn();
    render(
      <CustomRoleEditor
        open={true}
        selectedItemIds={new Set()}
        onToggle={onToggle}
        onClear={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('custom-checkbox-swift'));
    expect(onToggle).toHaveBeenCalledWith('swift');
  });

  it('filters items by the search box', () => {
    render(
      <CustomRoleEditor
        open={true}
        selectedItemIds={new Set()}
        onToggle={() => {}}
        onClear={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Filter items/i), {
      target: { value: 'Swift' },
    });
    expect(screen.getByText('Swift')).toBeInTheDocument();
    // "Go" shouldn't survive the filter for "Swift".
    expect(screen.queryByText('Go')).toBeNull();
  });
});
