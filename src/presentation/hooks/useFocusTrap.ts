import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface FocusTrapOptions {
  /** Whether the trap is engaged (e.g. the dialog is open). */
  active: boolean;
  /** Element whose focusable descendants form the trap boundary. */
  containerRef: RefObject<HTMLElement>;
  /** Optional element to focus on activation; defaults to the first focusable. */
  initialFocusRef?: RefObject<HTMLElement>;
}

/**
 * Keyboard focus trap for modal surfaces, with focus restore on close.
 *
 * While `active`, Tab and Shift+Tab cycle within the container (forward from
 * the last focusable lands on the first, backward from the first lands on the
 * last) and focus that escapes the container is pulled back in. On activation
 * the previously focused element is remembered; on deactivation or unmount
 * focus returns to it so keyboard users aren't dropped at the top of the page.
 *
 * Escape/backdrop close remain the caller's responsibility — this hook only
 * owns Tab behavior and focus handoff. No dependency on a focus-trap library
 * (locked decision: no new npm dependencies).
 */
export function useFocusTrap({ active, containerRef, initialFocusRef }: FocusTrapOptions): void {
  const restoreToRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Remember where focus came from so we can hand it back on close.
    restoreToRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const target = initialFocusRef?.current;
    if (target) target.focus();
    else firstFocusableIn(container)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const current = document.activeElement;
      const inside = current instanceof HTMLElement && container.contains(current);
      if (!inside) {
        // Focus escaped the container (or sits on <body>) — pull it back in.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const restoreTo = restoreToRef.current;
      restoreToRef.current = null;
      // The trigger may have unmounted while the surface was open.
      if (restoreTo && document.contains(restoreTo)) restoreTo.focus();
    };
  }, [active, containerRef, initialFocusRef]);
}

function firstFocusableIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
}
