import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES } from '../../data/categories';
import { ROLES } from '../../data/roles';
import {
  buildShareContext,
  encodeShareLink,
  sharePayloadFromRoleSelection,
} from '../../domain/share';
import type { Level, RoleSelection } from '../../domain/types';

interface Props {
  selection: RoleSelection | null;
  level: Level;
  highlight: boolean;
}

type CopyState = 'idle' | 'copied' | 'error';

const RESET_MS = 2000;

/**
 * "Copy share link" — encodes the current view (selection, level, highlight)
 * into a compact URL-hash link and copies it, with visible feedback.
 * Self-contained by design (merge-surface rule): the Header only mounts this
 * component; all encoding lives in `domain/share`.
 */
export function ShareLinkButton({ selection, level, highlight }: Props) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<number | null>(null);
  const shareContext = useMemo(
    () => buildShareContext(CATEGORIES, ROLES.map((r) => r.id)),
    [],
  );

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const canShare = selection !== null;

  const handleCopy = async () => {
    const payload = sharePayloadFromRoleSelection(selection, level, highlight);
    if (!payload) return;
    const encoded = await encodeShareLink(payload, shareContext);
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    const copied = await copyToClipboard(url);
    setCopyState(copied ? 'copied' : 'error');
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), RESET_MS);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!canShare}
        data-testid="share-link-button"
        title={
          canShare
            ? 'Copy a link that restores this exact view'
            : 'Pick a role or start a custom selection to share'
        }
        className="text-sm rounded-md border border-slate-700 bg-slate-900 text-slate-200 px-2.5 py-2 sm:py-1.5 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-emerald-500"
      >
        Copy share link
      </button>
      {copyState !== 'idle' && (
        <span role="status" data-testid="share-copy-status" className="text-xs text-slate-400">
          {copyState === 'copied' ? 'Link copied!' : "Couldn't copy the link"}
        </span>
      )}
    </>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path (permission denied, insecure context)
    }
  }
  return legacyCopy(text);
}

/**
 * `document.execCommand('copy')` is deprecated but is the only clipboard
 * mechanism in non-secure contexts (plain http), where this app can be served.
 */
function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch {
    succeeded = false;
  }
  textarea.remove();
  return succeeded;
}
