/**
 * Reusable role-id groupings, extracted from `categories.ts` so they're testable
 * and reusable across data and UI. Each group is a curated set of role ids with
 * a clear meaning — adding a new role is then often "append to the right group"
 * and ~30-50 items pick it up automatically through spread (`...DATA_PEOPLE`).
 *
 * Convention: every group is a `readonly RoleId[]` validated by
 * `as const satisfies readonly RoleId[]` so TypeScript flags typos.
 */

import { ALL_ROLE_IDS } from './roles';
import type { RoleId } from '../domain/types';

const ALL = ALL_ROLE_IDS;

/** Everyone who writes code (excludes EM). Use for foundational items. */
export const ALL_BUT_EM: readonly RoleId[] = ALL.filter((r) => r !== 'em');

/** Everyone who writes code, excluding EM and DevRel (whose use is downstream). */
export const ALL_BUT_EM_DEVREL: readonly RoleId[] = ALL.filter(
  (r) => r !== 'em' && r !== 'devrel',
);

/** Roles that ship user-facing apps on a target platform. */
export const APP_BUILDERS = [
  'ios',
  'android',
  'frontend',
  'backend',
  'fullstack',
  'game',
  'xr',
  'blockchain',
  'embedded',
  'product-eng',
  'design-eng',
] as const satisfies readonly RoleId[];

/** Web-flavored roles (browser-side or web-adjacent). */
export const WEB = [
  'frontend',
  'fullstack',
  'backend',
  'devrel',
  'product-eng',
  'design-eng',
] as const satisfies readonly RoleId[];

/** Roles whose primary work is data movement, modeling, or modeling outcomes. */
export const DATA_PEOPLE = [
  'data-eng',
  'data-sci',
  'analytics-eng',
  'ml',
  'mlops',
] as const satisfies readonly RoleId[];

/** Roles that run production systems and care about uptime / latency / cost. */
export const RELIABILITY = [
  'sre',
  'obs',
  'perf',
  'devops',
  'platform',
] as const satisfies readonly RoleId[];

/** Cloud + ops + platform — anyone who provisions or operates infrastructure. */
export const INFRA_PEOPLE = [
  'devops',
  'platform',
  'cloud',
  'sre',
] as const satisfies readonly RoleId[];

/** Senior-IC and management roles — set technical or organizational direction. */
export const LEADERSHIP = ['em', 'staff', 'arch'] as const satisfies readonly RoleId[];

/** Roles whose primary deliverable is a security or compliance outcome. */
export const SECURITY_AND_PRIVACY = [
  'security',
  'privacy',
] as const satisfies readonly RoleId[];
