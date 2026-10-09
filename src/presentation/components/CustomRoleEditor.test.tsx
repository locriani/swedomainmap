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

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <CustomRoleEditor
        open={true}
        selectedItemIds={new Set()}
        onToggle={() => {}}
        onClear={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('focuses the filter input when opened and restores focus to the trigger on close', () => {
    const onClose = vi.fn();
    const ui = (open: boolean) => (
      <>
        <button type="button" data-testid="trigger">
          Edit custom
        </button>
        <CustomRoleEditor
          open={open}
          selectedItemIds={new Set()}
          onToggle={() => {}}
          onClear={() => {}}
          onClose={onClose}
        />
      </>
    );
    const { rerender } = render(ui(false));
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    rerender(ui(true));
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/Filter items/i));
    rerender(ui(false));
    expect(document.activeElement).toBe(trigger);
  });

  it('wraps Tab focus within the drawer instead of escaping to the page', () => {
    render(
      <CustomRoleEditor
        open={true}
        selectedItemIds={new Set()}
        onToggle={() => {}}
        onClear={() => {}}
        onClose={() => {}}
      />,
    );
    const checkboxes = screen.getAllByTestId(/^custom-checkbox-/);
    const lastCheckbox = checkboxes[checkboxes.length - 1] as HTMLElement;

    // Backward from the first focusable ("Clear all" — the backdrop is no
    // longer tabbable) wraps to the last checkbox.
    screen.getByRole('button', { name: 'Clear all' }).focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastCheckbox);

    // Forward from the last checkbox wraps back to the first focusable.
    lastCheckbox.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear all' }));
  });

  it('keeps the backdrop out of the tab order', () => {
    render(
      <CustomRoleEditor
        open={true}
        selectedItemIds={new Set()}
        onToggle={() => {}}
        onClear={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Close custom editor' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });
});
