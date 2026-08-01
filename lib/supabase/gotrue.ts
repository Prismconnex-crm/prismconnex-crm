import { createHash, randomBytes } from "node:crypto";
import {
    ApiError,
    BadRequestError,
    InternalServerError,
    UnauthorizedError,
} from "@/lib/http/errors";

/**
 * Thin wrapper over the Supabase Auth (GoTrue) REST API.
 *
 * Deliberately dependency-free — `@supabase/supabase-js` would work
 * identically, but every endpoint we need is a plain JSON POST and the project
 * avoids new installs. This module is the single place that knows the wire
 * format, mirroring the role lib/auth/cognito.ts played for Cognito.
 *
 * The anon key is sufficient for all of these: signup, the password grant, and
 * the OAuth authorize/PKCE endpoints are all public. Nothing here needs the
 * service_role key.
 */

export type SupabaseUser = {
    id: string;
    email?: string | null;
    phone?: string | null;
    created_at?: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

export type SupabaseSession = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    user: SupabaseUser;
};

export type SignUpMetadata = {
    first_name: string;
    middle_name?: string;
    last_name: string;
    phone?: string;
};

function config() {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    // Guard with a readable message. The previous Cognito implementation passed
    // an empty clientId straight through to AWS, which surfaced as a raw
    // "2 validation errors detected: Value '' at 'clientId' failed to satisfy
    // constraint" response to the end user.
    if (!url || !anonKey) {
        throw new InternalServerError(
            "Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env."
        );
    }

    return { url: url.replace(/\/$/, ""), anonKey };
}

export function isSupabaseAuthConfigured() {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

/** GoTrue error bodies vary by version; pull a usable message out of any shape. */
function extractMessage(body: unknown, fallback: string) {
    if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        for (const key of ["error_description", "msg", "message", "error"]) {
            const value = b[key];
            if (typeof value === "string" && value.trim()) return value;
        }
    }
    return fallback;
}

