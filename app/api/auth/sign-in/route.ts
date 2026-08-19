import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";
import {
    applyPendingMfaCookie,
    applySessionCookies,
    applySupabaseTokenCookie,
    createAppSessionToken,
} from "@/lib/auth/session";
import { resolveOnboardingState } from "@/lib/auth/tenant";
import * as gotrue from "@/lib/supabase/gotrue";
import { AccountSecurityService } from "@/services/account-security.service";
import { ProfileService } from "@/services/profile.service";

/**
 * `email` carries whatever the user typed in the identifier field — an email
 * address or an Indian mobile number. AuthService resolves a phone number to an
 * email via public.profiles before calling Supabase, so the field name is kept
 * for wire compatibility with the existing client.
 */
const signInSchema = z.object({
    email: z.string().trim().min(1),
    password: z.string().min(1),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(signInSchema, body);

        // Verifies the password against Supabase Auth and loads the profile.
        // Throws UnauthorizedError (401) on bad credentials — the previous
        // implementation accepted any password without checking.
        const { session, profile } = await AuthService.signIn(data.email, data.password);

        // A soft-deleted account keeps working Supabase credentials — the
        // auth.users row is untouched by our delete — so the block has to be
        // here, after the password check and before any session is issued.
        AccountSecurityService.assertSignInAllowed(profile.accountStatus);

        // ── Second factor, when the account has one ──
        //
        // Supabase hands back a session at aal1 even for a user with a verified
        // TOTP factor; it does not refuse the password grant. So the gate is
        // ours to build: if a verified factor exists we do NOT mint the app
        // session here. The aal1 tokens are parked in a short-lived httpOnly
        // cookie and the client is sent to the code step, which is the only
        // path that can complete the sign-in.
        //
        // Users without 2FA never enter this branch, so the existing flow —
        // and every existing client — is unchanged.
        const factors = await gotrue
            .listFactors(session.access_token)
            .catch(() => []);
        const verifiedFactor = gotrue.findVerifiedTotpFactor(factors);

        if (verifiedFactor) {
            const challenge = await gotrue.challengeFactor(
                session.access_token,
                verifiedFactor.id
            );

            const pendingResponse = jsonOk({ ok: true, mfaRequired: true });

            return applyPendingMfaCookie(pendingResponse, {
                factorId: verifiedFactor.id,
                challengeId: challenge.id,
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                email: profile.email,
            });
        }

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

        // Retained (httpOnly) so sign-out can revoke the Supabase session.
        return applySupabaseTokenCookie(response, {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        });
    } catch (error) {
        return jsonError(error);
    }
}
