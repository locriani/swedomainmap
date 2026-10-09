import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { CATEGORIES } from '../../data/categories';
import { ROLES, roleById } from '../../data/roles';
import {
  buildShareContext,
  decodeShareLink,
  roleSelectionFromShareSelection,
  type ShareLinkFailure,
  type ShareLinkPayload,
  type StaleShareInfo,
} from '../../domain/share';
import { LEVEL_LABELS, type Level, type RoleSelection } from '../../domain/types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
  /** Applies the decoded share link to the app's live state. */
  onApply: (selection: RoleSelection, level: Level, highlight: boolean) => void;
}

type ShareDialog =
  | { kind: 'ready'; payload: ShareLinkPayload; stale: StaleShareInfo | null }
  | { kind: 'unrecognized'; failure: ShareLinkFailure };

const TOTAL_ITEMS = CATEGORIES.reduce((n, c) => n + c.items.length, 0);

/**
 * Watches the URL hash for share links (on mount and on hashchange), previews
 * what the link contains, and applies it on confirm. Self-contained: App only
 * mounts this component and supplies the apply callback. The hash is cleared
 * on both apply and dismiss so a refresh doesn't re-prompt.
 */
export function ShareLinkPreview({ onApply }: Props) {
  const [dialog, setDialog] = useState<ShareDialog | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useFocusTrap({
    active: dialog !== null,
    containerRef: dialogRef,
    initialFocusRef: primaryButtonRef,
  });

  useEffect(() => {
    const shareContext = buildShareContext(CATEGORIES, ROLES.map((r) => r.id));
    let cancelled = false;
    const checkHash = () => {
      const hash = window.location.hash;
      if (!hash || hash === '#') {
        setDialog(null);
        return;
      }
      decodeShareLink(hash, shareContext).then((result) => {
        if (cancelled) return;
        setDialog(
          result.ok
            ? { kind: 'ready', payload: result.payload, stale: result.stale }
            : { kind: 'unrecognized', failure: result.failure },
        );
      });
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', checkHash);
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dialog]);

  const closeDialog = () => {
    setDialog(null);
    clearShareHash();
  };

  const handleApply = () => {
    if (!dialog || dialog.kind !== 'ready') return;
    onApply(
      roleSelectionFromShareSelection(dialog.payload.selection, dialog.payload.name),
      dialog.payload.level,
      dialog.payload.highlight,
    );
    closeDialog();
  };

  if (!dialog) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="share-preview"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={closeDialog}
        tabIndex={-1}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-lg shadow-2xl p-5"
      >
        {dialog.kind === 'ready' ? (
          <ReadyContent
            payload={dialog.payload}
            stale={dialog.stale}
            titleId={titleId}
            onApply={handleApply}
            onClose={closeDialog}
            primaryButtonRef={primaryButtonRef}
          />
        ) : (
          <UnrecognizedContent
            failure={dialog.failure}
            titleId={titleId}
            onClose={closeDialog}
            dismissButtonRef={primaryButtonRef}
          />
        )}
      </div>
    </div>
  );
}

interface ReadyContentProps {
  payload: ShareLinkPayload;
  stale: StaleShareInfo | null;
  titleId: string;
  onApply: () => void;
  onClose: () => void;
  primaryButtonRef: RefObject<HTMLButtonElement>;
}

function ReadyContent({
  payload,
  stale,
  titleId,
  onApply,
  onClose,
  primaryButtonRef,
}: ReadyContentProps) {
  const { selection } = payload;
  return (
    <>
      <h2 id={titleId} className="text-slate-100 font-semibold">
        Apply shared view
      </h2>
      {payload.name && (
        <p className="text-sm text-emerald-300 mt-1" data-testid="share-preview-name">
          Shared profile: “{payload.name}”
        </p>
      )}
      <dl className="mt-3 space-y-1.5 text-sm" data-testid="share-preview-summary">
        {selection.kind === 'predefined' ? (
          <div className="flex gap-2">
            <dt className="text-slate-400 shrink-0">Role</dt>
            <dd className="text-slate-200">{roleById(selection.id)?.name ?? selection.id}</dd>
          </div>
        ) : (
          <div className="flex gap-2">
            <dt className="text-slate-400 shrink-0">Selection</dt>
            <dd className="text-slate-200">
              Custom — {selection.itemIds.length} of {TOTAL_ITEMS} areas
            </dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-slate-400 shrink-0">Level</dt>
          <dd className="text-slate-200">{LEVEL_LABELS[payload.level]}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-400 shrink-0">Highlighting</dt>
          <dd className="text-slate-200">{payload.highlight ? 'On' : 'Off'}</dd>
        </div>
      </dl>
      {stale && (
        <p
          className="mt-3 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md p-3"
          data-testid="share-stale-notice"
        >
          {staleMessage(stale)}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          data-testid="share-preview-cancel"
          className="text-sm rounded-md border border-slate-700 bg-slate-900 text-slate-200 px-3 py-1.5 hover:bg-slate-800 focus:outline-none focus:border-emerald-500"
        >
          Cancel
        </button>
        <button
          ref={primaryButtonRef}
          type="button"
          onClick={onApply}
          data-testid="share-preview-apply"
          className="text-sm rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-3 py-1.5 hover:bg-emerald-500/20 focus:outline-none focus:border-emerald-500"
        >
          Apply view
        </button>
      </div>
    </>
  );
}

interface UnrecognizedContentProps {
  failure: ShareLinkFailure;
  titleId: string;
  onClose: () => void;
  dismissButtonRef: RefObject<HTMLButtonElement>;
}

function UnrecognizedContent({ failure, titleId, onClose, dismissButtonRef }: UnrecognizedContentProps) {
  return (
    <>
      <h2 id={titleId} className="text-slate-100 font-semibold">
        Share link not recognized
      </h2>
      <p className="mt-2 text-sm text-slate-400" data-testid="share-preview-error">
        {failureMessage(failure)}
      </p>
      <div className="mt-4 flex justify-end">
        <button
          ref={dismissButtonRef}
          type="button"
          onClick={onClose}
          data-testid="share-preview-dismiss"
          className="text-sm rounded-md border border-slate-700 bg-slate-900 text-slate-200 px-3 py-1.5 hover:bg-slate-800 focus:outline-none focus:border-emerald-500"
        >
          Dismiss
        </button>
      </div>
    </>
  );
}

function staleMessage(stale: StaleShareInfo): string {
  const base = 'This link was created with an older version of the map.';
  const count = stale.droppedItemCount;
  if (count > 0) {
    return `${base} ${count} item${count === 1 ? '' : 's'} in it no longer exists${count === 1 ? 's' : ''} and will be skipped.`;
  }
  return `${base} The selection may not match the one originally shared.`;
}

function failureMessage(failure: ShareLinkFailure): string {
  switch (failure.reason) {
    case 'malformed':
      return 'This is not a valid share link. The current view is unchanged.';
    case 'unsupported-version':
      return `This link uses share format v${failure.version}, which this app can't read. The current view is unchanged.`;
    case 'unknown-role':
      return `This link refers to a role ("${failure.roleId}") that no longer exists. The current view is unchanged.`;
  }
}

function clearShareHash(): void {
  // replaceState (not location.hash = '') so nothing is pushed to history and
  // no hashchange fires — an applied view persists via localStorage, and a
  // dismissed link shouldn't re-prompt on refresh.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
