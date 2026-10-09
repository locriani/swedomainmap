import type { ProfileFields, ProfileSnapshot } from './profiles';
import { DEFAULT_LEVEL } from './scope';
import { LEVELS, LEVEL_LABELS, type Level, type RoleId } from './types';

/**
 * Export/import of profile snapshots as `.json` files — the file-based half
 * of the spec's sharing story (the URL-hash half is the share-links PR).
 *
 * Export format: `{ kind, v, profile }`. Import is deliberately lenient: it
 * accepts both the wrapper and a bare snapshot, repairs field-level damage,
 * and reports every drop instead of silently cleaning (spec's stale-data
 * discipline). Malformed input produces an error string for inline display —
 * it never throws and never crashes the UI.
 */

export const EXPORT_FORMAT = 'swedomainmap-profile';

/** Wrapper written to exported `.json` files. */
export interface ExportFile {
  readonly kind: typeof EXPORT_FORMAT;
  readonly v: 1;
  readonly profile: ProfileSnapshot;
}

export function buildExportFile(profile: ProfileSnapshot): ExportFile {
  return { kind: EXPORT_FORMAT, v: 1, profile };
}

export type ImportResult =
  /** Parsed and validated; `fields` feeds `useProfiles.saveProfile`, which
   * mints a fresh id and re-stamps `dataVersion` for the current dataset. */
  | { readonly ok: true; readonly fields: ProfileFields; readonly notes: readonly string[] }
  /** Human-readable reason the file was rejected; shown inline, never a crash. */
  | { readonly ok: false; readonly error: string };

/**
 * Parse the text of a profile-export file into `ProfileFields`, validated
 * against the current dataset. Accepts the `{ kind, v, profile }` wrapper or
 * a bare snapshot. Repairs: bad level → `DEFAULT_LEVEL`, blank name →
 * 'Untitled', unparseable `savedAt` is dropped (a fresh one is stamped on
 * save). Drops: unknown item ids (filtered, reported). Refuses: unknown role
 * ids (the profile's core meaning is gone) and structurally wrong documents.
 */
export function parseImportedProfile(
  text: string,
  knownRoleIds: ReadonlySet<string>,
  knownItemIds: ReadonlySet<string>,
  currentDataVersion?: string,
): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON — is it really a profile export?' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'This file does not contain a swedomainmap profile.' };
  }
  const o = parsed as Record<string, unknown>;
  // Unwrap the standard export wrapper if present; otherwise treat the whole
  // document as a bare snapshot (lenient toward hand-edited files).
  const rawProfile =
    typeof o.profile === 'object' && o.profile !== null ? o.profile : o;
  const p = rawProfile as Record<string, unknown>;

  const notes: string[] = [];
  if (typeof p.name !== 'string' || !p.name.trim()) {
    notes.push('The profile had no usable name — it was saved as "Untitled".');
  }
  if (p.level !== undefined && !LEVELS.includes(p.level as Level)) {
    notes.push(`The profile had an unrecognized level — it was reset to ${LEVEL_LABELS[DEFAULT_LEVEL]}.`);
  }

  const selection = parseSelection(p.selection, knownRoleIds, knownItemIds, notes);
  if (typeof selection === 'string') return { ok: false, error: selection };
  if (selection === null) {
    return { ok: false, error: 'This file does not contain a swedomainmap profile.' };
  }

  if (
    typeof p.dataVersion === 'string' &&
    currentDataVersion !== undefined &&
    p.dataVersion !== currentDataVersion
  ) {
    notes.push(
      'The profile was saved against an older version of the map — some items may have changed.',
    );
  }

  const fields: ProfileFields = {
    name: typeof p.name === 'string' ? p.name : '',
    selection,
    level: LEVELS.includes(p.level as Level) ? (p.level as Level) : DEFAULT_LEVEL,
    highlight: !!p.highlight,
  };
  return { ok: true, fields, notes };
}

/**
 * Validate a raw selection against the current dataset.
 * Returns the cleaned selection, an error message (string), or null when the
 * document simply has no selection at all.
 */
function parseSelection(
  raw: unknown,
  knownRoleIds: ReadonlySet<string>,
  knownItemIds: ReadonlySet<string>,
  notes: string[],
): ProfileFields['selection'] | null | string {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (s.kind === 'predefined') {
    if (typeof s.id === 'string' && knownRoleIds.has(s.id)) {
      return { kind: 'predefined', id: s.id as RoleId };
    }
    return `This profile references role "${String(s.id)}", which does not exist in the current version of the map. It cannot be imported.`;
  }
  if (s.kind === 'custom' && Array.isArray(s.itemIds) && s.itemIds.every((id) => typeof id === 'string')) {
    const itemIds = s.itemIds.filter((id) => knownItemIds.has(id));
    const dropped = s.itemIds.length - itemIds.length;
    if (dropped > 0) {
      notes.push(
        `Dropped ${dropped} unknown item${dropped === 1 ? '' : 's'} that no longer exist in the map.`,
      );
    }
    return { kind: 'custom', itemIds };
  }
  return null;
}

/** Suggested download filename for an exported profile. */
export function exportFileName(profile: ProfileSnapshot): string {
  const base = profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'profile'}.json`;
}
