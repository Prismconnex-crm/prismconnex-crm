/**
 * Understands the URL Supabase lands the user on after they click "Reset
 * password" in the recovery email.
 *
 * There are two possible shapes, and which one arrives depends on a setting in
 * the Supabase dashboard rather than on anything in this repo — so the reset
 * page handles both and needs no template change to work:
 *
 *   1. Default template — `{{ .ConfirmationURL }}`
 *      The link points at GoTrue (`<project>/auth/v1/verify?token=...`), which
 *      consumes the token itself and 302s to our `redirect_to` with the whole
 *      session in the URL *fragment*:
 *          /auth/reset-password#access_token=...&refresh_token=...&type=recovery
 *      The token is already spent by the time we see it; the access token is
 *      what authorises the password change.
 *
 *   2. Token-hash template — `{{ .TokenHash }}`, the shape Supabase's current
 *      docs recommend:
 *          /auth/reset-password?token_hash=...&type=recovery
 *      Nothing has been verified yet, so we exchange it server-side.
 *
 * Expired or already-used links redirect with an error in the fragment instead
 * of a token. Those must be distinguished from "user typed the URL by hand" —
 * the two need very different messages ("request a new link" vs "start here").
 *
 * The fragment never reaches the server (browsers don't send it), which is why
 * this runs on the client and the page is a client component.
 */

export type RecoveryLink =
    /** Session already established by GoTrue; use the token to set the password. */
    | { kind: "access_token"; accessToken: string }
    /** Unverified token; the server must exchange it before setting the password. */
    | { kind: "token_hash"; tokenHash: string }
    /** PKCE authorization code; the server exchanges it for a session. */
    | { kind: "code"; code: string }
    /** Supabase rejected the link — expired, already used, or malformed. */
    | { kind: "error"; code: string; description: string | null }
    /** No recovery information at all; the page was opened directly. */
    | { kind: "missing" };

/** The link shapes that actually carry a credential, as opposed to an error. */
export function isRecoveryCredential(
    link: RecoveryLink
): link is Extract<RecoveryLink, { kind: "access_token" | "token_hash" | "code" }> {
    return link.kind === "access_token" || link.kind === "token_hash" || link.kind === "code";
}

/**
 * `URLSearchParams` handles the percent-decoding, including the `+`-as-space
 * convention GoTrue uses in `error_description`, which a hand-rolled split on
 * "&" and "=" would get wrong.
 */
function toParams(raw: string) {
    return new URLSearchParams(raw.replace(/^[#?]/, ""));
}

/** Treats a present-but-empty parameter as absent. */
function value(params: URLSearchParams, key: string) {
    const raw = params.get(key);
    return raw && raw.trim() ? raw : null;
}

export function parseRecoveryLink({ search, hash }: { search: string; hash: string }): RecoveryLink {
    const fragment = toParams(hash);
    const query = toParams(search);

    // The fragment is checked first: when GoTrue has already verified the token
    // it is the authoritative source, and any ?token_hash= still sitting in the
    // query would be spent.
    const accessToken = value(fragment, "access_token") ?? value(query, "access_token");
    if (accessToken) {
        return { kind: "access_token", accessToken };
    }

    const tokenHash = value(query, "token_hash") ?? value(fragment, "token_hash");
    if (tokenHash) {
        return { kind: "token_hash", tokenHash };
    }

    // PKCE. Checked after token_hash because a PKCE-issued token_hash is itself
    // prefixed "pkce_" and arrives in the same query string; when both are
    // present the token_hash is the one /verify accepts.
    //
    // Ordered before the error branch so a link carrying both `code` and a stale
    // `error` from an earlier hop still gets exchanged.
    const authCode = value(query, "code") ?? value(fragment, "code");
    if (authCode) {
        return { kind: "code", code: authCode };
    }

    // `error_code` is the machine-readable one (otp_expired, ...); `error` is
    // the OAuth-style category (access_denied). Either may appear alone.
    const code =
        value(fragment, "error_code") ??
        value(query, "error_code") ??
        value(fragment, "error") ??
        value(query, "error");

    if (code) {
        return {
            kind: "error",
            code,
            description: value(fragment, "error_description") ?? value(query, "error_description"),
        };
    }

    return { kind: "missing" };
}

/** True when the link failed because it aged out or was already used. */
export function isExpiredRecoveryError(code: string) {
    return /expired|otp_expired|access_denied/i.test(code);
}

/**
 * Returns a reader that parses the URL once and then keeps answering with that
 * first result, whatever the URL says later.
 *
 * This exists because reading the link and *scrubbing* it are the same step. The
 * reset page strips the credential out of the address bar as soon as it has it
 * (a recovery access token is a bearer credential — left in the URL it lands in
 * browser history and in the Referer of any outbound link). That scrub destroys
 * the only source of truth, so anything that reads the URL a second time sees a
 * bare pathname and concludes there was never a token at all.
 *
 * A second read is not hypothetical: React StrictMode — on by default for the
 * App Router whenever next.config.mjs omits `reactStrictMode` — deliberately
 * runs mount effects twice in development. The first pass captured the token and
 * cleaned the URL; the second re-parsed the cleaned URL, got `missing`, and
 * overwrote the state, so every valid link rendered as "Invalid reset link".
 *
 * Memoising the parse makes the read idempotent, which is the property the
 * scrubbing broke. Keep one reader per mounted page (a ref), not a module-level
 * singleton, so a genuinely new visit re-reads the new URL.
 */
export function createRecoveryLinkReader() {
    let captured: RecoveryLink | null = null;

    return function readRecoveryLink(location: { search: string; hash: string }): RecoveryLink {
        captured ??= parseRecoveryLink(location);
        return captured;
    };
}
