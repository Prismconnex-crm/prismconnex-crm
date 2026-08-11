import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import {
    isOAuthProviderKey,
    isProviderEnabled,
    isSupabaseAuthConfigured,
} from "@/lib/supabase/gotrue";
import { PKCE_VERIFIER_COOKIE } from "@/lib/auth/session";
import { authDebug } from "@/lib/auth/auth-debug";

/**
 * Starts Google / Microsoft sign-in.
 *
 * Replaces /api/auth/cognito-url, which redirected to the Cognito hosted UI and
 * silently bounced back to the sign-in page whenever Cognito was unconfigured.
 *
 * PKCE: we generate the verifier here, send only its S256 hash to Supabase, and
 * keep the verifier in an httpOnly cookie so the callback can prove it started
 * this flow. sameSite=lax is required — the browser must send the cookie on the
 * top-level GET navigation back from the provider, which `strict` would block.
 *
 * The provider must be enabled in the Supabase dashboard (Authentication →
 * Providers) and the callback URL added to Authentication → URL Configuration →
 * Redirect URLs, or Supabase rejects the authorize request.
 */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
    const signInUrl = new URL("/auth/sign-in", req.nextUrl.origin);

    if (!isSupabaseAuthConfigured()) {
        signInUrl.searchParams.set("error", "provider_unavailable");
        return NextResponse.redirect(signInUrl);
    }

    if (!isOAuthProviderKey(params.provider)) {
        signInUrl.searchParams.set("error", "unsupported_provider");
        return NextResponse.redirect(signInUrl);
    }

    // Ask Supabase whether the provider is actually switched on before handing
    // the browser over to it.
    //
    // Without this, a provider that is disabled in the dashboard sends the user
    // to https://<project>.supabase.co/auth/v1/authorize?... which answers
    //
    //   400 {"error_code":"validation_failed",
    //        "msg":"Unsupported provider: provider is not enabled"}
    //
    // as raw JSON. The user is stranded on a supabase.co URL with no way back
    // and the app never regains control, so it cannot explain anything. The
    // check fails open (see readEnabledProviders), so it can only ever convert
    // that dead end into a message — never block a login that would have worked.
    if (!(await isProviderEnabled(params.provider))) {
        authDebug("oauth provider is disabled in the Supabase dashboard", {
            provider: params.provider,
            fix: "Supabase → Authentication → Providers → enable it and save the client id/secret",
        });

        signInUrl.searchParams.set("error", "provider_disabled");
        signInUrl.searchParams.set("provider", params.provider);
        return NextResponse.redirect(signInUrl);
    }

    // APP_URL matters behind a proxy or tunnel, where the request origin is not
    // the URL registered with Supabase and the provider.
    const origin = process.env.APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;

    const { authorizeUrl, codeVerifier } = AuthService.startOAuth(
        params.provider,
        `${origin}/auth/callback`
    );

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(PKCE_VERIFIER_COOKIE, codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 10,
    });

    return response;
}
