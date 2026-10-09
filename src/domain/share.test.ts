import { describe, expect, it, vi } from 'vitest';
import { CATEGORIES } from '../data/categories';
import { ROLES } from '../data/roles';
import { computeDataVersion } from './profiles';
import {
  MAX_SHARE_NAME_CHARS,
  SHARE_FORMAT_VERSION,
  buildShareContext,
  decodeShareLink,
  encodeShareLink,
  encodeShareLinkRaw,
  roleSelectionFromShareSelection,
  sharePayloadFromRoleSelection,
  stableItemIds,
  type ShareCodecContext,
  type ShareLinkPayload,
} from './share';
import { LEVELS, type RoleSelection } from './types';

const ALL_ITEM_IDS = stableItemIds(CATEGORIES);
const ctx: ShareCodecContext = buildShareContext(CATEGORIES, ROLES.map((r) => r.id));

const predefinedPayload: ShareLinkPayload = {
  selection: { kind: 'predefined', id: 'backend' },
  level: 'sr',
  highlight: true,
};

/** base64url-encode raw bytes in tests (duplicates the production helper to keep it unexported). */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Craft payload bytes for decoder edge cases the encoder cannot produce. */
function craftPayloadBytes(o: {
  version?: number;
  flags?: number;
  /** Defaults to the current dataset's data version. */
  dataVersionHex?: string;
  nameBytes?: number;
  trailing?: number[];
}): Uint8Array {
  const dv = parseInt(o.dataVersionHex ?? computeDataVersion(ctx.itemIds), 16) >>> 0;
  const bytes = new Uint8Array(7 + (o.trailing?.length ?? 0));
  bytes[0] = o.version ?? SHARE_FORMAT_VERSION;
  bytes[1] = o.flags ?? 0;
  bytes[2] = (dv >>> 24) & 0xff;
  bytes[3] = (dv >>> 16) & 0xff;
  bytes[4] = (dv >>> 8) & 0xff;
  bytes[5] = dv & 0xff;
  bytes[6] = o.nameBytes ?? 0;
  if (o.trailing) bytes.set(o.trailing, 7);
  return bytes;
}

describe('stableItemIds', () => {
  it('flattens categories in declaration order with unique ids', () => {
    expect(ALL_ITEM_IDS).toEqual(CATEGORIES.flatMap((c) => c.items.map((i) => i.id)));
    expect(new Set(ALL_ITEM_IDS).size).toBe(ALL_ITEM_IDS.length);
    expect(ALL_ITEM_IDS.length).toBeGreaterThan(400);
  });
});

describe('encodeShareLinkRaw + decodeShareLink round trips', () => {
  it('round-trips a predefined selection', async () => {
    const encoded = encodeShareLinkRaw(predefinedPayload, ctx);
    expect(encoded[0]).toBe('0');
    // The spec's compactness target: well under 200 chars for a role view.
    expect(encoded.length).toBeLessThan(200);

    const result = await decodeShareLink(encoded, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual(predefinedPayload);
      expect(result.stale).toBeNull();
    }
  });

  it('round-trips a custom selection with a name', async () => {
    const ids = [ALL_ITEM_IDS[0], ALL_ITEM_IDS[7], ALL_ITEM_IDS[100], ALL_ITEM_IDS[ALL_ITEM_IDS.length - 1]];
    const payload: ShareLinkPayload = {
      selection: { kind: 'custom', itemIds: ids },
      level: 'jr',
      highlight: false,
      name: 'Team roadmap',
    };
    const result = await decodeShareLink(encodeShareLinkRaw(payload, ctx), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stale).toBeNull();
    expect(result.payload.level).toBe('jr');
    expect(result.payload.highlight).toBe(false);
    expect(result.payload.name).toBe('Team roadmap');
    expect(result.payload.selection.kind).toBe('custom');
    if (result.payload.selection.kind === 'custom') {
      expect([...result.payload.selection.itemIds].sort()).toEqual([...ids].sort());
    }
  });

  it('round-trips an empty custom selection', async () => {
    const payload: ShareLinkPayload = {
      selection: { kind: 'custom', itemIds: [] },
      level: 'mid',
      highlight: true,
    };
    const result = await decodeShareLink(encodeShareLinkRaw(payload, ctx), ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.payload.selection.kind === 'custom') {
      expect(result.payload.selection.itemIds).toEqual([]);
    }
  });

  it('round-trips a unicode profile name', async () => {
    const payload: ShareLinkPayload = { ...predefinedPayload, name: 'Café ☕ roadmap 🗺' };
    const result = await decodeShareLink(encodeShareLinkRaw(payload, ctx), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.name).toBe('Café ☕ roadmap 🗺');
  });

  it('drops unknown item ids at encode time', async () => {
    const payload: ShareLinkPayload = {
      selection: { kind: 'custom', itemIds: ['not-a-real-item', ALL_ITEM_IDS[3]] },
      level: 'mid',
      highlight: false,
    };
    const result = await decodeShareLink(encodeShareLinkRaw(payload, ctx), ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.payload.selection.kind === 'custom') {
      expect(result.payload.selection.itemIds).toEqual([ALL_ITEM_IDS[3]]);
    }
  });

  it('is stable: same state produces the same string', () => {
    const a = encodeShareLinkRaw(predefinedPayload, ctx);
    const b = encodeShareLinkRaw(predefinedPayload, ctx);
    expect(a).toBe(b);
  });

  it('tolerates a leading # and surrounding whitespace', async () => {
    const encoded = encodeShareLinkRaw(predefinedPayload, ctx);
    const withHash = await decodeShareLink(`  #${encoded}  `, ctx);
    expect(withHash.ok).toBe(true);
  });

  it('keeps links compact (custom selections stay ~75-char order of magnitude)', () => {
    const everyThird = ALL_ITEM_IDS.filter((_, i) => i % 3 === 0);
    const encoded = encodeShareLinkRaw(
      { selection: { kind: 'custom', itemIds: everyThird }, level: 'staff', highlight: true },
      ctx,
    );
    // 56-byte bitset + 7-byte header ≈ 84 base64 chars + marker.
    expect(encoded.length).toBeLessThan(120);
  });
});

