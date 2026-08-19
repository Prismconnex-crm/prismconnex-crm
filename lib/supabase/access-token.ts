import { cookies } from "next/headers";
import { UnauthorizedError } from "@/lib/http/errors";
import { readSupabaseTokens, SUPABASE_TOKEN_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { refreshSession, type SupabaseSession } from "@/lib/supabase/gotrue";

/**
 * Produces a Supabase access token that is valid *right now*.
 *
 * Why this exists at all: this app authenticates with its own eight-hour
 * pcx_session cookie, but Supabase access tokens live one hour. Anything that
 * has to talk to Supabase AS THE USER — changing a password, enrolling a TOTP
 * factor, uploading an avatar under a per-user Storage policy — needs a live
 * token, and the one stored at sign-in is expired for seven of those eight
 * hours. Calling Supabase with the stored token directly therefore works when
 * you test it immediately after logging in and fails for everyone later, which
 * is the worst possible failure shape.
 *
 * AuthService.signOut already solves this narrowly (refresh, then revoke). This
 * is the same trick generalised, plus persistence: the refreshed pair is written
 * back to the cookie, because Supabase ROTATES refresh tokens — the old one is
 * consumed by the refresh. Dropping the new pair would leave the cookie holding
 * a spent refresh token and every later call would fail.
 */

const REFRESH_SKEW_SECONDS = 60;

/**
 * Reads `exp` out of a JWT without verifying it.
 *
 * Unverified is fine and deliberate: this is not an authorization decision, it
 * is a cache-freshness hint about a token we minted nothing of and are about to
 * hand to Supabase, which does the real verification. The worst a corrupted
 * value can cause is an unnecessary refresh.
 */
function secondsUntilExpiry(accessToken: string): number {
    const [, payload] = accessToken.split(".");
    if (!payload) return 0;

    try {
        const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        const exp = typeof json?.exp === "number" ? json.exp : 0;
        return exp - Math.floor(Date.now() / 1000);
    } catch {
        return 0;
    }
}

function persist(tokens: { access_token: string; refresh_token: string }) {
    // Route handlers may mutate cookies; this is the same shape
    // applySupabaseTokenCookie writes on a NextResponse.
    cookies().set(SUPABASE_TOKEN_COOKIE, JSON.stringify(tokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
    });
}

/**
 * A valid access token for the signed-in user.
 *
 * Throws UnauthorizedError when there is nothing to refresh from. That case is
 * real and not an edge: sessions minted by /api/auth/mock-sign-in, and any
 * session predating the pcx_sb cookie, carry no Supabase tokens at all. Callers
 * surface it as "sign in again to do this" rather than a 500.
 */
export async function requireSupabaseAccessToken(): Promise<string> {
    const tokens = readSupabaseTokens();
    if (!tokens) {
        throw new UnauthorizedError(
            "This action needs a Supabase session. Please sign in again."
        );
    }

    if (secondsUntilExpiry(tokens.access_token) > REFRESH_SKEW_SECONDS) {
        return tokens.access_token;
    }

    let refreshed: SupabaseSession;
    try {
        refreshed = await refreshSession(tokens.refresh_token);
    } catch {
        throw new UnauthorizedError(
            "Your session has expired. Please sign in again."
        );
    }

    persist({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
    });

    return refreshed.access_token;
}

/** Stores a session obtained outside sign-in (e.g. the aal2 session after MFA). */
export function storeSupabaseSession(session: SupabaseSession) {
    persist({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
    });
}
