/**
 * People's filter state as one URL param.
 *
 * Events serialises readably (`?country=Germany&category=Packaging`) because it
 * already had a shipped scheme worth keeping. People does not: PeopleFilters has
 * fifteen keys and eleven of them are arrays, and enumerating that as readable
 * params buys nothing on a page nobody hand-edits.
 *
 * base64url rather than base64: `+`, `/` and `=` are mangled or ambiguous in a
 * query string. Padding is stripped and restored on the way back.
 *
 * The URL is an enhancement to the transport, never the transport itself — over
 * the cap the param is omitted and the in-memory `presetFilters` carries the
 * handoff instead.
 */

export const MAX_FILTER_PARAM_LENGTH = 1500;

/** Rejects anything outside the base64url alphabet before atob sees it. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(text: string): string {
  // TextEncoder first: btoa on a raw JS string throws for anything above U+00FF,
  // so "Köln" would fail and "日本" would corrupt.
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  // Indexed, not for-of: tsconfig sets no `target`, so tsc defaults to ES5 and
  // rejects iterating a Uint8Array without downlevelIteration.
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Null when the value will not serialise, or would make the URL too long. */
export function encodeFilters(filters: unknown): string | null {
  let json: string;
  try {
    json = JSON.stringify(filters);
  } catch {
    return null; // cyclic, BigInt, and friends
  }
  if (typeof json !== 'string') return null; // undefined, a function

  const encoded = toBase64Url(json);
  return encoded.length > MAX_FILTER_PARAM_LENGTH ? null : encoded;
}

/**
 * Never throws. Every failure — absent, oversize, wrong alphabet, bad JSON, or
 * JSON that is not a filter object — returns the caller's fallback.
 */
export function decodeFilters<T>(param: string | null | undefined, fallback: T): T {
  if (!param || param.length > MAX_FILTER_PARAM_LENGTH) return fallback;
  if (!BASE64URL.test(param)) return fallback;

  try {
    const parsed = JSON.parse(fromBase64Url(param)) as unknown;
    // Arrays and primitives parse cleanly but are not filter sets.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}
