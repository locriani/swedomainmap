import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

function Harness({ active, withInitial }: { active: boolean; withInitial?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialRef = useRef<HTMLInputElement>(null);
  useFocusTrap({
    active,
    containerRef,
    initialFocusRef: withInitial ? initialRef : undefined,
  });
  return (
    <div>
      <button type="button" data-testid="trigger">
        Trigger
      </button>
      <div ref={containerRef} data-testid="container">
        <button type="button" data-testid="first">
          First
        </button>
        {withInitial && <input data-testid="initial" ref={initialRef} />}
        <button type="button" data-testid="last">
          Last
        </button>
      </div>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first focusable element on activation', () => {
    const { rerender } = render(<Harness active={false} />);
    rerender(<Harness active={true} />);
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('focuses the initialFocusRef element when provided', () => {
    const { rerender } = render(<Harness active={false} withInitial={true} />);
    rerender(<Harness active={true} withInitial={true} />);
    expect(document.activeElement).toBe(screen.getByTestId('initial'));
  });

  it('wraps forward from the last focusable element to the first', () => {
    const { rerender } = render(<Harness active={false} />);
    rerender(<Harness active={true} />);
    screen.getByTestId('last').focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('wraps backward from the first focusable element to the last', () => {
    const { rerender } = render(<Harness active={false} />);
    rerender(<Harness active={true} />);
    screen.getByTestId('first').focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('last'));
  });

  it('pulls focus back in when it escapes the container', () => {
    const { rerender } = render(<Harness active={false} />);
    rerender(<Harness active={true} />);
    // Simulate focus landing outside the trap (e.g. on <body>).
    (document.activeElement as HTMLElement)?.blur();
    expect(document.activeElement).not.toBe(screen.getByTestId('first'));
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('restores focus to the pre-activation element on deactivation', () => {
    const { rerender } = render(<Harness active={false} />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    rerender(<Harness active={true} />);
    expect(document.activeElement).not.toBe(trigger);
    rerender(<Harness active={false} />);
    expect(document.activeElement).toBe(trigger);
  });

  it('does not crash when the restore target unmounts together with the trap', () => {
    const { rerender, unmount } = render(<Harness active={false} />);
    screen.getByTestId('trigger').focus();
    rerender(<Harness active={true} />);
    // Unmounting removes the trigger too — the guarded restore must be a
    // no-op, not a throw (the restore-to-trigger path is covered above).
    expect(() => unmount()).not.toThrow();
  });
});