describe('stale data-version handling', () => {
  it('flags a stale link and drops items the current dataset no longer has', async () => {
    // Simulate the link's original dataset: three items that have since been removed.
    const oldCtx: ShareCodecContext = {
      itemIds: [...ALL_ITEM_IDS, 'ghost-a', 'ghost-b', 'ghost-c'],
      knownRoleIds: ctx.knownRoleIds,
    };
    const payload: ShareLinkPayload = {
      selection: { kind: 'custom', itemIds: ['ghost-a', 'ghost-b', ALL_ITEM_IDS[0], ALL_ITEM_IDS[10]] },
      level: 'mid',
      highlight: true,
    };
    const result = await decodeShareLink(encodeShareLinkRaw(payload, oldCtx), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stale).not.toBeNull();
    expect(result.stale?.droppedItemCount).toBe(2);
    expect(result.stale?.currentDataVersion).toBe(computeDataVersion(ctx.itemIds));
    if (result.payload.selection.kind === 'custom') {
      expect(result.payload.selection.itemIds).toEqual([ALL_ITEM_IDS[0], ALL_ITEM_IDS[10]]);
    }
  });

  it('flags a stale predefined link with nothing dropped', async () => {
    const oldCtx: ShareCodecContext = {
      itemIds: [...ALL_ITEM_IDS, 'ghost-a'],
      knownRoleIds: ctx.knownRoleIds,
    };
    const result = await decodeShareLink(encodeShareLinkRaw(predefinedPayload, oldCtx), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual(predefinedPayload);
      expect(result.stale).not.toBeNull();
      expect(result.stale?.droppedItemCount).toBe(0);
    }
  });

  it('treats a same-version link as fresh', async () => {
    const result = await decodeShareLink(encodeShareLinkRaw(predefinedPayload, ctx), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stale).toBeNull();
  });
});

