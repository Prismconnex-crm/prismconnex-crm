/**
 * The 90-second life of an email verification code.
 *
 * ## Why this exists
 *
 * Supabase generates and validates the OTP, and it is the only thing that knows
 * whether a code is *correct* — nothing here duplicates that. But Supabase's
 * validity period is a project-level dashboard setting (Authentication → Email
 * → "Email OTP Expiration", `GOTRUE_MAILER_OTP_EXP` when self-hosted) that
 * defaults to one hour and is shared with magic links and invite links. It
 * cannot be set per request, and the anon key this app holds cannot change it at
 * all. So a 90-second code cannot come from Supabase alone.
 *
 * This module is the missing half: it records *when* a code was mailed, and
 * /api/auth/verify refuses to forward anything older than 90 seconds to
 * Supabase. Supabase still decides correctness; we decide freshness.
 *
 * The gate only covers codes that arrive through this app. A signup email
 * template built on {{ .ConfirmationURL }} sends the user straight to Supabase,
 * which never consults this module and applies its own hour instead — so the
 * template must emit {{ .Token }} for the 90 seconds to mean anything. Turning
 * the dashboard's "Email OTP Expiration" down to 90 would close that path too,
 * but it is one project-wide value shared with password-recovery, magic and
 * invite links, and a 90-second reset link is not usable. Prefer the OTP-only
 * template.
 *
 * ## One record, two behaviours
 *
 * A single `expiresAt` per address answers both questions the verify page asks,
 * because they are the same instant:
 *
 *   - "is this code still usable?"     → now < expiresAt
 *   - "may another code be requested?" → now >= expiresAt
 *
 * Resending is therefore allowed exactly when the previous code dies, which is
 * why the countdown and the resend button hand off to each other cleanly and why
 * there is no second timer to keep in sync.
 *
 * ## Storage
 *
 * Deliberately in-memory. The window is 90 seconds; persisting it would mean a
 * Prisma table and a migration for state that is stale before the next deploy.
 * It is held on globalThis rather than in a module-level binding so it survives
 * the module re-evaluation that Next's dev server does on every edit — without
 * that, saving a file mid-signup would silently expire a code that had only just
 * been sent.
 *
 * Two consequences worth naming. A process restart drops every record, and an
 * unknown address is treated as expired (see `getSecondsUntilExpiry`), so a
 * restart between signup and verify costs the user one "Resend" click rather
 * than letting an unbounded code through. And if this ever runs multi-instance,
 * the Map must become a shared store (Redis, or a Postgres table keyed the same
 * way) or the two instances will disagree; nothing outside this file changes.
 */

/**
 * The single message for every flavour of "too late" — expired, and the
 * indistinguishable "no record on file". It lives here rather than in the route
 * because an App Router route file may only export request handlers and Next's
 * own config keys; anything else fails the generated route-type check.
 */
export const EXPIRED_CODE_MESSAGE = "Verification code has expired. Please request a new code.";

export const VERIFICATION_CODE_TTL_SECONDS = 90;

const TTL_MS = VERIFICATION_CODE_TTL_SECONDS * 1000;

declare global {
    // eslint-disable-next-line no-var
    var pcxVerificationWindows: Map<string, number> | undefined;
}

/** key -> epoch ms at which the outstanding code stops being accepted. */
const windows: Map<string, number> = (globalThis.pcxVerificationWindows ??= new Map());

/**
 * Drops records that have already expired.
 *
 * Without this the Map grows once per distinct address for the lifetime of the
 * process. The sweep is cheap because it only runs when a code is issued or
 * checked, and dropping an expired entry is safe precisely because an absent
 * entry and an expired one mean the same thing to every caller.
 */
function prune(now: number) {
    // forEach rather than for..of: the tsconfig target predates downlevel Map
    // iteration, and deleting during forEach is safe on a Map by spec.
    windows.forEach((expiresAt, key) => {
        if (expiresAt <= now) windows.delete(key);
    });
}

/** Normalizes an address so casing cannot be used to get a second window. */
export function verificationKey(email: string) {
    return email.trim().toLowerCase();
}

/**
 * Starts the 90 seconds. Called once per code that Supabase agrees to mail —
 * from signup and from resend — and returns the TTL so the route can tell the
 * client what to count down from.
 */
export function recordCodeSent(key: string, now = Date.now()): number {
    prune(now);
    windows.set(key, now + TTL_MS);
    return VERIFICATION_CODE_TTL_SECONDS;
}

/**
 * Seconds of life left in the outstanding code, rounded up.
 *
 * Zero means expired, and — deliberately — also means "no record", so the two
 * are indistinguishable to callers. That is the fail-closed direction: a code we
 * cannot prove is fresh is not forwarded to Supabase. It doubles as the answer
 * to "may the user resend yet?", which is true on exactly the same condition.
 */
export function getSecondsUntilExpiry(key: string, now = Date.now()): number {
    prune(now);

    const expiresAt = windows.get(key);
    if (expiresAt === undefined || expiresAt <= now) return 0;

    return Math.ceil((expiresAt - now) / 1000);
}

/** True while the outstanding code may still be presented to Supabase. */
export function isCodeStillValid(key: string, now = Date.now()): boolean {
    return getSecondsUntilExpiry(key, now) > 0;
}

/**
 * Ends the window early.
 *
 * Two callers: a send that failed (no mail left the building, so holding the
 * user at a 90-second wait would punish them for a Supabase-side error), and a
 * verification that succeeded (the code is spent — leaving the record would keep
 * the resend button locked on a page the user has already left).
 */
export function clearVerificationWindow(key: string) {
    windows.delete(key);
}

/** Test helper — the Map is process-wide and would otherwise leak between tests. */
export function resetVerificationWindows() {
    windows.clear();
}
