import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";
import {
    applySessionCookies,
    applySupabaseTokenCookie,
    createAppSessionToken,
} from "@/lib/auth/session";
import { resolveOnboardingState } from "@/lib/auth/tenant";

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
