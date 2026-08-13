import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { signLocalSession, verifyLocalSession, type SessionPayload } from "@/lib/auth";

export const SESSION_COOKIE_NAME = "pcx_session";
export const ONBOARDED_COOKIE_NAME = "pcx_onboarded";

/**
 * Holds the PKCE code verifier between /api/auth/oauth/[provider] and
 * /auth/callback. Lives here with the other cookie names so sign-out has one
 * authoritative list to clear.
 */
export const PKCE_VERIFIER_COOKIE = "pcx_pkce_verifier";

/**
 * Holds the Supabase session (access + refresh token) so sign-out can revoke it
 * server-side via Supabase's logout endpoint.
 *
 * httpOnly, so it is unreachable from JavaScript. This mirrors what
 * @supabase/ssr does by default — it persists the session in cookies — and is
 * the only way to hold a revocable handle on the Supabase session, since this
 * app otherwise authenticates with its own pcx_session cookie.
 */
export const SUPABASE_TOKEN_COOKIE = "pcx_sb";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

/** Every cookie that carries auth state. Sign-out must clear all of them. */
export const AUTH_COOKIE_NAMES = [
    SESSION_COOKIE_NAME,
    ONBOARDED_COOKIE_NAME,
    PKCE_VERIFIER_COOKIE,
    SUPABASE_TOKEN_COOKIE,
] as const;

export type StoredSupabaseTokens = {
    access_token: string;
    refresh_token: string;
};

/** Persists the Supabase tokens alongside the app session. */
export function applySupabaseTokenCookie(
    response: NextResponse,
    tokens: StoredSupabaseTokens
) {
    response.cookies.set(SUPABASE_TOKEN_COOKIE, JSON.stringify(tokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
}

/** Reads the stored Supabase tokens, or null if absent/corrupt. */
export function readSupabaseTokens(): StoredSupabaseTokens | null {
    const raw = cookies().get(SUPABASE_TOKEN_COOKIE)?.value;
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<StoredSupabaseTokens>;
        if (!parsed.access_token || !parsed.refresh_token) return null;
        return { access_token: parsed.access_token, refresh_token: parsed.refresh_token };
    } catch {
        return null;
    }
}

export async function setSessionCookie(token: string) {
    cookies().set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
    });
}

export function clearSessionCookie() {
    cookies().delete(SESSION_COOKIE_NAME);
}

/**
 * Mints the app session after Supabase Auth has verified the user.
 *
 * `sub` is the Supabase Auth user id (auth.users.id) — previously this was the
 * hard-coded string "demo-user".
 *
 * We keep issuing our own short-lived HS256 cookie rather than storing
 * Supabase's access/refresh tokens, so middleware.ts, resolveTenant() and every
 * existing API route continue to work unchanged. Supabase access tokens expire
 * after an hour and would otherwise require refresh handling at every call site.
 */
export async function createAppSessionToken(payload: SessionPayload) {
    return signLocalSession(payload);
}

/**
 * Applies the session cookies to a NextResponse.
 *
 * Used by the routes that return a redirect (the OAuth callback), where the
 * cookies() helper cannot be used.
 */
export function applySessionCookies(
    response: NextResponse,
    options: { token: string; onboarded: boolean }
) {
    response.cookies.set(SESSION_COOKIE_NAME, options.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
    });

    response.cookies.set(ONBOARDED_COOKIE_NAME, options.onboarded ? "true" : "false", {
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
}

/**
 * Expires every auth cookie on a response.
 *
 * Set-with-maxAge-0 rather than delete() because the value must be overwritten
 * in the browser even when the cookie was issued with different attributes.
 */
export function clearAuthCookies(response: NextResponse) {
    for (const name of AUTH_COOKIE_NAMES) {
        response.cookies.set(name, "", { path: "/", maxAge: 0 });
    }

    return response;
}

export async function getSessionPayload() {
    const token = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    // Supabase Auth is the provider, but the cookie itself is our own HS256
    // session (see createAppSessionToken), so this is the only verification
    // path. The previous Cognito-first branch has been removed.
    try {
        return await verifyLocalSession(token);
    } catch {
        return null;
    }
}
