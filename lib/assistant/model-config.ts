/**
 * The single reader for ANTHROPIC_API_KEY's usability.
 *
 * `lib/assistant/route.ts` previously asked `Boolean(process.env.ANTHROPIC_API_KEY)`,
 * which answers "is the variable non-empty" and calls that "configured". A key
 * that is present and rejected therefore reported as configured, failed at call
 * time, and surfaced to the user as "not configured" — naming the wrong cause
 * and sending the reader to the wrong file.
 *
 * Two states are distinguishable, and only one of them is readable up front:
 *
 *   missing — the variable is unset or blank. Known from the environment.
 *   invalid — the variable is set and the API rejected it. NOT knowable without
 *             calling, so it is observed: the classifier reports a 401/403 here
 *             and the next request reads it back.
 *
 * There is deliberately no startup probe. The app must boot without network.
 *
 * Server-only. The key never leaves this module — callers get a status and a
 * notice string, never the value.
 */

export type ModelCredentialStatus =
  | { state: 'ok' }
  | { state: 'missing' }
  | { state: 'invalid'; httpStatus: number };

/** Trimmed, so a whitespace-only value reads as missing — as in lib/supabase/config.ts. */
function readKey(): string {
  const value = process.env.ANTHROPIC_API_KEY;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The key that was rejected, and with what.
 *
 * Stored as the key itself rather than a bare flag so that pasting a new key
 * clears the accusation immediately. With a flag, a fresh key would keep
 * reporting invalid until a call happened to succeed — which is exactly the
 * stale-diagnostic problem this module exists to end.
 */
let rejectedKey: string | null = null;
let rejectedStatus = 0;

/** Records an auth rejection. Non-auth failures say nothing about the key. */
export function noteModelAuthFailure(httpStatus: number): void {
  if (httpStatus !== 401 && httpStatus !== 403) return;
  rejectedKey = readKey();
  rejectedStatus = httpStatus;
}

/** A successful call proves the current key is good. */
export function noteModelSuccess(): void {
  rejectedKey = null;
  rejectedStatus = 0;
}

export function modelCredentialStatus(): ModelCredentialStatus {
  const key = readKey();
  if (!key) return { state: 'missing' };
  if (rejectedKey !== null && rejectedKey === key) {
    return { state: 'invalid', httpStatus: rejectedStatus };
  }
  return { state: 'ok' };
}

/**
 * Operator-facing copy. Null when there is nothing wrong, so a caller can
 * render the result directly without re-testing the state.
 */
export function credentialNotice(status: ModelCredentialStatus): string | null {
  switch (status.state) {
    case 'ok':
      return null;
    case 'missing':
      return (
        'AI search is falling back to keyword search: ANTHROPIC_API_KEY is not set. ' +
        'Add it to .env.local and restart the dev server.'
      );
    case 'invalid':
      return (
        `AI search is falling back to keyword search: the configured ANTHROPIC_API_KEY ` +
        `was rejected by Anthropic (HTTP ${status.httpStatus}). The variable is set — ` +
        `the key itself is not valid. Replace it with a working key from ` +
        `console.anthropic.com.`
      );
  }
}

/** Test seam — clears the observed rejection between cases. */
export function resetModelCredentialForTests(): void {
  rejectedKey = null;
  rejectedStatus = 0;
}
