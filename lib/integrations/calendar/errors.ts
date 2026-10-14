import { isCalendarProvider, type CalendarProvider } from "./providers";

/**
 * The error vocabulary shared by the calendar OAuth routes and the Integrations
 * page — the same pattern as lib/auth/oauth-errors.ts.
 *
 * The connect and callback routes are browser navigations, so they can only
 * report back through `/app/integrations?calendar_error=<code>`. That value is
 * attacker-controlled, hence the closed list and resolveCalendarErrorCode().
 */
export const CALENDAR_ERROR_CODES = [
    "not_configured",
    "unsupported_provider",
    "not_signed_in",
    "access_denied",
    "permission_denied",
    "invalid_state",
    "missing_code",
    "provider_error",
    "token_exchange_failed",
    "token_expired",
    "provider_api_failed",
    "database_not_ready",
    "database_unavailable",
    "database_failed",
    "not_connected",
    "not_found",
    "invalid_request",
] as const;

export type CalendarErrorCode = (typeof CALENDAR_ERROR_CODES)[number];
export type CalendarErrorKey = CalendarErrorCode | "unknown";

const MESSAGES: Record<CalendarErrorKey, string> = {
    not_configured:
        "This calendar provider isn't set up on the server yet. An administrator needs to add its OAuth credentials.",
    unsupported_provider: "That calendar provider isn't supported.",
    not_signed_in: "Your session has expired. Sign in again, then connect your calendar.",
    access_denied: "The connection was cancelled, so no calendar was connected.",
    permission_denied:
        "Calendar access wasn't granted. Connect again and allow access to your calendar on the consent screen.",
    invalid_state:
        "The sign-in window expired or was opened in another tab. Please try connecting again.",
    missing_code: "The provider didn't return an authorization code. Please try again.",
    provider_error:
        "The provider rejected the request. This usually means the client ID, secret or redirect URL is misconfigured.",
    token_exchange_failed:
        "We couldn't complete the connection with the provider. Please try again.",
    token_expired:
        "Access to this calendar has expired or was revoked. Reconnect to keep it in sync.",
    provider_api_failed:
        "The calendar provider didn't respond as expected. Please try again in a moment.",
    database_not_ready:
        "Calendar connections can't be saved yet — the database migration for integrations hasn't been applied.",
    database_unavailable:
        "The database can't be reached right now, so calendar connections can't be loaded or saved. Please try again shortly.",
    database_failed: "We couldn't save the calendar connection. Please try again.",
    not_connected: "This calendar isn't connected. Connect it from Integrations → Calendar first.",
    not_found: "That calendar or event no longer exists at the provider.",
    invalid_request: "The calendar provider rejected the event details. Check the dates and attendees and try again.",
    unknown: "Something went wrong while connecting your calendar. Please try again.",
};

export function calendarErrorMessage(code: CalendarErrorKey) {
    return MESSAGES[code] ?? MESSAGES.unknown;
}

export function resolveCalendarErrorCode(raw: string | null | undefined): CalendarErrorKey {
    if (!raw) return "unknown";
    return (CALENDAR_ERROR_CODES as readonly string[]).includes(raw)
        ? (raw as CalendarErrorCode)
        : "unknown";
}

/**
 * Maps the `?error=` a provider appends to the callback. Google sends
 * `access_denied` on Cancel; Microsoft sends `access_denied` or
 * `consent_required` when consent is declined. Anything else (invalid_client,
 * unauthorized_client, invalid_request …) is a configuration problem.
 */
export function providerErrorToCode(raw: string): CalendarErrorCode {
    if (raw === "access_denied" || raw === "consent_required" || raw === "interaction_required") {
        return "access_denied";
    }
    return "provider_error";
}

export type CalendarReturn =
    | { kind: "connected"; provider: CalendarProvider }
    | { kind: "error"; code: CalendarErrorKey; provider: CalendarProvider | null };

/** Reads what the callback put on /app/integrations. */
export function parseCalendarReturn(search: string): CalendarReturn | null {
    const params = new URLSearchParams(search);

    const connected = params.get("calendar_connected");
    if (isCalendarProvider(connected)) return { kind: "connected", provider: connected };

    if (params.has("calendar_error")) {
        const provider = params.get("provider");
        return {
            kind: "error",
            code: resolveCalendarErrorCode(params.get("calendar_error")),
            provider: isCalendarProvider(provider) ? provider : null,
        };
    }

    return null;
}
