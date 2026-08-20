import { z } from "zod";
import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { UnauthorizedError } from "@/lib/http/errors";
import {
    applySessionCookies,
    applySupabaseTokenCookie,
    clearPendingMfaCookie,
    createAppSessionToken,
    readPendingMfa,
} from "@/lib/auth/session";
import { resolveOnboardingState } from "@/lib/auth/tenant";
import * as gotrue from "@/lib/supabase/gotrue";
import { ProfileService } from "@/services/profile.service";

/**
 * Second step of sign-in for accounts with 2FA enabled.
 *
 * /api/auth/sign-in verified the password and parked the aal1 session in the
 * pcx_mfa cookie. This route is the ONLY way that pending state turns into a
 * real session: the code is verified against Supabase, which returns an aal2
 * session, and only then is pcx_session minted.
 *
 * Every failure path clears the pending cookie or leaves it to expire on its
 * own five-minute timer — a pending state that outlives its usefulness is a
 * password-only foothold, so it is never refreshed or extended here.
 */
const BodySchema = z.object({
    code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

export async function POST(request: Request) {
    try {
        const { code } = validateBody(BodySchema, await request.json());

        const pending = readPendingMfa();
        if (!pending) {
            throw new UnauthorizedError(
                "Your sign-in attempt has expired. Please enter your password again."
            );
        }

        let session: gotrue.SupabaseSession;
        try {
            session = await gotrue.verifyFactor(
                pending.access_token,
                pending.factorId,
                pending.challengeId,
                code
            );
        } catch {
            // The challenge is single-use; a wrong code burns it. Sending the
            // user back to the password step is what Supabase's own model
            // requires, and saying so is better than an unexplained retry that
            // would fail identically.
            return clearPendingMfaCookie(
                jsonError(
                    new UnauthorizedError(
                        "That code was not accepted. Please sign in again and use a fresh code."
                    )
                )
            );
        }

        const profile = await ProfileService.ensureProfileForSession(session.user);
        await ProfileService.recordLogin(session.user.id);

        const { onboarded, workspaceId } = await resolveOnboardingState({
            supabaseUserId: session.user.id,
            email: profile.email,
        });

        const token = await createAppSessionToken({
            sub: session.user.id,
            email: profile.email,
            workspaceId,
        });

        const response = jsonOk({ ok: true, onboarded, profile });
        applySessionCookies(response, { token, onboarded });
        applySupabaseTokenCookie(response, {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        });

        return clearPendingMfaCookie(response);
    } catch (error) {
        return jsonError(error);
    }
}
