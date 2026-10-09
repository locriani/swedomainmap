import { computeDataVersion, type ProfileSelection } from './profiles';
import { DEFAULT_LEVEL } from './scope';
import { LEVELS, type Category, type Level, type RoleId, type RoleSelection } from './types';

/**
 * Compact share links (spec PR-3, locked decision 4).
 *
 * The current view — selection (predefined role or custom item set), level,
 * highlight — is encoded into the URL *hash* (never the query string) as a
 * short binary payload, base64url-encoded. Custom selections are a bitset
 * over the stable item order (`stableItemIds`), so 448 items cost 56 bytes
 * no matter how many are picked. A data-version tag (FNV-1a over the item
 * ids, via `computeDataVersion`) lets the receiver detect links made against
 * an older dataset and degrade honestly instead of showing a silently wrong
 * selection.
 *
 * Binary layout (format v1):
 *
 *   byte 0      format version (currently 1)
 *   byte 1      flags: bit0 highlight · bits1-2 level index · bit3 kind
 *                       (0 = predefined, 1 = custom); reserved bits ignored
 *   bytes 2-5   data version, big-endian uint32
 *   byte 6      optional name: UTF-8 byte length n (0 = none)
 *   bytes 7..   name bytes (n)                    [present when n > 0]
 *   then        selection:
 *                 predefined: role-id byte length m + m UTF-8 bytes
 *                 custom:     ceil(N/8) bitset bytes, bit i (LSB-first) =
 *                             item at stable index i is selected; bytes
 *                             beyond ceil(N/8) can only come from links
 *                             made against a larger (older) dataset and
 *                             are reported as dropped items
 *
 * The hash body carries a one-char encoding marker: `0` = raw base64url,
 * `1` = deflate + base64url. Encoding uses native `CompressionStream`
 * only when it exists AND measurably shortens the link (it usually does
 * not for a 56-byte bitset); every environment can decode both markers,
 * and browsers without the API simply always emit `0`.
 *
 * Decoding is total: malformed, truncated, or future-version input yields
 * a typed failure — it never throws and never produces a half-meaningful
 * view (same discipline as `sanitizeRegistry` / `useRoleSelection`).
 */

export const SHARE_FORMAT_VERSION = 1;

/** Names longer than this are truncated at both encode and decode time. */
export const MAX_SHARE_NAME_CHARS = 100;

/** Hash bodies over this length are rejected before decoding (DoS guard). */
const MAX_HASH_CHARS = 16_384;

/** Bitset bytes allowed beyond the current minimum (stale larger datasets). */
const MAX_EXTRA_BITSET_BYTES = 512;

/** Inflated-size cap when decoding a deflate-marked link (zip-bomb guard). */
const MAX_INFLATED_BYTES = 1_048_576;

const MARKER_RAW = '0';
const MARKER_DEFLATE = '1';

const FLAG_HIGHLIGHT = 1 << 0;
const FLAG_CUSTOM = 1 << 3;
const LEVEL_SHIFT = 1;
const LEVEL_MASK = 3;

/** Name length prefix is one byte — hard ceiling in the wire format. */
const MAX_NAME_BYTES = 255;

const utf8 = {
  encode: (text: string): Uint8Array => new TextEncoder().encode(text),
  decode: (bytes: Uint8Array): string => new TextDecoder().decode(bytes),
};

export interface ShareCodecContext {
  /** Stable item order the custom-selection bitset indexes into. */
  readonly itemIds: readonly string[];
  /** Role ids that can legally appear in a predefined selection. */
  readonly knownRoleIds: ReadonlySet<string>;
}

export interface ShareLinkPayload {
  readonly selection: ProfileSelection;
  readonly level: Level;
  readonly highlight: boolean;
  /** Optional profile name, carried so the receiver can display it. */
  readonly name?: string;
}

export interface StaleShareInfo {
  /** Data version embedded in the link (8 hex chars). */
  readonly linkDataVersion: string;
  /** Data version of the receiving dataset (8 hex chars). */
  readonly currentDataVersion: string;
  /** Selected items the current dataset no longer contains. */
  readonly droppedItemCount: number;
}

export type ShareLinkFailure =
  | { readonly reason: 'malformed' }
  | { readonly reason: 'unsupported-version'; readonly version: number }
  | { readonly reason: 'unknown-role'; readonly roleId: string };

export type ShareLinkDecodeResult =
  | {
      readonly ok: true;
      readonly payload: ShareLinkPayload;
      /** Non-null when the link predates the current dataset. */
      readonly stale: StaleShareInfo | null;
    }
  | { readonly ok: false; readonly failure: ShareLinkFailure };

/** The stable item order the bitset indexes into: categories in declaration order, items within each. */
export function stableItemIds(categories: readonly Category[]): string[] {
  return categories.flatMap((c) => c.items.map((i) => i.id));
}

