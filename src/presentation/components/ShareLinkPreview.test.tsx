import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES } from '../../data/categories';
import { ROLES } from '../../data/roles';
import {
  buildShareContext,
  encodeShareLinkRaw,
  stableItemIds,
  type ShareCodecContext,
} from '../../domain/share';
import { ShareLinkPreview } from './ShareLinkPreview';

const ctx: ShareCodecContext = buildShareContext(CATEGORIES, ROLES.map((r) => r.id));
const ALL_ITEM_IDS = stableItemIds(CATEGORIES);

function setHash(hash: string) {
  window.location.hash = hash;
}

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname);
});

describe('ShareLinkPreview', () => {
  it('renders nothing when there is no hash', () => {
    setHash('');
    render(<ShareLinkPreview onApply={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('previews a predefined-role link and applies it on confirm', async () => {
    const encoded = encodeShareLinkRaw(
      { selection: { kind: 'predefined', id: 'backend' }, level: 'sr', highlight: true },
      ctx,
    );
    setHash(encoded);
    const onApply = vi.fn();
    render(<ShareLinkPreview onApply={onApply} />);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const summary = screen.getByTestId('share-preview-summary');
    expect(summary).toHaveTextContent('Backend Engineer');
    expect(summary).toHaveTextContent('Senior');
    expect(summary).toHaveTextContent('On');

    fireEvent.click(screen.getByTestId('share-preview-apply'));
    expect(onApply).toHaveBeenCalledWith({ kind: 'predefined', id: 'backend' }, 'sr', true);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.location.hash).toBe('');
  });

  it('previews a custom-selection link, showing the name and count, and applies it', async () => {
    const ids = [ALL_ITEM_IDS[0], ALL_ITEM_IDS[1], ALL_ITEM_IDS[2]];
    const encoded = encodeShareLinkRaw(
      {
        selection: { kind: 'custom', itemIds: ids },
        level: 'mid',
        highlight: false,
        name: 'Team roadmap',
      },
      ctx,
    );
    setHash(encoded);
    const onApply = vi.fn();
    render(<ShareLinkPreview onApply={onApply} />);

    await screen.findByRole('dialog');
    expect(screen.getByTestId('share-preview-name')).toHaveTextContent('Team roadmap');
    expect(screen.getByTestId('share-preview-summary')).toHaveTextContent('3 of');
    expect(screen.getByTestId('share-preview-summary')).toHaveTextContent('Off');

    fireEvent.click(screen.getByTestId('share-preview-apply'));
    expect(onApply).toHaveBeenCalledWith(
      { kind: 'custom', itemIds: new Set(ids), name: 'Team roadmap' },
      'mid',
      false,
    );
    expect(window.location.hash).toBe('');
  });

  it('warns about stale links and applies only the surviving items', async () => {
    // The link's original dataset had three items the current dataset lacks.
    const oldCtx: ShareCodecContext = {
      itemIds: [...ALL_ITEM_IDS, 'ghost-a', 'ghost-b', 'ghost-c'],
      knownRoleIds: ctx.knownRoleIds,
    };
    const encoded = encodeShareLinkRaw(
      {
        selection: { kind: 'custom', itemIds: ['ghost-a', ALL_ITEM_IDS[5]] },
        level: 'mid',
        highlight: true,
      },
      oldCtx,
    );
    setHash(encoded);
    const onApply = vi.fn();
    render(<ShareLinkPreview onApply={onApply} />);

    await screen.findByRole('dialog');
    expect(screen.getByTestId('share-stale-notice')).toHaveTextContent(/older version/i);
    expect(screen.getByTestId('share-stale-notice')).toHaveTextContent('1 item');

    fireEvent.click(screen.getByTestId('share-preview-apply'));
    expect(onApply).toHaveBeenCalledWith(
      { kind: 'custom', itemIds: new Set([ALL_ITEM_IDS[5]]) },
      'mid',
      true,
    );
  });

  it('shows a clear error for a malformed hash and changes nothing', async () => {
    setHash('garbage-not-a-link');
    const onApply = vi.fn();
    render(<ShareLinkPreview onApply={onApply} />);

    await screen.findByRole('dialog');
    expect(screen.getByTestId('share-preview-error')).toHaveTextContent(/not a valid share link/i);

    fireEvent.click(screen.getByTestId('share-preview-dismiss'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onApply).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('shows an error instead of crashing on junk that parses to a short body', async () => {
    setHash('#0AAAA'); // valid base64, but far too short to be a payload
    render(<ShareLinkPreview onApply={vi.fn()} />);
    await screen.findByRole('dialog');
    expect(screen.getByTestId('share-preview-error').textContent).toMatch(
      /not a valid share link|can't read/i,
    );
    expect(screen.queryByTestId('share-stale-notice')).toBeNull();
  });

  it('closes on Escape without applying', async () => {
    const encoded = encodeShareLinkRaw(
      { selection: { kind: 'predefined', id: 'ios' }, level: 'mid', highlight: true },
      ctx,
    );
    setHash(encoded);
    const onApply = vi.fn();
    render(<ShareLinkPreview onApply={onApply} />);

    await screen.findByRole('dialog');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onApply).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('moves focus into the dialog when it opens', async () => {
    const encoded = encodeShareLinkRaw(
      { selection: { kind: 'predefined', id: 'ios' }, level: 'mid', highlight: true },
      ctx,
    );
    setHash(encoded);
    render(<ShareLinkPreview onApply={vi.fn()} />);

    await screen.findByRole('dialog');
    await waitFor(() => expect(screen.getByTestId('share-preview-apply')).toHaveFocus());
  });
});
