import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/errors";
import { calendarErrorMessage, type CalendarErrorKey } from "./errors";
import type { CalendarIntegrationError } from "./oauth";
import type { CalendarProvider } from "./providers";

/**
 * The public origin the app is served from. APP_URL wins so redirect URIs match
 * what is registered with Google/Microsoft behind a proxy or tunnel — the same
 * rule as /api/auth/oauth/[provider].
 */
export function appOrigin(req: NextRequest) {
    return process.env.APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
}

/** Back to the Integrations page with an outcome the page can show. */
export function redirectToIntegrations(
    req: NextRequest,
    outcome:
        | { connected: CalendarProvider }
        | { error: CalendarErrorKey; provider?: CalendarProvider | null }
) {
    const url = new URL("/app/integrations", appOrigin(req));
    if ("connected" in outcome) {
        url.searchParams.set("calendar_connected", outcome.connected);
    } else {
        url.searchParams.set("calendar_error", outcome.error);
        if (outcome.provider) url.searchParams.set("provider", outcome.provider);
    }
    return NextResponse.redirect(url);
}

/**
 * HTTP status for a calendar failure on a JSON route. The body always carries
 * the safe message from errors.ts plus the code as `details.reason`; the
 * provider's own response stays in the server log.
 */
const STATUS: Partial<Record<CalendarErrorKey, number>> = {
    not_connected: 409,
    token_expired: 409,
    permission_denied: 409,
    not_found: 404,
    invalid_request: 400,
    unsupported_provider: 400,
    not_configured: 503,
    database_not_ready: 503,
    database_unavailable: 503,
    provider_api_failed: 502,
};

export function calendarApiError(error: CalendarIntegrationError) {
    return new ApiError(calendarErrorMessage(error.code), STATUS[error.code] ?? 500, { reason: error.code });
}