export function buildShareContext(
  categories: readonly Category[],
  roleIds: readonly string[],
): ShareCodecContext {
  return { itemIds: stableItemIds(categories), knownRoleIds: new Set(roleIds) };
}

/** Live view → share payload. `null` when there is nothing to share. */
export function sharePayloadFromRoleSelection(
  selection: RoleSelection | null,
  level: Level,
  highlight: boolean,
): ShareLinkPayload | null {
  if (selection === null) return null;
  return {
    selection:
      selection.kind === 'predefined'
        ? { kind: 'predefined', id: selection.id }
        : { kind: 'custom', itemIds: [...selection.itemIds] },
    level,
    highlight,
  };
}

/** Share payload → live selection (a custom selection carries the name). */
export function roleSelectionFromShareSelection(
  sel: ProfileSelection,
  name?: string,
): RoleSelection {
  if (sel.kind === 'predefined') return { kind: 'predefined', id: sel.id };
  return { kind: 'custom', itemIds: new Set(sel.itemIds), ...(name ? { name } : {}) };
}

/**
 * Synchronous raw encoder (marker `0`) — the portable path every environment
 * can produce. `encodeShareLink` wraps this with optional deflate.
 */
export function encodeShareLinkRaw(payload: ShareLinkPayload, ctx: ShareCodecContext): string {
  return MARKER_RAW + bytesToBase64Url(encodePayloadBytes(payload, ctx));
}

/**
 * Encode with optional deflate: compression runs when the platform supports
 * it, and the shorter of raw/deflated wins. Same input → same output within
 * one environment (deflate is deterministic).
 */
export async function encodeShareLink(
  payload: ShareLinkPayload,
  ctx: ShareCodecContext,
): Promise<string> {
  const raw = encodePayloadBytes(payload, ctx);
  const deflated = await tryDeflate(raw);
  if (deflated && deflated.length < raw.length) {
    return MARKER_DEFLATE + bytesToBase64Url(deflated);
  }
  return MARKER_RAW + bytesToBase64Url(raw);
}

/**
 * Decode a URL hash (with or without the leading `#`; surrounding whitespace
 * tolerated). Total: returns a typed failure instead of throwing on any input.
 */