async function request<T>(
    path: string,
    init: { method: "GET" | "POST" | "PUT"; body?: unknown; accessToken?: string }
): Promise<T> {
    const { url, anonKey } = config();

    const res = await fetch(`${url}/auth/v1${path}`, {
        method: init.method,
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${init.accessToken ?? anonKey}`,
            "Content-Type": "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
    });

    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;

    if (!res.ok) {
        const message = extractMessage(json, "Authentication request failed");

        // 400 from GoTrue covers both "bad credentials" and "bad input"; map the
        // credential cases to 401 so the UI can distinguish them.
        if (res.status === 401 || /invalid login credentials/i.test(message)) {
            throw new UnauthorizedError("Invalid email or password");
        }
        if (/email not confirmed/i.test(message)) {
            throw new UnauthorizedError("Please confirm your email address before signing in");
        }

        // Supabase's built-in email service is capped at a few messages per
        // hour for the whole project, and every signup with email confirmation
        // enabled spends one. Preserve the 429 instead of flattening it into a
        // generic 400, and say what to do about it — the raw GoTrue text
        // ("email rate limit exceeded") reads like an application bug.
        if (res.status === 429) {
            throw new ApiError(
                "Too many confirmation emails have been sent from this Supabase project. " +
                    "The built-in email service allows only a few per hour — wait and retry, " +
                    "or configure a custom SMTP provider in the Supabase dashboard.",
                429
            );
        }

        if (res.status >= 500) {
            throw new InternalServerError(message);
        }
        throw new BadRequestError(message);
    }

    return json as T;
}

/**
 * Creates the user in Supabase Auth. The password is hashed and stored by
 * Supabase in auth.users.encrypted_password — never in our database.
 *
 * `data` becomes auth.users.raw_user_meta_data, which the on_auth_user_created
 * trigger reads to populate public.profiles.
 *
 * Returns a session only when email confirmation is disabled for the project;
 * with confirmation enabled the caller must send the user to /auth/verify.
 */
export async function signUp(email: string, password: string, data: SignUpMetadata) {
    const result = await request<
        // GoTrue returns the user object directly when there is no session,
        // and an AccessTokenResponse (user nested) when there is one.
        (SupabaseUser & { access_token?: string }) | SupabaseSession
    >("/signup", { method: "POST", body: { email, password, data } });

    if (result && "access_token" in result && result.access_token) {
        const session = result as SupabaseSession;
        return { user: session.user, session };
    }

    return { user: result as SupabaseUser, session: null };
}

/** Verifies a password against Supabase Auth. */
export async function signInWithPassword(email: string, password: string) {
    return request<SupabaseSession>("/token?grant_type=password", {
        method: "POST",
        body: { email, password },
    });
}

/** Confirms a signup with the emailed 6-digit OTP. */
export async function verifySignUpOtp(email: string, token: string) {
    return request<SupabaseSession>("/verify", {
        method: "POST",
        body: { type: "signup", email, token },
    });
}

/** Sends the password-recovery email. */
export async function sendRecoveryEmail(email: string, redirectTo?: string) {
    const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
    await request<unknown>(`/recover${query}`, { method: "POST", body: { email } });
}

/** Exchanges a recovery OTP for a session so the password can be changed. */
export async function verifyRecoveryOtp(email: string, token: string) {
    return request<SupabaseSession>("/verify", {
        method: "POST",
        body: { type: "recovery", email, token },
    });
}

/** Sets a new password using a session obtained from a recovery token. */
export async function updatePassword(accessToken: string, password: string) {
    return request<SupabaseUser>("/user", {
        method: "PUT",
        body: { password },
        accessToken,
    });
}

export async function getUser(accessToken: string) {
    return request<SupabaseUser>("/user", { method: "GET", accessToken });
}

/** Exchanges a refresh token for a fresh session. */
export async function refreshSession(refreshToken: string) {
    return request<SupabaseSession>("/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: refreshToken },
    });
}

/**
 * Revokes the Supabase session — the wire-level equivalent of
 * `supabase.auth.signOut()`.
 *
 * scope:
 *   global (default) — revokes every refresh token for the user, signing them
 *                      out everywhere. This is supabase-js's default.
 *   local            — revokes only the session behind this access token.
 *
 * Requires a NON-expired access token; Supabase access tokens last one hour
 * while our app session lasts eight, so the caller is expected to refresh first
 * (see AuthService.signOut).
 */
export async function signOut(accessToken: string, scope: "global" | "local" = "global") {
    await request<unknown>(`/logout?scope=${scope}`, { method: "POST", accessToken });
}

// ─── OAuth (PKCE) ────────────────────────────────────────────────────

// The PKCE verifier cookie name lives in lib/auth/session.ts alongside the
// other auth cookie names, so sign-out has a single list to clear.

/**
 * Supabase's provider slugs. Note that Microsoft is `azure`, not `microsoft` —
 * getting this wrong yields an opaque "Unsupported provider" redirect.
 */
export const OAUTH_PROVIDERS = {
    google: "google",
    microsoft: "azure",
} as const;

export type OAuthProviderKey = keyof typeof OAUTH_PROVIDERS;

export function isOAuthProviderKey(value: string): value is OAuthProviderKey {
    return Object.prototype.hasOwnProperty.call(OAUTH_PROVIDERS, value);
}

function base64Url(input: Buffer) {
    return input.toString("base64url");
}

/** PKCE verifier: 43–128 chars of unreserved characters. */
export function createCodeVerifier() {
    return base64Url(randomBytes(64));
}

/** S256 challenge = base64url(sha256(verifier)), unpadded. */
export function createCodeChallenge(verifier: string) {
    return base64Url(createHash("sha256").update(verifier).digest());
}

export function buildAuthorizeUrl(options: {
    provider: OAuthProviderKey;
    redirectTo: string;
    codeChallenge: string;
    scopes?: string;
}) {
    const { url } = config();

    const authorize = new URL(`${url}/auth/v1/authorize`);
    authorize.searchParams.set("provider", OAUTH_PROVIDERS[options.provider]);
    authorize.searchParams.set("redirect_to", options.redirectTo);
    authorize.searchParams.set("code_challenge", options.codeChallenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    if (options.scopes) authorize.searchParams.set("scopes", options.scopes);

    return authorize.toString();
}

/** Exchanges the ?code= from the OAuth callback for a session. */
export async function exchangeCodeForSession(authCode: string, codeVerifier: string) {
    return request<SupabaseSession>("/token?grant_type=pkce", {
        method: "POST",
        body: { auth_code: authCode, code_verifier: codeVerifier },
    });
}
