/**
 * The error vocabulary shared by the OAuth routes and the sign-in page.
 *
 * /api/auth/oauth/[provider] and /auth/callback can only talk to the sign-in
 * page through a query parameter, so the set of things they are allowed to say
 * has to be closed and agreed in one place. Keeping it here means adding a
 * failure mode to a route and forgetting to give it a message is a test
 * failure (tests/integration/oauth.test.ts) rather than a next-intl crash on
 * the sign-in page.
 *
 * The value arrives from the URL and is therefore attacker-controlled, which is
 * why resolveOAuthErrorCode() folds anything unrecognised into "unknown"
 * instead of passing it through to a message lookup.
 */
export const OAUTH_ERROR_CODES = [
    /** SUPABASE_URL / SUPABASE_ANON_KEY missing from the environment. */
    "provider_unavailable",
    /** The :provider segment was not "google" or "microsoft". */
    "unsupported_provider",
    /** The provider is off in Supabase → Authentication → Providers. */
    "provider_disabled",
    /** The provider redirected back without a ?code. */
    "missing_code",
    /** The PKCE verifier cookie was gone — stale tab, or >10 min at consent. */
    "expired_oauth_state",
    /** The code→session exchange was rejected by Supabase. */
    "oauth_exchange_failed",
    /** The user cancelled at the provider's consent screen. */
    "access_denied",
] as const;

export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

/** Every code, plus the catch-all the sign-in page falls back to. */
export type OAuthErrorKey = OAuthErrorCode | "unknown";

export function resolveOAuthErrorCode(raw: string | null | undefined): OAuthErrorKey {
    if (!raw) return "unknown";
    return (OAUTH_ERROR_CODES as readonly string[]).includes(raw)
        ? (raw as OAuthErrorCode)
        : "unknown";
}
