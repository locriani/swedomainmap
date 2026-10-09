import type { ProfileSnapshot } from './profiles';
import { LEVEL_LABELS, type Level, type RoleId, type RoleSelection } from './types';

/**
 * Pure helpers linking the live view (`useRoleSelection` shape) to profile
 * snapshots. Used by the profile-manager UI to detect unsaved changes and to
 * render per-profile summaries. No React, no IO.
 */

/** The live view configuration a profile snapshots and restores. */
export interface ViewSnapshot {
  readonly selection: RoleSelection | null;
  readonly level: Level;
  readonly highlight: boolean;
}

/** Canonical string for a profile selection: role identity, or the sorted item-id set. */
function selectionKey(s: ProfileSnapshot['selection']): string {
  if (s.kind === 'predefined') return `predefined:${s.id}`;
  return `custom:${[...s.itemIds].sort().join(',')}`;
}

function liveSelectionKey(s: RoleSelection | null): string | null {
  if (s === null) return null;
  if (s.kind === 'predefined') return `predefined:${s.id}`;
  return `custom:${[...s.itemIds].sort().join(',')}`;
}

/**
 * Whether the live view is exactly what the profile saved. Item order is not
 * meaningful (the live custom view is a set), so custom selections compare as
 * sorted id lists; level and highlight must match exactly.
 */
export function viewsMatch(view: ViewSnapshot, profile: ProfileSnapshot): boolean {
  return (
    liveSelectionKey(view.selection) === selectionKey(profile.selection) &&
    view.level === profile.level &&
    view.highlight === profile.highlight
  );
}

/**
 * One-line description of a profile's contents for the manager list:
 * "Backend Engineer · Senior" for predefined roles, "N items" for custom
 * selections. `resolveRoleName` maps a role id to its display name (the data
 * layer owns `ROLES`; the domain layer must not import it).
 */
export function profileSummary(
  profile: ProfileSnapshot,
  resolveRoleName: (id: RoleId) => string,
): string {
  if (profile.selection.kind === 'predefined') {
    return `${resolveRoleName(profile.selection.id)} · ${LEVEL_LABELS[profile.level]}`;
  }
  const count = profile.selection.itemIds.length;
  return `${count} item${count === 1 ? '' : 's'}`;
}
