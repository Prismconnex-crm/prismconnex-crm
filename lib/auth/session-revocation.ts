/**
 * Forced invalidation of already-issued app sessions.
 *
 * `pcx_session` is a stateless HS256 JWT (see signLocalSession in lib/auth.ts):
 * nothing is stored server-side, so verifying one proves only that we signed it
 * and that it has not expired. There is no session table to delete from, which
 * means a password reset could not, on its own, evict someone already holding a
 * cookie — the intruder a reset is meant to remove kept full access until the
 * cookie aged out, up to SESSION_MAX_AGE_SECONDS (8 hours).
 *
 * The fix needs no session store. Tokens already carry `iat` (signLocalSession
 * calls setIssuedAt), so stamping one timestamp per account and rejecting
 * anything older is enough to invalidate every outstanding session at once.
 * The stamp lives on User.sessionsValidFrom.
 *
 * This is deliberately cheap to check: resolveTenant() already loads the User
 * row on every request, so the comparison adds no query at all there.
 */

/** Mirrors the UUID guard in lib/auth/tenant.ts — a `sub` may be a legacy id. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a token was issued before the account's sessions were last revoked.
 *
 * `issuedAtSeconds` is the JWT `iat` claim, which is whole seconds; the stamp is
 * a Date with millisecond precision. The stamp is therefore floored to seconds
 * before comparing, and the test is strictly "older than" — a token minted
 * during the same second as the reset is kept.
 *
 * That is the deliberate direction to round in. The alternative rejects the
 * fresh session of the very user who just reset their password, if they sign in
 * inside the same second, which would read as the reset having broken their
 * account. The cost is a sub-second window in which a token issued in the same
 * second as the stamp survives — irrelevant against an attacker who is not
 * already mid-sign-in at that exact instant.
 *
 * A missing `iat` is treated as revoked: every token this app mints has one, so
 * its absence means a token we did not build, and the safe reading of "cannot
 * prove this is newer than the revocation" is to reject.
 */
export function isSessionSuperseded(
    issuedAtSeconds: number | undefined,
    sessionsValidFrom: Date | null | undefined
): boolean {
    // Nothing has ever been revoked for this account — the overwhelmingly
    // common case, and the reason this costs nothing for ordinary users.
    if (!sessionsValidFrom) return false;

    if (typeof issuedAtSeconds !== "number" || !Number.isFinite(issuedAtSeconds)) return true;

    return issuedAtSeconds < Math.floor(sessionsValidFrom.getTime() / 1000);
}

/**
 * Invalidates every session already issued for an account.
 *
 * Resolution order mirrors findSessionUser() in lib/auth/tenant.ts: the Supabase
 * auth id first, falling back to email so records predating Supabase Auth (the
 * seeded demo user) are still covered.
 *
 * `updateMany` rather than `update` so a missing row is a count of zero instead
 * of a thrown P2025 — an account may legitimately have no CRM User row yet.
 *
 * Prisma is imported lazily so this module can be pulled into a test's import
 * graph without constructing a client, the same pattern lib/companies/search.ts
 * uses.
 *
 * Returns whether a row was actually stamped. It never throws: callers run this
 * *after* the password has already been changed, where raising would report a
 * completed reset as failed. A false return is a real problem, though — it means
 * outstanding sessions survive — so it is logged and surfaced to the caller.
 */
export async function revokeIssuedSessions(params: {
    supabaseUserId?: string | null;
    email: string;
}): Promise<boolean> {
    try {
        const { prisma } = await import("@/lib/db/prisma");
        const sessionsValidFrom = new Date();

        if (params.supabaseUserId && UUID_PATTERN.test(params.supabaseUserId)) {
            const byAuthId = await prisma.user.updateMany({
                where: { supabaseUserId: params.supabaseUserId },
                data: { sessionsValidFrom },
            });
            if (byAuthId.count > 0) return true;
        }

        const byEmail = await prisma.user.updateMany({
            where: { email: params.email },
            data: { sessionsValidFrom },
        });

        return byEmail.count > 0;
    } catch (error) {
        console.error("[session-revocation] could not stamp sessionsValidFrom", error);
        return false;
    }
}

/** Resolves just the revocation stamp, mirroring findSessionUser()'s order. */
async function findSessionStamp(sub: string, email: string) {
    const { prisma } = await import("@/lib/db/prisma");

    if (UUID_PATTERN.test(sub)) {
        const byAuthId = await prisma.user.findUnique({
            where: { supabaseUserId: sub },
            select: { sessionsValidFrom: true },
        });
        if (byAuthId) return byAuthId;
    }

    return prisma.user.findUnique({
        where: { email },
        select: { sessionsValidFrom: true },
    });
}

/**
 * Revocation check for callers that do not already hold the User row.
 *
 * resolveTenant() must NOT use this — it loads the row anyway, so it calls
 * isSessionSuperseded() directly and pays nothing. This exists for
 * requireSession() (lib/session.ts), which is otherwise database-free but gates
 * /api/export/*, /api/import and /api/auth/me. Leaving those uncovered would
 * keep the export routes reachable with a revoked cookie, which is exactly the
 * data an evicted intruder would want.
 *
 * Fails open on an infrastructure error: a database outage must not sign every
 * user out, and this is a second line of defence rather than the primary gate.
 */
export async function isSessionRevoked(session: {
    sub: string;
    email: string;
    iat?: number;
}): Promise<boolean> {
    try {
        const stamp = await findSessionStamp(session.sub, session.email);
        return isSessionSuperseded(session.iat, stamp?.sessionsValidFrom);
    } catch (error) {
        console.error("[session-revocation] could not read sessionsValidFrom", error);
        return false;
    }
}
