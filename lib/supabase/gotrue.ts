import { createHash, randomBytes } from "node:crypto";
import {
    ApiError,
    BadRequestError,
    InternalServerError,
    UnauthorizedError,
} from "@/lib/http/errors";
import { authDebug, maskEmail, maskToken } from "@/lib/auth/auth-debug";

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

        // Log exactly what Supabase said, to the server console only.
        //
        // The mappings below deliberately re-word the response (a 401 becomes
        // "Invalid email or password"), which is right for the UI but erases
        // what is needed to tell a bad password from an expired recovery token.
        // This is logged rather than attached to the thrown error because
        // jsonError() serialises ApiError.details straight to the client, so
        // anything put there would leak the upstream body to the browser on
        // every failed sign-in.
        authDebug("supabase responded with an error", {
            endpoint: path,
            status: res.status,
            body: json ?? text ?? null,
        });

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
                "Too many emails have been sent from this Supabase project. " +
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

    // redirectTo is logged in full and unmasked on purpose: a wrong or
    // non-allow-listed value is the failure that cannot be seen any other way,
    // because Supabase answers 200 either way and silently substitutes its own
    // Site URL when the value is not on the dashboard allow-list.
    authDebug("POST /recover -> supabase", { email: maskEmail(email), redirectTo });

    await request<unknown>(`/recover${query}`, { method: "POST", body: { email } });

    authDebug("supabase accepted the recovery request (HTTP 200)", {
        note: "200 means queued for delivery, not that SMTP succeeded",
    });
}

/** Exchanges a recovery OTP for a session so the password can be changed. */
export async function verifyRecoveryOtp(email: string, token: string) {
    return request<SupabaseSession>("/verify", {
        method: "POST",
        body: { type: "recovery", email, token },
    });
}

/**
 * Exchanges the `token_hash` from a recovery email link for a session — the
 * wire equivalent of `supabase.auth.verifyOtp({ type: 'recovery', token_hash })`.
 *
 * Unlike verifyRecoveryOtp above this takes no email: the hash already
 * identifies the user, which is what lets the reset page work from the link
 * alone without asking the user to re-type the address they just requested it
 * for (and without letting a caller aim a token at a different account).
 *
 * Only reachable when the project's recovery template emits `{{ .TokenHash }}`.
 * With the stock `{{ .ConfirmationURL }}` template GoTrue verifies the token
 * itself and hands us an access token instead — see lib/auth/recovery-link.ts.
 */
export async function verifyRecoveryTokenHash(tokenHash: string) {
    authDebug("POST /verify (type=recovery) -> supabase", { tokenHash: maskToken(tokenHash) });

    const session = await request<SupabaseSession>("/verify", {
        method: "POST",
        body: { type: "recovery", token_hash: tokenHash },
    });

    authDebug("recovery token exchanged for a session", { userId: session.user?.id });
    return session;
}

/** Sets a new password using a session obtained from a recovery token. */
export async function updatePassword(accessToken: string, password: string) {
    authDebug("PUT /user (set new password) -> supabase", {
        accessToken: maskToken(accessToken),
    });

    const user = await request<SupabaseUser>("/user", {
        method: "PUT",
        body: { password },
        accessToken,
    });

    authDebug("supabase updated the password", { userId: user.id, email: user.email });
    return user;
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

/**
 * Per-provider scope overrides.
 *
 * Microsoft is the one that needs this. Entra ID will happily issue a token
 * with no email claim under its default scopes, and GoTrue then rejects the
 * code exchange with "Error getting user email from external provider" —
 * *after* the user has already signed in and consented, so it presents as a
 * broken callback rather than as a missing scope. Asking for `email` up front
 * is what Supabase's own Azure documentation prescribes.
 *
 * Google returns the email under its defaults, so it gets no override.
 */
export const OAUTH_SCOPES: Partial<Record<OAuthProviderKey, string>> = {
    microsoft: "email",
};

/**
 * The `external` map from GET /auth/v1/settings — which providers the project
 * actually has switched on. Keyed by Supabase's slug (so `azure`, not
 * `microsoft`).
 */
export type GoTrueSettings = { external?: Record<string, boolean> } | null | undefined;

/**
 * Whether `provider` is enabled, given a settings payload.
 *
 * Fails OPEN. This lookup exists only to turn a dead-end Supabase error page
 * into a sentence on our own sign-in page; if the payload is missing, malformed
 * or from a GoTrue version that renames the field, the right move is to let the
 * authorize request proceed and have Supabase be the judge — never to block a
 * login that would otherwise have worked.
 */
export function readEnabledProviders(
    settings: GoTrueSettings,
    provider: OAuthProviderKey
): boolean {
    const external = settings?.external;
    if (!external || typeof external !== "object") return true;

    const value = external[OAUTH_PROVIDERS[provider]];
    return typeof value === "boolean" ? value : true;
}

/**
 * Cached because every sign-in click would otherwise pay a round trip to
 * Supabase before the redirect. Sixty seconds is short enough that flipping the
 * provider on in the dashboard takes effect while you are still looking at the
 * page.
 */
let settingsCache: { value: GoTrueSettings; expiresAt: number } | null = null;

export async function fetchGoTrueSettings(): Promise<GoTrueSettings> {
    if (settingsCache && settingsCache.expiresAt > Date.now()) return settingsCache.value;

    try {
        const value = await request<GoTrueSettings>("/settings", { method: "GET" });
        settingsCache = { value, expiresAt: Date.now() + 60_000 };
        return value;
    } catch (error) {
        authDebug("could not read /auth/v1/settings; skipping the provider check", {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/** Whether the Supabase dashboard has this provider enabled. Fails open. */
export async function isProviderEnabled(provider: OAuthProviderKey): Promise<boolean> {
    return readEnabledProviders(await fetchGoTrueSettings(), provider);
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

    // Explicit scopes win; otherwise fall back to the provider's own
    // requirement (see OAUTH_SCOPES — Microsoft needs `email`).
    const scopes = options.scopes ?? OAUTH_SCOPES[options.provider];
    if (scopes) authorize.searchParams.set("scopes", scopes);

    return authorize.toString();
}

/** Exchanges the ?code= from the OAuth callback for a session. */
export async function exchangeCodeForSession(authCode: string, codeVerifier: string) {
    return request<SupabaseSession>("/token?grant_type=pkce", {
        method: "POST",
        body: { auth_code: authCode, code_verifier: codeVerifier },
    });
}
