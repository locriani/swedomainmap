import { describe, expect, it } from 'vitest';
import {
  ALL_BUT_EM,
  ALL_BUT_EM_DEVREL,
  APP_BUILDERS,
  DATA_PEOPLE,
  INFRA_PEOPLE,
  LEADERSHIP,
  RELIABILITY,
  SECURITY_AND_PRIVACY,
  WEB,
} from './roleGroups';
import { ALL_ROLE_IDS } from './roles';

describe('role groups', () => {
  it('every group member is a known role id', () => {
    const known = new Set(ALL_ROLE_IDS);
    const groups = {
      ALL_BUT_EM,
      ALL_BUT_EM_DEVREL,
      APP_BUILDERS,
      WEB,
      DATA_PEOPLE,
      RELIABILITY,
      INFRA_PEOPLE,
      LEADERSHIP,
      SECURITY_AND_PRIVACY,
    };
    for (const [name, members] of Object.entries(groups)) {
      for (const m of members) {
        expect(known.has(m), `${name} contains unknown role "${m}"`).toBe(true);
      }
    }
  });

  it('ALL_BUT_EM excludes em', () => {
    expect(ALL_BUT_EM).not.toContain('em');
  });

  it('ALL_BUT_EM_DEVREL excludes em and devrel', () => {
    expect(ALL_BUT_EM_DEVREL).not.toContain('em');
    expect(ALL_BUT_EM_DEVREL).not.toContain('devrel');
  });

  it('ALL_BUT_EM auto-includes new Phase 1 roles', () => {
    // Adding a role should automatically extend ALL_BUT_EM (anything that
    // writes code). Guards against accidentally forgetting to bump groups
    // when adding future roles.
    for (const r of ['sre', 'product-eng', 'dx', 'design-eng', 'a11y'] as const) {
      expect(ALL_BUT_EM).toContain(r);
    }
  });

  it('groups have no duplicate members', () => {
    const groups = [
      APP_BUILDERS,
      WEB,
      DATA_PEOPLE,
      RELIABILITY,
      INFRA_PEOPLE,
      LEADERSHIP,
      SECURITY_AND_PRIVACY,
    ];
    for (const g of groups) {
      expect(new Set(g).size).toBe(g.length);
    }
  });
});
