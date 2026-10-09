import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FirstRunHint } from './FirstRunHint';

const STORAGE_KEY = 'swedomainmap.hints.v1';

afterEach(() => {
  window.localStorage.clear();
});

describe('FirstRunHint', () => {
  it('renders by default and explains all three controls', () => {
    render(<FirstRunHint />);
    expect(screen.getByTestId('first-run-hint')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Highlight scope')).toBeInTheDocument();
  });

  it('hides after dismissal', () => {
    render(<FirstRunHint />);
    fireEvent.click(screen.getByTestId('dismiss-hint'));
    expect(screen.queryByTestId('first-run-hint')).toBeNull();
  });

  it('persists dismissal across remounts', async () => {
    const { unmount } = render(<FirstRunHint />);
    fireEvent.click(screen.getByTestId('dismiss-hint'));
    // The write is debounced (usePersistedState) — wait for it to flush.
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull());
    unmount();
    render(<FirstRunHint />);
    expect(screen.queryByTestId('first-run-hint')).toBeNull();
  });

  it('reappears when the stored value is malformed, instead of crashing', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    render(<FirstRunHint />);
    expect(screen.getByTestId('first-run-hint')).toBeInTheDocument();
  });

  it('reappears when the stored shape is invalid', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, dismissed: 'yes' }));
    render(<FirstRunHint />);
    expect(screen.getByTestId('first-run-hint')).toBeInTheDocument();
  });
});
