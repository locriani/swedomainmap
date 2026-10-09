import { useCallback, useMemo } from 'react';
import { CATEGORIES } from '../../data/categories';
import { ROLES } from '../../data/roles';
import {
  addProfile,
  computeDataVersion,
  createProfileSnapshot,
  deleteProfile,
  duplicateProfile,
  newProfileId,
  overwriteProfile,
  renameProfile,
  sanitizeRegistry,
} from '../../domain/profiles';
import type {
  ProfileFields,
  ProfileSelection,
  ProfileSnapshot,
  ProfilesRegistry,
} from '../../domain/profiles';
import { usePersistedState } from './usePersistedState';

/**
 * Storage + hook for named profiles, persisted under their own key so the
 * live session state (`swedomainmap.state.v1`) is never touched. Follows the
 * `useRoleSelection` pattern: load-time sanitization against the known
 * role/item ids, debounced writes via `usePersistedState`, and storage
 * failures swallowed (private mode / quota must never crash the app).
 *
 * This hook owns the registry only — applying a profile to the live view is
 * the profile-manager UI's job (it composes with `useRoleSelection`).
 */

const STORAGE_KEY = 'swedomainmap.profiles.v1';

export interface UseProfiles {
  /** All saved profiles, in registry (save) order. */
  profiles: readonly ProfileSnapshot[];
  /**
   * Create a profile from the current view. Stamps id, savedAt, and the
   * dataset data-version, appends it, and returns the created snapshot.
   */
  saveProfile: (fields: ProfileFields) => ProfileSnapshot;
  /** Write the current view onto an existing profile (name unchanged). */
  overwriteProfile: (id: string, fields: Omit<ProfileFields, 'name'>) => void;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  /** Copy an existing profile as `"<name> (copy)"` with a fresh id. */
  duplicateProfile: (id: string) => void;
}

export function useProfiles(): UseProfiles {
  const knownItemIds = useMemo(
    () => new Set(CATEGORIES.flatMap((c) => c.items.map((i) => i.id))),
    [],
  );
  const knownRoleIds = useMemo(() => new Set(ROLES.map((r) => r.id)), []);
  // One pass over the item universe; stable for the lifetime of the page.
  const dataVersion = useMemo(
    () => computeDataVersion(CATEGORIES.flatMap((c) => c.items.map((i) => i.id))),
    [],
  );

  const [registry, setRegistry] = usePersistedState<ProfilesRegistry>(
    STORAGE_KEY,
    { v: 1, profiles: [] },
    (raw) => sanitizeRegistry(raw, knownRoleIds, knownItemIds),
  );

  const saveProfile = useCallback(
    (fields: ProfileFields): ProfileSnapshot => {
      const snapshot = createProfileSnapshot({ ...fields, dataVersion });
      setRegistry((prev) => addProfile(prev, snapshot));
      return snapshot;
    },
    [setRegistry, dataVersion],
  );

  const overwrite = useCallback(
    (id: string, fields: Omit<ProfileFields, 'name'>) =>
      setRegistry((prev) => overwriteProfile(prev, id, { ...fields, dataVersion })),
    [setRegistry, dataVersion],
  );

  const rename = useCallback(
    (id: string, name: string) => setRegistry((prev) => renameProfile(prev, id, name)),
    [setRegistry],
  );

  const remove = useCallback(
    (id: string) => setRegistry((prev) => deleteProfile(prev, id)),
    [setRegistry],
  );

  const duplicate = useCallback(
    (id: string) =>
      setRegistry((prev) =>
        duplicateProfile(prev, id, newProfileId(), new Date().toISOString()),
      ),
    [setRegistry],
  );

  return {
    profiles: registry.profiles,
    saveProfile,
    overwriteProfile: overwrite,
    renameProfile: rename,
    deleteProfile: remove,
    duplicateProfile: duplicate,
  };
}

/** Re-exported so downstream PRs share one import site for selection types. */
export type { ProfileSelection, ProfileSnapshot, ProfilesRegistry };
