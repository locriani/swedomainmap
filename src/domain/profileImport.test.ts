import { describe, expect, it } from 'vitest';
import type { ProfileSnapshot } from './profiles';
import { buildExportFile, exportFileName, parseImportedProfile } from './profileImport';

const KNOWN_ROLES = new Set(['backend', 'ios']);
const KNOWN_ITEMS = new Set(['swift', 'lang-c']);

const bareSnapshot: ProfileSnapshot = {
  id: 'abc',
  v: 1,
  name: 'My profile',
  selection: { kind: 'predefined', id: 'backend' },
  level: 'sr',
  highlight: true,
  savedAt: '2026-01-01T00:00:00Z',
};

describe('parseImportedProfile', () => {
  it('parses the standard export wrapper', () => {
    const text = JSON.stringify({ kind: 'swedomainmap-profile', v: 1, profile: bareSnapshot });
    const result = parseImportedProfile(text, KNOWN_ROLES, KNOWN_ITEMS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.name).toBe('My profile');
    expect(result.fields.selection).toEqual({ kind: 'predefined', id: 'backend' });
    expect(result.fields.level).toBe('sr');
    expect(result.fields.highlight).toBe(true);
    expect(result.notes).toEqual([]);
  });

  it('accepts a bare snapshot without the wrapper', () => {
    const result = parseImportedProfile(JSON.stringify(bareSnapshot), KNOWN_ROLES, KNOWN_ITEMS);
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON with a clear error', () => {
    const result = parseImportedProfile('{not-json', KNOWN_ROLES, KNOWN_ITEMS);
    expect(result).toMatchObject({ ok: false, error: /not valid JSON/i });
  });

  it('rejects documents without a selection', () => {
    const result = parseImportedProfile(JSON.stringify({ foo: 1 }), KNOWN_ROLES, KNOWN_ITEMS);
    expect(result).toMatchObject({ ok: false, error: /does not contain/i });
  });

  it('rejects primitive documents', () => {
    expect(parseImportedProfile('"just a string"', KNOWN_ROLES, KNOWN_ITEMS).ok).toBe(false);
    expect(parseImportedProfile('42', KNOWN_ROLES, KNOWN_ITEMS).ok).toBe(false);
  });

  it('rejects profiles referencing an unknown role, naming the role', () => {
    const text = JSON.stringify({
      profile: { ...bareSnapshot, selection: { kind: 'predefined', id: 'cobol' } },
    });
    const result = parseImportedProfile(text, KNOWN_ROLES, KNOWN_ITEMS);
    expect(result).toMatchObject({ ok: false, error: /"cobol"/ });
  });

  it('filters unknown item ids from a custom selection and reports the drop', () => {
    const text = JSON.stringify({
      profile: {
        ...bareSnapshot,
        selection: { kind: 'custom', itemIds: ['swift', 'gone-1', 'gone-2', 'lang-c'] },
      },
    });
    const result = parseImportedProfile(text, KNOWN_ROLES, KNOWN_ITEMS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.selection).toEqual({ kind: 'custom', itemIds: ['swift', 'lang-c'] });
    expect(result.notes.join(' ')).toMatch(/dropped 2 unknown items/i);
  });

  it('repairs an unknown level to the default and says so', () => {
    const text = JSON.stringify({ profile: { ...bareSnapshot, level: 'principal-plus' } });
    const result = parseImportedProfile(text, KNOWN_ROLES, KNOWN_ITEMS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.level).toBe('mid');
    expect(result.notes.join(' ')).toMatch(/level/i);
  });

  it('falls back to Untitled for a blank name and notes it', () => {
    const text = JSON.stringify({ profile: { ...bareSnapshot, name: '   ' } });
    const result = parseImportedProfile(text, KNOWN_ROLES, KNOWN_ITEMS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.name).toBe('   ');
    expect(result.notes.join(' ')).toMatch(/untitled/i);
  });

  it('flags a stale data-version when the current one is supplied', () => {
    const text = JSON.stringify({ profile: { ...bareSnapshot, dataVersion: '00000000' } });
    const result = parseImportedProfile(text, KNOWN_ROLES, KNOWN_ITEMS, 'deadbeef');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notes.join(' ')).toMatch(/older version of the map/i);
  });

  it('stays silent about data-version when it matches', () => {
    const text = JSON.stringify({ profile: { ...bareSnapshot, dataVersion: 'deadbeef' } });
    const result = parseImportedProfile(text, KNOWN_ROLES, KNOWN_ITEMS, 'deadbeef');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notes).toEqual([]);
  });
});

describe('buildExportFile + exportFileName', () => {
  it('wraps a snapshot with the format marker', () => {
    const file = buildExportFile(bareSnapshot);
    expect(file.kind).toBe('swedomainmap-profile');
    expect(file.v).toBe(1);
    expect(file.profile).toBe(bareSnapshot);
    // Round-trips through parseImportedProfile.
    const result = parseImportedProfile(JSON.stringify(file), KNOWN_ROLES, KNOWN_ITEMS);
    expect(result.ok).toBe(true);
  });

  it('derives a safe download filename from the profile name', () => {
    expect(exportFileName({ ...bareSnapshot, name: 'Backend / Sr — v2!!' })).toBe('backend-sr-v2.json');
    expect(exportFileName({ ...bareSnapshot, name: '   ' })).toBe('profile.json');
  });
});