describe('malformed and hostile input', () => {
  const expectMalformed = async (hash: string) => {
    const result = await decodeShareLink(hash, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('malformed');
  };

  it('rejects garbage', async () => {
    await expectMalformed('garbage-not-a-link');
    await expectMalformed('');
    await expectMalformed('#');
  });

  it('rejects a body that is too short', async () => {
    await expectMalformed('0' + toBase64Url(new Uint8Array([1, 2])));
  });

  it('rejects an unknown format version', async () => {
    const result = await decodeShareLink('0' + toBase64Url(craftPayloadBytes({ version: 2 })), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('unsupported-version');
      if (result.failure.reason === 'unsupported-version') {
        expect(result.failure.version).toBe(2);
      }
    }
  });

  it('rejects an all-zero body as version 0 (unsupported)', async () => {
    const result = await decodeShareLink('0' + toBase64Url(new Uint8Array(100).fill(0)), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok && result.failure.reason === 'unsupported-version') {
      expect(result.failure.version).toBe(0);
    } else if (!result.ok) {
      // Acceptable too — the point is a clean rejection, never a crash.
      expect(result.failure.reason).toBe('malformed');
    }
  });

  it('rejects a truncated predefined selection', async () => {
    const bytes = craftPayloadBytes({ trailing: [5, 1, 2] }); // role len 5, only 2 role bytes
    await expectMalformed('0' + toBase64Url(bytes));
  });

  it('rejects a truncated custom bitset', async () => {
    const bytes = craftPayloadBytes({ flags: 1 << 3, trailing: [1, 2, 3] });
    await expectMalformed('0' + toBase64Url(bytes));
  });

  it('rejects a name length that runs past the buffer', async () => {
    const bytes = craftPayloadBytes({ nameBytes: 200 });
    await expectMalformed('0' + toBase64Url(bytes));
  });

  it('reports an unknown role id as unknown-role, not malformed', async () => {
    const roleBytes = new TextEncoder().encode('cobol');
    const bytes = craftPayloadBytes({ trailing: [roleBytes.length, ...roleBytes] });
    const result = await decodeShareLink('0' + toBase64Url(bytes), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok && result.failure.reason === 'unknown-role') {
      expect(result.failure.roleId).toBe('cobol');
    } else {
      throw new Error('expected unknown-role failure');
    }
  });

  it('degrades a deflate-marked link to malformed when DecompressionStream is missing', async () => {
    const rawEncoded = encodeShareLinkRaw(predefinedPayload, ctx);
    const deflateMarked = '1' + rawEncoded.slice(1);
    vi.stubGlobal('DecompressionStream', undefined);
    try {
      await expectMalformed(deflateMarked);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('deflate path', () => {
  const hasNativeDeflate =
    typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

  it.runIf(hasNativeDeflate)('round-trips through encodeShareLink', async () => {
    const ids = [ALL_ITEM_IDS[2], ALL_ITEM_IDS[9], ALL_ITEM_IDS[50]];
    const payload: ShareLinkPayload = {
      selection: { kind: 'custom', itemIds: ids },
      level: 'staff',
      highlight: true,
      name: 'Compressed',
    };
    const encoded = await encodeShareLink(payload, ctx);
    expect(encoded[0]).toMatch(/^[01]$/);

    const result = await decodeShareLink(encoded, ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.payload.selection.kind === 'custom') {
      expect([...result.payload.selection.itemIds].sort()).toEqual([...ids].sort());
      expect(result.payload.name).toBe('Compressed');
    }
  });

  it.runIf(hasNativeDeflate)('uses deflate only when it measurably shortens the link', async () => {
    const encoded = await encodeShareLink(predefinedPayload, ctx);
    const raw = encodeShareLinkRaw(predefinedPayload, ctx);
    if (encoded[0] === '1') {
      expect(encoded.length).toBeLessThan(raw.length);
    } else {
      expect(encoded).toBe(raw);
    }
  });

  it.runIf(hasNativeDeflate)('is stable across repeated encodes', async () => {
    const a = await encodeShareLink(predefinedPayload, ctx);
    const b = await encodeShareLink(predefinedPayload, ctx);
    expect(a).toBe(b);
  });
});

describe('name handling', () => {
  it('truncates oversized names to the character cap', async () => {
    const payload: ShareLinkPayload = { ...predefinedPayload, name: 'x'.repeat(250) };
    const result = await decodeShareLink(encodeShareLinkRaw(payload, ctx), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.name?.length).toBe(MAX_SHARE_NAME_CHARS);
  });

  it('omits blank names', async () => {
    const payload: ShareLinkPayload = { ...predefinedPayload, name: '   ' };
    const result = await decodeShareLink(encodeShareLinkRaw(payload, ctx), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.name).toBeUndefined();
  });
});

describe('view adapters', () => {
  it('maps a null selection to nothing to share', () => {
    expect(sharePayloadFromRoleSelection(null, 'mid', true)).toBeNull();
  });

  it('maps predefined and custom selections to payloads', () => {
    const predefined: RoleSelection = { kind: 'predefined', id: 'backend' };
    expect(sharePayloadFromRoleSelection(predefined, 'sr', true)).toEqual({
      selection: { kind: 'predefined', id: 'backend' },
      level: 'sr',
      highlight: true,
    });
    const custom: RoleSelection = { kind: 'custom', itemIds: new Set(['swift', 'kotlin']) };
    expect(sharePayloadFromRoleSelection(custom, 'jr', false)).toEqual({
      selection: { kind: 'custom', itemIds: ['swift', 'kotlin'] },
      level: 'jr',
      highlight: false,
    });
  });

  it('maps a payload back to a live selection, carrying the name for custom views', () => {
    expect(roleSelectionFromShareSelection({ kind: 'predefined', id: 'backend' })).toEqual({
      kind: 'predefined',
      id: 'backend',
    });
    expect(
      roleSelectionFromShareSelection(
        { kind: 'custom', itemIds: ['swift', 'kotlin'] },
        'My pick',
      ),
    ).toEqual({ kind: 'custom', itemIds: new Set(['swift', 'kotlin']), name: 'My pick' });
    const noName = roleSelectionFromShareSelection({ kind: 'custom', itemIds: ['swift'] });
    expect('name' in noName).toBe(false);
  });
});

describe('level flag decode', () => {
  it('decodes every level index back to its level', async () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const payload: ShareLinkPayload = { ...predefinedPayload, level: LEVELS[i] };
      const result = await decodeShareLink(encodeShareLinkRaw(payload, ctx), ctx);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.payload.level).toBe(LEVELS[i]);
    }
  });
});
