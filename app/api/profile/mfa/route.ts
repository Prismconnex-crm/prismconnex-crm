import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { requireSessionUser } from "@/lib/auth/require-session";
import { requireSupabaseAccessToken } from "@/lib/supabase/access-token";
import { MfaCodeSchema } from "@/models/profile";
import { AccountSecurityService } from "@/services/account-security.service";

/**
 * Two-factor authentication (TOTP).
 *
 *   GET    — current status
 *   POST   — begin enrolment; returns the QR code and secret
 *   DELETE — disable, which requires a valid current code
 *
 * Confirming an enrolment is a separate route (./verify) because it returns a
 * new session that has to be written to the cookie, and keeping that side
 * effect in one place makes it hard to forget.
 *
 * No secret is ever persisted by this app. The factor lives in Supabase and is
 * read back on demand, so there is no local copy to leak or to go stale.
 */

export async function GET() {
    try {
        await requireSessionUser();
        const accessToken = await requireSupabaseAccessToken();

        return jsonOk({ mfa: await AccountSecurityService.getMfaStatus(accessToken) });
    } catch (error) {
        return jsonError(error);
    }
}

export async function POST() {
    try {
        await requireSessionUser();
        const accessToken = await requireSupabaseAccessToken();

        const enrolment = await AccountSecurityService.beginMfaEnrolment(
            accessToken,
            "Prismconnex CRM"
        );

        // qrCode and secret are returned to the caller — that is the point of
        // enrolment — but they are NOT logged anywhere, and the factor stays
        // unverified (and therefore inert) until ./verify succeeds.
        return jsonOk({ enrolment });
    } catch (error) {
        return jsonError(error);
    }
}

export async function DELETE(request: Request) {
    try {
        await requireSessionUser();
        const accessToken = await requireSupabaseAccessToken();

        // A code is required to switch 2FA off — see the service for why a
        // session alone is not enough.
        const { code } = validateBody(MfaCodeSchema, await request.json());

        await AccountSecurityService.disableMfa({ accessToken, code });

        return jsonOk({ message: "Two-factor authentication disabled." });
    } catch (error) {
        return jsonError(error);
    }
}
