import { DEFAULT_LEVEL } from './scope';
import { LEVELS, type Level, type RoleId } from './types';

/**
 * Named profiles: persisted, reusable snapshots of a view configuration
 * (selection + level + highlight). The live session state stays in
 * `swedomainmap.state.v1` (see `useRoleSelection`) — profiles live under
 * their own key so existing users lose nothing.
 *
 * This module is pure domain: no React, no IO. The storage wiring lives in
 * `useProfiles` (presentation), which hands these functions to
 * `usePersistedState` and supplies the known role/item id sets from the data
 * layer. Downstream consumers (profile manager UI, share links) must import
 * these types rather than redefining their own.
 */

/** Selection a profile restores. Mirrors the spec contract: predefined role id or an explicit item list. */
export type ProfileSelection =
  | { readonly kind: 'predefined'; readonly id: RoleId }
  | { readonly kind: 'custom'; readonly itemIds: readonly string[] };

export interface ProfileSnapshot {
  /** Stable identity — CRUD targets profiles by id, never by index or name. */
  readonly id: string;
  /** Registry schema version, bumped only by a breaking change to this shape. */
  readonly v: 1;
  readonly name: string;
  readonly selection: ProfileSelection;
  readonly level: Level;
  readonly highlight: boolean;
  /** ISO 8601 timestamp of the last save. */
  readonly savedAt: string;
  /**
   * `computeDataVersion` of the item universe at save time. Lets the UI flag
   * profiles saved against an older dataset (items renamed/removed) instead of
   * silently showing a half-empty selection.
   */
  readonly dataVersion?: string;
}

/** Shape persisted to localStorage under `swedomainmap.profiles.v1`. */
export interface ProfilesRegistry {
  readonly v: 1;
  readonly profiles: readonly ProfileSnapshot[];
}

export const EMPTY_REGISTRY: ProfilesRegistry = { v: 1, profiles: [] };

export interface ProfileFields {
  readonly name: string;
  readonly selection: ProfileSelection;
  readonly level: Level;
  readonly highlight: boolean;
  readonly dataVersion?: string;
}

/**
 * Identity generation. Injectable paths (CRUD, snapshot creation) take ids as
 * parameters for deterministic tests; this is the production convenience.
 * `crypto.randomUUID` is available in all modern browsers; the fallback
 * covers exotic environments where it is missing.
 */
export function newProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * FNV-1a 32-bit over the item ids joined with '\n', rendered as 8 hex chars —
 * the spec's recipe for the dataset tag embedded in snapshots, share links,
 * and exports. Must never change once shipped: it is how stale links are
 * detected across deploys.
 */
