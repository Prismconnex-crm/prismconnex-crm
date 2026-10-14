import { createHash, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/integrations/token-crypto";
import type { CalendarErrorCode } from "./errors";
import {
    calendarScopesFor,
    calendarTokenEndpoint,
    isCalendarProvider,
    missingCalendarEnv,
    oauthAppFor,
    type CalendarProvider,
} from "./providers";

/**
 * Server-side calendar OAuth: token exchange, refresh, API check and the
 * encrypted state cookie. Every failure is a CalendarIntegrationError carrying
 * a code from lib/integrations/calendar/errors.ts, so routes can turn it into a
 * user-facing message without leaking provider responses to the browser.
 */

export class CalendarIntegrationError extends Error {
    constructor(
        public readonly code: CalendarErrorCode,
        detail?: string
    ) {
        super(detail ? `${code}: ${detail}` : code);
        this.name = "CalendarIntegrationError";
    }
}

/** Short-lived, httpOnly, encrypted — carries state + PKCE verifier to the callback. */
export const CALENDAR_STATE_COOKIE = "pcx_cal_oauth";
export const CALENDAR_STATE_MAX_AGE_SECONDS = 60 * 10;

export type CalendarStatePayload = {
    state: string;
    verifier: string;
    provider: CalendarProvider;
    userId: string;
    workspaceId: string;
    redirectUri: string;
    issuedAt: number;
};

function envOrThrow(provider: CalendarProvider) {
    const missing = missingCalendarEnv(provider);
    if (missing.length) throw new CalendarIntegrationError("not_configured", missing.join(", "));

    const prefix = oauthAppFor(provider) === "google" ? "GOOGLE" : "MICROSOFT";
    return {
        clientId: process.env[`${prefix}_CLIENT_ID`]!.trim(),
        clientSecret: process.env[`${prefix}_CLIENT_SECRET`]!.trim(),
        encryptionKey: process.env.INTEGRATIONS_ENCRYPTION_KEY!.trim(),
    };
}

export function calendarCredentials(provider: CalendarProvider) {
    return envOrThrow(provider);
}

export function createPkcePair() {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge, state: randomBytes(24).toString("base64url") };
}

export function sealState(payload: CalendarStatePayload, key: string) {
    return encryptSecret(JSON.stringify(payload), key);
}

export function openState(sealed: string | undefined, key: string): CalendarStatePayload {
    if (!sealed) throw new CalendarIntegrationError("invalid_state", "state cookie missing");

    let payload: CalendarStatePayload;
    try {
        payload = JSON.parse(decryptSecret(sealed, key));
    } catch {
        throw new CalendarIntegrationError("invalid_state", "state cookie unreadable");
    }

    if (
        !isCalendarProvider(payload.provider) ||
        Date.now() - payload.issuedAt > CALENDAR_STATE_MAX_AGE_SECONDS * 1000
    ) {
        throw new CalendarIntegrationError("invalid_state", "state cookie stale");
    }
    return payload;
}

export type TokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
};

async function postToken(provider: CalendarProvider, body: Record<string, string>) {
    let res: Response;
    try {
        res = await fetch(calendarTokenEndpoint(provider), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body: new URLSearchParams(body),
            cache: "no-store",
        });
    } catch (error) {
        throw new CalendarIntegrationError("provider_api_failed", `token endpoint unreachable: ${String(error)}`);
    }

    const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & {
        error?: string;
        error_description?: string;
    };
    return { ok: res.ok && Boolean(json.access_token), json };
}

export async function exchangeCode(params: {
    provider: CalendarProvider;
    code: string;
    verifier: string;
    redirectUri: string;
}): Promise<TokenResponse> {
    const { clientId, clientSecret } = envOrThrow(params.provider);
    const { ok, json } = await postToken(params.provider, {
        grant_type: "authorization_code",
        code: params.code,
        code_verifier: params.verifier,
        redirect_uri: params.redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
    });

    if (!ok) {
        // Log the provider's reason server-side only; it can name the redirect
        // URI mismatch or a bad secret, which is exactly what the admin needs.
        console.error("[calendar] code exchange failed", {
            provider: params.provider,
            error: json.error,
            description: json.error_description,
        });
        const code =
            json.error === "invalid_client" || json.error === "unauthorized_client"
                ? "provider_error"
                : "token_exchange_failed";
        throw new CalendarIntegrationError(code, json.error);
    }
    return json as TokenResponse;
}

export async function refreshAccessToken(provider: CalendarProvider, refreshToken: string) {
    const { clientId, clientSecret } = envOrThrow(provider);
    const { ok, json } = await postToken(provider, {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        ...(provider === "google" ? {} : { scope: calendarScopesFor(provider) }),
    });

    if (!ok) {
        console.error("[calendar] token refresh failed", {
            provider,
            error: json.error,
            description: json.error_description,
        });
        // invalid_grant = refresh token revoked/expired: the user must reconnect.
        throw new CalendarIntegrationError(
            json.error === "invalid_grant" ? "token_expired" : "provider_api_failed",
            json.error
        );
    }
    return json as TokenResponse;
}

/**
 * One cheap authenticated call proving the token really reaches the calendar
 * API — catches a disabled Google Calendar API, a Microsoft account with no
 * mailbox, and revoked access. Only after this passes is a connection saved.
 */
export async function verifyCalendarAccess(provider: CalendarProvider, accessToken: string) {
    const url =
        provider === "google"
            ? "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=summary"
            : "https://graph.microsoft.com/v1.0/me/calendar?$select=id,owner";

    let res: Response;
    try {
        res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
            cache: "no-store",
        });
    } catch (error) {
        throw new CalendarIntegrationError("provider_api_failed", `calendar API unreachable: ${String(error)}`);
    }

    if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
            summary?: string;
            owner?: { address?: string };
        };
        // Google's primary calendar summary is the account email.
        return { ownerEmail: body.owner?.address ?? body.summary ?? null };
    }

    const text = await res.text().catch(() => "");
    console.error("[calendar] calendar API check failed", { provider, status: res.status, body: text.slice(0, 500) });

    if (res.status === 401) throw new CalendarIntegrationError("token_expired", "401 from calendar API");
    if (res.status === 403) throw new CalendarIntegrationError("permission_denied", "403 from calendar API");
    throw new CalendarIntegrationError("provider_api_failed", `status ${res.status}`);
}

/** Best-effort: Google supports revocation; Microsoft has no per-token revoke. */
export async function revokeToken(provider: CalendarProvider, token: string) {
    if (provider !== "google") return;
    try {
        await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token }),
        });
    } catch (error) {
        console.warn("[calendar] token revoke failed (ignored)", String(error));
    }
}
