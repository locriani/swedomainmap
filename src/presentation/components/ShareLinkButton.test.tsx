import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoleSelection } from '../../domain/types';
import { ShareLinkButton } from './ShareLinkButton';

const predefined: RoleSelection = { kind: 'predefined', id: 'backend' };
const custom: RoleSelection = { kind: 'custom', itemIds: new Set(['swift', 'kotlin']) };

function stubClipboard(mock: ReturnType<typeof vi.fn>) {
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: mock },
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  // Remove the stub so later suites see jsdom's default (undefined clipboard).
  delete (window.navigator as { clipboard?: unknown }).clipboard;
});

describe('ShareLinkButton', () => {
  it('is disabled when there is no selection to share', () => {
    render(<ShareLinkButton selection={null} level="mid" highlight={false} />);
    expect(screen.getByTestId('share-link-button')).toBeDisabled();
    expect(screen.queryByTestId('share-copy-status')).toBeNull();
  });

  it('is enabled for predefined and custom selections', () => {
    const { rerender } = render(<ShareLinkButton selection={predefined} level="mid" highlight={false} />);
    expect(screen.getByTestId('share-link-button')).toBeEnabled();
    rerender(<ShareLinkButton selection={custom} level="mid" highlight={false} />);
    expect(screen.getByTestId('share-link-button')).toBeEnabled();
  });

  it('copies a share link and shows copied feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<ShareLinkButton selection={predefined} level="sr" highlight={false} />);

    fireEvent.click(screen.getByTestId('share-link-button'));

    await waitFor(() =>
      expect(screen.getByTestId('share-copy-status')).toHaveTextContent('Link copied'),
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = writeText.mock.calls[0][0] as string;
    expect(url.startsWith(window.location.origin + window.location.pathname)).toBe(true);
    // Hash-only: the payload lives after '#', never in a query string.
    expect(url).toMatch(/#[01][A-Za-z0-9_-]+$/);
  });

  it('shows an error state when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubClipboard(writeText);
    render(<ShareLinkButton selection={custom} level="mid" highlight={true} />);

    fireEvent.click(screen.getByTestId('share-link-button'));

    await waitFor(() =>
      expect(screen.getByTestId('share-copy-status')).toHaveTextContent(/couldn't copy/i),
    );
    expect(screen.queryByText('Link copied!')).toBeNull();
  });

  it('reports an error when no clipboard API exists and the legacy copy fails', async () => {
    // jsdom has no navigator.clipboard; execCommand is not implemented either.
    render(<ShareLinkButton selection={predefined} level="mid" highlight={false} />);
    fireEvent.click(screen.getByTestId('share-link-button'));
    await waitFor(() =>
      expect(screen.getByTestId('share-copy-status')).toHaveTextContent(/couldn't copy/i),
    );
  });
});
