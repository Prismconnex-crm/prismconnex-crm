import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import {
    applyPendingMfaCookie,
    applySessionCookies,
    applySupabaseTokenCookie,
    createAppSessionToken,
    PKCE_VERIFIER_COOKIE,
} from "@/lib/auth/session";
import { resolveOnboardingState } from "@/lib/auth/tenant";
import { authDebug } from "@/lib/auth/auth-debug";
import * as gotrue from "@/lib/supabase/gotrue";
import { AccountSecurityService } from "@/services/account-security.service";
import { ProfileService } from "@/services/profile.service";

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
        // error_description is where Google and Entra ID put the sentence that
        // actually says what went wrong; `error` alone is usually just
        // "access_denied" or "server_error". Log both — the sign-in page can
        // only render one of a closed set of codes (lib/auth/oauth-errors.ts),
        // so this is the one place the provider's own wording survives.
        authDebug("provider redirected back with an error", {
            error: searchParams.get("error"),
            error_code: searchParams.get("error_code"),
            error_description: searchParams.get("error_description"),
        });

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

        // A soft-deleted account still has working provider credentials, so the
        // block belongs here as well as on the password path.
        AccountSecurityService.assertSignInAllowed(profile.accountStatus);

        // ── Second factor, same gate as the password path ──
        //
        // Supabase links a Google/Microsoft identity to an existing account by
        // email, so without this check anyone who enrolled TOTP after signing
        // up with a password could skip it entirely by clicking "Continue with
        // Google". The second factor has to gate every route to a session, not
        // just the one it was added to.
        //
        // The pending state is parked exactly as on the password path, and the
        // user is redirected to the sign-in page, which renders the code step
        // from ?mfa=1 without asking for the password again.
        const factors = await gotrue.listFactors(session.access_token).catch(() => []);
        const verifiedFactor = gotrue.findVerifiedTotpFactor(factors);

        if (verifiedFactor) {
            const challenge = await gotrue.challengeFactor(
                session.access_token,
                verifiedFactor.id
            );

            const mfaUrl = new URL("/auth/sign-in", req.nextUrl.origin);
            mfaUrl.searchParams.set("mfa", "1");

            const pendingResponse = NextResponse.redirect(mfaUrl);
            pendingResponse.cookies.delete(PKCE_VERIFIER_COOKIE);

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
        // Deliberately server-side only. The upstream message is the useful
        // one ("Error getting user email from external provider", "invalid
        // request: both auth code and code verifier should be non-empty"), but
        // it describes the project's Supabase/provider configuration, so it
        // stays out of the redirect the browser follows.
        console.error(
            "[OAuth callback] code exchange failed:",
            error instanceof Error ? error.message : error
        );

        return failure(req, "oauth_exchange_failed");
    }
}
