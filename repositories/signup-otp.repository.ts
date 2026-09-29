import { prisma } from "@/lib/db/prisma";
import { RESEND_COOLDOWN_SECONDS, SIGNUP_OTP_TTL_SECONDS } from "@/models/auth";

/**
 * Reads when Supabase last issued a signup OTP, so the app can enforce a
 * shorter lifetime than the project-wide one.
 *
 * WHY THIS EXISTS INSTEAD OF A SUPABASE SETTING
 *
 * Supabase has exactly one "Email OTP Expiration" knob (Authentication →
 * Sign In / Providers → Email) and it applies to *every* email OTP the project
 * issues — signup confirmation and password recovery alike, with a 60 second
 * floor. Turning it down to 90s to satisfy the signup requirement would also
 * expire every password-reset link after 90 seconds, which is not acceptable.
 * So the global setting stays where it is and the tighter signup deadline is
 * enforced here, per flow.
 *
 * WHY auth.users AND NOT OUR OWN TABLE
 *
 * `confirmation_sent_at` is written by GoTrue itself on both /signup and
 * /resend, which makes it the authoritative issue time with no second store to
 * keep in sync and no migration. Tracking our own timestamp would mean a
 * parallel record of OTP state — the "second authentication system" this
 * deliberately avoids. Supabase Auth stays the only authority; this is a
 * read-only observation of it.
 *
 * The read is intentionally narrow: one column, one row, never any token
 * material. The OTP hash in that table is not selected and must not be.
 */

export const SignUpOtpRepository = {
    /** How long a signup OTP stays valid, in seconds. Shared with the UI timer. */
    ttlSeconds: SIGNUP_OTP_TTL_SECONDS,

    /**
     * When Supabase last sent a confirmation email to `email`.
     *
     * Returns null when there is no such user, or when the row has no
     * `confirmation_sent_at` (nothing was ever sent). Both cases are treated by
     * the caller as "not expired", so that a missing timestamp can never be the
     * reason a legitimate code is refused — GoTrue remains the final judge of
     * whether the code itself is good.
     */
    async findConfirmationSentAt(email: string): Promise<Date | null> {
        const rows = await prisma.$queryRaw<{ confirmation_sent_at: Date | null }[]>`
            SELECT confirmation_sent_at
            FROM auth.users
            WHERE lower(email) = lower(${email})
            LIMIT 1
        `;

        return rows[0]?.confirmation_sent_at ?? null;
    },

    /**
     * Seconds remaining on the current code, floored at 0.
     *
     * Null means "no deadline could be established" (see above), which the
     * caller must read as not-expired rather than as expired.
     */
    secondsRemaining(sentAt: Date | null, now: Date = new Date()): number | null {
        if (!sentAt) return null;

        const elapsedMs = now.getTime() - sentAt.getTime();
        const remainingMs = SIGNUP_OTP_TTL_SECONDS * 1000 - elapsedMs;

        return Math.max(0, Math.ceil(remainingMs / 1000));
    },

    /** How long a resend must still wait. 0 means it may go ahead. */
    cooldownRemaining(sentAt: Date | null, now: Date = new Date()): number {
        // Nothing on record — nothing to throttle. The first send is never a
        // resend, so this must not block it.
        if (!sentAt) return 0;

        const elapsedMs = now.getTime() - sentAt.getTime();
        const remainingMs = RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;

        return Math.max(0, Math.ceil(remainingMs / 1000));
    },

    /** The cooldown length, so the route and the UI quote the same number. */
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
};