export function computeDataVersion(itemIds: readonly string[]): string {
  let hash = 0x811c9dc5;
  const input = itemIds.join('\n');
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Assemble a snapshot for saving. `id` and `savedAt` default to generated
 * values; tests and callers needing determinism inject both. Names are
 * trimmed — an empty result falls back to 'Untitled' rather than storing a
 * blank label.
 */
export function createProfileSnapshot(
  fields: ProfileFields,
  id: string = newProfileId(),
  savedAt: string = new Date().toISOString(),
): ProfileSnapshot {
  const name = fields.name.trim() || 'Untitled';
  return {
    id,
    v: 1,
    name,
    selection: fields.selection,
    level: fields.level,
    highlight: fields.highlight,
    savedAt,
    ...(fields.dataVersion !== undefined ? { dataVersion: fields.dataVersion } : {}),
  };
}

/** Append a snapshot. Returns a new registry; never mutates the input. */
export function addProfile(
  registry: ProfilesRegistry,
  snapshot: ProfileSnapshot,
): ProfilesRegistry {
  return { v: 1, profiles: [...registry.profiles, snapshot] };
}

/**
 * Replace an existing profile's view config (selection/level/highlight) and
 * re-stamp `savedAt`/`dataVersion`. The name is untouched — renaming is its
 * own operation. Returns the registry unchanged when `id` is absent.
 */
export function overwriteProfile(
  registry: ProfilesRegistry,
  id: string,
  fields: Omit<ProfileFields, 'name'>,
  savedAt: string = new Date().toISOString(),
): ProfilesRegistry {
  let changed = false;
  const profiles = registry.profiles.map((p) => {
    if (p.id !== id) return p;
    changed = true;
    return {
      ...p,
      selection: fields.selection,
      level: fields.level,
      highlight: fields.highlight,
      savedAt,
      ...(fields.dataVersion !== undefined ? { dataVersion: fields.dataVersion } : {}),
    };
  });
  return changed ? { v: 1, profiles } : registry;
}

/**
 * Rename. A blank name is a no-op (the UI prevents it; the domain defends).
 * Unknown ids are no-ops so callers can setState directly.
 */
export function renameProfile(
  registry: ProfilesRegistry,
  id: string,
  name: string,
): ProfilesRegistry {
  const trimmed = name.trim();
  if (!trimmed) return registry;
  let changed = false;
  const profiles = registry.profiles.map((p) => {
    if (p.id !== id || p.name === trimmed) return p;
    changed = true;
    return { ...p, name: trimmed };
  });
  return changed ? { v: 1, profiles } : registry;
}

/** Remove by id. Unknown ids are no-ops (returns the same registry). */
export function deleteProfile(registry: ProfilesRegistry, id: string): ProfilesRegistry {
  const profiles = registry.profiles.filter((p) => p.id !== id);
  return profiles.length === registry.profiles.length
    ? registry
    : { v: 1, profiles };
}

/**
 * Copy a profile with a fresh id and `"<name> (copy)"` label, inserted right
 * after the source so it appears adjacent in the manager list. Unknown ids
 * are no-ops. `newId`/`savedAt` are injected for deterministic tests.
 */
export function duplicateProfile(
  registry: ProfilesRegistry,
  id: string,
  newId: string = newProfileId(),
  savedAt: string = new Date().toISOString(),
): ProfilesRegistry {
  const index = registry.profiles.findIndex((p) => p.id === id);
  if (index === -1) return registry;
  const source = registry.profiles[index];
  const copy: ProfileSnapshot = {
    ...source,
    id: newId,
    name: `${source.name} (copy)`,
    savedAt,
  };
  const profiles = [
    ...registry.profiles.slice(0, index + 1),
    copy,
    ...registry.profiles.slice(index + 1),
  ];
  return { v: 1, profiles };
}

/**
 * Validate-and-repair a parsed localStorage value into a clean registry.
 * Mirrors the `sanitize` discipline in `useRoleSelection`:
 * - wrong registry version or non-array `profiles` → empty registry;
 * - structurally malformed snapshots are dropped;
 * - field-level damage is repaired (bad level → `DEFAULT_LEVEL`, bad
 *   highlight → coerced, blank name → 'Untitled', bad savedAt → `now()`);
 * - unknown role ids drop the profile (its core meaning is gone); unknown
 *   item ids are filtered (the selection survives, minus the dead entries);
 * - never throws, regardless of input.
 */
export function sanitizeRegistry(
  raw: unknown,
  knownRoleIds: ReadonlySet<string>,
  knownItemIds: ReadonlySet<string>,
  now: () => string = () => new Date().toISOString(),
): ProfilesRegistry {
  if (!isRegistryShape(raw)) return EMPTY_REGISTRY;
  const profiles: ProfileSnapshot[] = [];
  const seenIds = new Set<string>();
  for (const rawProfile of raw.profiles) {
    const clean = sanitizeSnapshot(rawProfile, knownRoleIds, knownItemIds, seenIds, now);
    if (clean !== null) {
      seenIds.add(clean.id);
      profiles.push(clean);
    }
  }
  return { v: 1, profiles };
}

function isRegistryShape(raw: unknown): raw is { v: 1; profiles: readonly unknown[] } {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as Record<string, unknown>).v === 1 &&
    Array.isArray((raw as Record<string, unknown>).profiles)
  );
}

function sanitizeSnapshot(
  raw: unknown,
  knownRoleIds: ReadonlySet<string>,
  knownItemIds: ReadonlySet<string>,
  seenIds: ReadonlySet<string>,
  now: () => string,
): ProfileSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  // Identity is the one field we refuse to synthesize: an id-less or
  // duplicate-id snapshot cannot participate in CRUD, so it is dropped.
  if (typeof o.id !== 'string' || o.id === '' || seenIds.has(o.id)) return null;

  const selection = sanitizeSelection(o.selection, knownRoleIds, knownItemIds);
  if (selection === null) return null;

  const level: Level = LEVELS.includes(o.level as Level) ? (o.level as Level) : DEFAULT_LEVEL;
  return {
    id: o.id,
    v: 1,
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Untitled',
    selection,
    level,
    highlight: !!o.highlight,
    savedAt: typeof o.savedAt === 'string' && !Number.isNaN(Date.parse(o.savedAt))
      ? o.savedAt
      : now(),
    ...(typeof o.dataVersion === 'string' ? { dataVersion: o.dataVersion } : {}),
  };
}

function sanitizeSelection(
  raw: unknown,
  knownRoleIds: ReadonlySet<string>,
  knownItemIds: ReadonlySet<string>,
): ProfileSelection | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (s.kind === 'predefined') {
    // Unknown role id: the profile no longer means anything — drop it.
    return knownRoleIds.has(s.id as string)
      ? { kind: 'predefined', id: s.id as RoleId }
      : null;
  }
  if (s.kind === 'custom' && Array.isArray(s.itemIds) && s.itemIds.every((id) => typeof id === 'string')) {
    const itemIds = [...new Set(s.itemIds.filter((id) => knownItemIds.has(id)))];
    return { kind: 'custom', itemIds };
  }
  return null;
}
