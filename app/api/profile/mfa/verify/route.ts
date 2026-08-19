import { z } from "zod";
import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { requireSessionUser } from "@/lib/auth/require-session";
import {
    requireSupabaseAccessToken,
    storeSupabaseSession,
} from "@/lib/supabase/access-token";
import { AccountSecurityService } from "@/services/account-security.service";

const BodySchema = z.object({
    factorId: z.string().min(1),
    code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

/**
 * Confirms TOTP enrolment with the first code.
 *
 * The verify call returns a NEW session at aal2, and storing it is not
 * optional: keep the old aal1 token and the user is immediately in the state
 * where 2FA is enabled but their own session does not satisfy it, so the next
 * security action fails for no visible reason.
 */
export async function POST(request: Request) {
    try {
        await requireSessionUser();
        const accessToken = await requireSupabaseAccessToken();
        const { factorId, code } = validateBody(BodySchema, await request.json());

        const session = await AccountSecurityService.confirmMfaEnrolment({
            accessToken,
            factorId,
            code,
        });

        storeSupabaseSession(session);

        return jsonOk({
            message:
                "Two-factor authentication is on. You will be asked for a code the next time you sign in.",
            mfa: await AccountSecurityService.getMfaStatus(session.access_token),
        });
    } catch (error) {
        return jsonError(error);
    }
}
