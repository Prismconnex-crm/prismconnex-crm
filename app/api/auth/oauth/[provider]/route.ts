import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import { isOAuthProviderKey, isSupabaseAuthConfigured } from "@/lib/supabase/gotrue";
import { PKCE_VERIFIER_COOKIE } from "@/lib/auth/session";

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
