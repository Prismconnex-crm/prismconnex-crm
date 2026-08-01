import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import {
    applySessionCookies,
    applySupabaseTokenCookie,
    createAppSessionToken,
    PKCE_VERIFIER_COOKIE,
} from "@/lib/auth/session";
import { resolveOnboardingState } from "@/lib/auth/tenant";

/**
 * OAuth callback for Google / Microsoft sign-in via Supabase.
 *
 * Previously this route signed a session for ANY `code` value using a
 * hard-coded email, which meant hitting /auth/callback?code=x logged you in as
 * owner@prismconnex.demo. It now performs the real PKCE exchange.
 *
 * A profile is guaranteed here two ways: the on_auth_user_created trigger fires
 * when Supabase inserts the auth.users row on first OAuth login, and
 * AuthService.completeOAuth additionally calls ensureProfile() as a fallback.
 * An existing profile is never overwritten.
 */
function failure(req: NextRequest, reason: string) {
    const url = new URL("/auth/sign-in", req.nextUrl.origin);
    url.searchParams.set("error", reason);

    const response = NextResponse.redirect(url);
    response.cookies.delete(PKCE_VERIFIER_COOKIE);
    return response;
}

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;

    // The provider reports its own failures (consent denied, etc.) here.
    if (searchParams.get("error")) {
        return failure(req, searchParams.get("error") ?? "oauth_error");
    }

    const code = searchParams.get("code");
    const codeVerifier = req.cookies.get(PKCE_VERIFIER_COOKIE)?.value;

    if (!code) return failure(req, "missing_code");

    // No verifier means this callback did not originate from our authorize
    // request — the PKCE guarantee we rely on instead of a state parameter.
    if (!codeVerifier) return failure(req, "expired_oauth_state");

    try {
        const { session, profile } = await AuthService.completeOAuth(code, codeVerifier);

        const { onboarded, workspaceId } = await resolveOnboardingState({
            supabaseUserId: session.user.id,
            email: profile.email,
        });

        const token = await createAppSessionToken({
            sub: session.user.id,
            email: profile.email,
            workspaceId,
        });

        // A returning user goes straight to the app; a first-time OAuth user
        // still needs a workspace, so send them through onboarding.
        const destination = onboarded ? "/app/dashboard" : "/onboarding";

        const response = NextResponse.redirect(new URL(destination, req.nextUrl.origin));
        applySessionCookies(response, { token, onboarded });

        // Retained (httpOnly) so sign-out can revoke the Supabase session.
        applySupabaseTokenCookie(response, {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        });

        response.cookies.delete(PKCE_VERIFIER_COOKIE);

        return response;
    } catch (error) {
        console.error("[OAuth callback]", error);
        return failure(req, "oauth_exchange_failed");
    }
}