export async function decodeShareLink(
  rawHash: string,
  ctx: ShareCodecContext,
): Promise<ShareLinkDecodeResult> {
  const hash = rawHash.trim().replace(/^#/, '');
  if (!hash || hash.length > MAX_HASH_CHARS) return malformed();
  try {
    const bytes = await decodeHashBody(hash);
    return parsePayloadBytes(bytes, ctx);
  } catch {
    // A failed decode means junk input or a hostile link — reported as a
    // typed failure, never thrown (sanitize discipline).
    return malformed();
  }
}

function encodePayloadBytes(payload: ShareLinkPayload, ctx: ShareCodecContext): Uint8Array {
  if (
    payload.selection.kind === 'predefined' &&
    !ctx.knownRoleIds.has(payload.selection.id)
  ) {
    // Role ids are compile-time checked, so a mismatch is a programmer error,
    // not user input — fail loudly rather than encode a dead link.
    throw new Error(`encodeShareLink: unknown role id "${payload.selection.id}"`);
  }
  const nameBytes = encodeName(payload.name);
  const header = new Uint8Array(7 + nameBytes.length);
  header[0] = SHARE_FORMAT_VERSION;
  header[1] = encodeFlags(payload);
  writeUint32BE(header, 2, parseInt(computeDataVersion(ctx.itemIds), 16) >>> 0);
  header[6] = nameBytes.length;
  header.set(nameBytes, 7);

  if (payload.selection.kind === 'custom') {
    const bitset = encodeBitset(payload.selection.itemIds, ctx.itemIds);
    const out = new Uint8Array(header.length + bitset.length);
    out.set(header, 0);
    out.set(bitset, header.length);
    return out;
  }
  const roleBytes = utf8.encode(payload.selection.id);
  const out = new Uint8Array(header.length + 1 + roleBytes.length);
  out.set(header, 0);
  out[header.length] = roleBytes.length;
  out.set(roleBytes, header.length + 1);
  return out;
}

function encodeFlags(payload: ShareLinkPayload): number {
  const levelIndex = LEVELS.indexOf(payload.level);
  return (
    ((levelIndex & LEVEL_MASK) << LEVEL_SHIFT) |
    (payload.highlight ? FLAG_HIGHLIGHT : 0) |
    (payload.selection.kind === 'custom' ? FLAG_CUSTOM : 0)
  );
}

/**
 * Unknown item ids are skipped: a bitset can only represent items in the
 * stable order, and live state is already sanitized on load, so this is a
 * belt-and-suspenders filter rather than a data-loss path.
 */
function encodeBitset(itemIds: readonly string[], order: readonly string[]): Uint8Array {
  const indexOf = new Map<string, number>();
  order.forEach((id, i) => {
    if (!indexOf.has(id)) indexOf.set(id, i);
  });
  const bytes = new Uint8Array(Math.ceil(order.length / 8));
  for (const id of itemIds) {
    const idx = indexOf.get(id);
    if (idx !== undefined) bytes[idx >> 3] |= 1 << (idx & 7);
  }
  return bytes;
}

function encodeName(name: string | undefined): Uint8Array {
  if (!name) return new Uint8Array(0);
  let candidate = name.trim().slice(0, MAX_SHARE_NAME_CHARS);
  let bytes = utf8.encode(candidate);
  // UTF-8 can push 100 chars past the 255-byte length prefix; trim characters
  // until it fits (names are display-only, byte-perfect truncation is fine).
  while (bytes.length > MAX_NAME_BYTES && candidate.length > 0) {
    candidate = candidate.slice(0, -1);
    bytes = utf8.encode(candidate);
  }
  return bytes;
}

async function decodeHashBody(hash: string): Promise<Uint8Array> {
  const marker = hash[0];
  const body = base64UrlToBytes(hash.slice(1));
  if (marker === MARKER_RAW) return body;
  if (marker === MARKER_DEFLATE) return inflateBytes(body);
  throw new Error(`unknown share-link marker "${marker}"`);
}

function parsePayloadBytes(bytes: Uint8Array, ctx: ShareCodecContext): ShareLinkDecodeResult {
  if (bytes.length < 7) return malformed();
  if (bytes[0] !== SHARE_FORMAT_VERSION) {
    return { ok: false, failure: { reason: 'unsupported-version', version: bytes[0] } };
  }
  const flags = bytes[1];
  const highlight = (flags & FLAG_HIGHLIGHT) !== 0;
  const level = LEVELS[(flags >> LEVEL_SHIFT) & LEVEL_MASK] ?? DEFAULT_LEVEL;
  const isCustom = (flags & FLAG_CUSTOM) !== 0;
  const linkDataVersion = readUint32BE(bytes, 2).toString(16).padStart(8, '0');
  const nameLen = bytes[6];
  if (7 + nameLen > bytes.length) return malformed();
  const name = decodeName(bytes.subarray(7, 7 + nameLen));
  const offset = 7 + nameLen;

  let selection: ProfileSelection;
  let droppedItemCount = 0;
  if (isCustom) {
    const total = ctx.itemIds.length;
    const minBitsetBytes = Math.ceil(total / 8);
    const bitsetBytes = bytes.length - offset;
    if (
      bitsetBytes < minBitsetBytes ||
      bitsetBytes > minBitsetBytes + MAX_EXTRA_BITSET_BYTES
    ) {
      return malformed();
    }
    const itemIds: string[] = [];
    for (let i = 0; i < bitsetBytes * 8; i++) {
      if (!((bytes[offset + (i >> 3)] >> (i & 7)) & 1)) continue;
      if (i < total) itemIds.push(ctx.itemIds[i]);
      else droppedItemCount += 1;
    }
    selection = { kind: 'custom', itemIds };
  } else {
    if (offset + 1 > bytes.length) return malformed();
    const roleLen = bytes[offset];
    if (offset + 1 + roleLen !== bytes.length) return malformed();
    const roleId = utf8.decode(bytes.subarray(offset + 1, offset + 1 + roleLen));
    if (!ctx.knownRoleIds.has(roleId)) {
      return { ok: false, failure: { reason: 'unknown-role', roleId } };
    }
    selection = { kind: 'predefined', id: roleId as RoleId };
  }

  const currentDataVersion = computeDataVersion(ctx.itemIds);
  const stale =
    currentDataVersion === linkDataVersion
      ? null
      : { linkDataVersion, currentDataVersion, droppedItemCount };
  return {
    ok: true,
    payload: { selection, level, highlight, ...(name !== undefined ? { name } : {}) },
    stale,
  };
}

function decodeName(bytes: Uint8Array): string | undefined {
  if (bytes.length === 0) return undefined;
  const text = utf8.decode(bytes).trim().slice(0, MAX_SHARE_NAME_CHARS);
  return text || undefined;
}

const malformed = (): ShareLinkDecodeResult => ({ ok: false, failure: { reason: 'malformed' } });

/**
 * Copy bytes into a plain ArrayBuffer so `Blob` accepts them under TS 5.7's
 * generically-typed `Uint8Array` (whose buffer may be a SharedArrayBuffer).
 */
function blobFromBytes(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer]);
}

/**
 * Compress for the share link when the platform supports it. Compression is
 * purely an optimization — any failure (missing API, blocked stream) returns
 * null and the caller falls back to the raw encoding, so this catch IS the
 * specified fallback path, not a swallowed error.
 */
async function tryDeflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = blobFromBytes(bytes).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function inflateBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream unavailable');
  }
  const stream = blobFromBytes(bytes).stream().pipeThrough(new DecompressionStream('deflate'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_INFLATED_BYTES) throw new Error('inflated share payload too large');
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded); // throws on non-base64 input → decoded as malformed
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function writeUint32BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}
