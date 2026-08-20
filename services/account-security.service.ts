import * as gotrue from "@/lib/supabase/gotrue";
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors";

/**
 * Security operations on the signed-in user's own account.
 *
 * Everything here talks to Supabase Auth with the USER's access token. No
 * password, secret or TOTP seed is ever written to our Postgres — the only
 * thing this app persists about security state is nothing at all; the factor
 * list is read back from Supabase on demand.
 */

export type MfaStatus = {
    enabled: boolean;
    /** Present while enrolment is half-finished (scanned, never verified). */
    pendingFactorId: string | null;
    verifiedFactorId: string | null;
    friendlyName: string | null;
    enrolledAt: string | null;
};

export class AccountSecurityService {
    /**
     * Changes the password, verifying the current one first.
     *
     * Supabase's PUT /user will happily set a new password from an access
     * token alone, without re-checking the old one. That is the right default
     * for a recovery link, and the wrong behaviour here: it means anyone with a
     * borrowed session — an unlocked laptop, a stolen cookie — could lock the
     * real owner out. So the current password is proved first, by exchanging it
     * for a session through the ordinary password grant.
     *
     * That extra grant is deliberately NOT stored: it exists only to be
     * verified. The update then runs on the caller's own live token.
     */
    static async changePassword(params: {
        email: string;
        accessToken: string;
        currentPassword: string;
        newPassword: string;
    }): Promise<void> {
        try {
            await gotrue.signInWithPassword(params.email, params.currentPassword);
        } catch {
            // Uniform message: a distinct "wrong current password" is correct
            // here (the caller is already authenticated, so there is nothing to
            // enumerate) and is what makes the error actionable.
            throw new BadRequestError("Your current password is incorrect");
        }

        await gotrue.updatePassword(params.accessToken, params.newPassword);
    }

    /** Current 2FA state, read from Supabase rather than cached locally. */
    static async getMfaStatus(accessToken: string): Promise<MfaStatus> {
        const factors = await gotrue.listFactors(accessToken);
        const verified = gotrue.findVerifiedTotpFactor(factors);
        const pending = factors.find(
            (f) => f.factor_type === "totp" && f.status === "unverified"
        );

        return {
            enabled: Boolean(verified),
            verifiedFactorId: verified?.id ?? null,
            pendingFactorId: pending?.id ?? null,
            friendlyName: (verified ?? pending)?.friendly_name ?? null,
            enrolledAt: verified?.created_at ?? null,
        };
    }

    /**
     * Starts TOTP enrolment and returns the QR/secret to display.
     *
     * Any half-finished previous attempt is removed first. Supabase rejects a
     * second enrolment while an unverified factor exists, which without this
     * cleanup makes "cancel, then try again" fail permanently with an opaque
     * error — the single most likely way for a user to get stuck here.
     */
    static async beginMfaEnrolment(accessToken: string, friendlyName: string) {
        const status = await this.getMfaStatus(accessToken);

        if (status.enabled) {
            throw new BadRequestError(
                "Two-factor authentication is already enabled on this account"
            );
        }

        if (status.pendingFactorId) {
            await gotrue.unenrollFactor(accessToken, status.pendingFactorId).catch(() => {
                // Already gone — nothing to clean up.
            });
        }

        const factor = await gotrue.enrollTotpFactor(accessToken, friendlyName);

        return {
            factorId: factor.id,
            qrCode: factor.totp.qr_code,
            secret: factor.totp.secret,
            uri: factor.totp.uri,
        };
    }

    /**
     * Confirms enrolment with the first code from the authenticator app.
     *
     * Returns the upgraded (aal2) session, which the caller MUST store in place
     * of the one it holds — otherwise the user stays at aal1 and the very next
     * security action fails an assurance check.
     */
    static async confirmMfaEnrolment(params: {
        accessToken: string;
        factorId: string;
        code: string;
    }): Promise<gotrue.SupabaseSession> {
        const challenge = await gotrue.challengeFactor(params.accessToken, params.factorId);

        try {
            return await gotrue.verifyFactor(
                params.accessToken,
                params.factorId,
                challenge.id,
                params.code
            );
        } catch {
            throw new BadRequestError(
                "That code is not valid. Check your authenticator app and try again — " +
                    "codes expire after about 30 seconds."
            );
        }
    }

    /**
     * Turns 2FA off.
     *
     * Requires a valid current code rather than just a session. Disabling is a
     * security downgrade, and allowing it from a borrowed session would make
     * the whole feature bypassable by whoever the 2FA was protecting against.
     */
    static async disableMfa(params: {
        accessToken: string;
        code: string;
    }): Promise<void> {
        const status = await this.getMfaStatus(params.accessToken);
        if (!status.verifiedFactorId) {
            throw new BadRequestError("Two-factor authentication is not enabled");
        }

        const challenge = await gotrue.challengeFactor(
            params.accessToken,
            status.verifiedFactorId
        );

        try {
            await gotrue.verifyFactor(
                params.accessToken,
                status.verifiedFactorId,
                challenge.id,
                params.code
            );
        } catch {
            throw new BadRequestError("That code is not valid. Try again.");
        }

        await gotrue.unenrollFactor(params.accessToken, status.verifiedFactorId);
    }

    /**
     * Cancels a half-finished enrolment. Safe to call when there is none.
     */
    static async cancelMfaEnrolment(accessToken: string): Promise<void> {
        const status = await this.getMfaStatus(accessToken);
        if (!status.pendingFactorId) return;
        await gotrue.unenrollFactor(accessToken, status.pendingFactorId);
    }

    /**
     * Revokes every refresh token for the user — "log out from all devices".
     *
     * scope=global is the same call the ordinary sign-out already makes, which
     * is why this needs no new Supabase capability. The caller is responsible
     * for clearing this browser's cookies too; without that the user keeps a
     * valid pcx_session locally while every other device is cut off.
     */
    static async signOutEverywhere(accessToken: string): Promise<void> {
        await gotrue.signOut(accessToken, "global");
    }

    /**
     * Whether the account may sign in, given its profile status.
     *
     * Kept here rather than in the sign-in route so the rule has one home.
     */
    static assertSignInAllowed(accountStatus: string) {
        if (accountStatus === "deleted") {
            throw new UnauthorizedError(
                "This account has been deleted and can no longer be used."
            );
        }
    }
}
