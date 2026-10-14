import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { isCalendarOAuthApp, oauthAppFor } from "@/lib/integrations/calendar/providers";
import { providerErrorToCode } from "@/lib/integrations/calendar/errors";
import {
    CALENDAR_STATE_COOKIE,
    CalendarIntegrationError,
    openState,
} from "@/lib/integrations/calendar/oauth";
import { redirectToIntegrations } from "@/lib/integrations/calendar/route-helpers";
import { CalendarIntegrationService } from "@/services/calendar-integration.service";

export const dynamic = "force-dynamic";

/**
 * OAuth redirect URI — one per OAuth app:
 *   /api/integrations/calendar/callback/google
 *   /api/integrations/calendar/callback/microsoft   (Microsoft 365 and Outlook)
 *
 * The provider variant, PKCE verifier and the user who started the flow come
 * from the encrypted state cookie, never from the query string. The page only
 * ever hears "connected" after the code exchange, scope check, a live calendar
 * API call and the database write have all succeeded.
 */
export async function GET(req: NextRequest, { params }: { params: { app: string } }) {
    const search = req.nextUrl.searchParams;
    const sealed = req.cookies.get(CALENDAR_STATE_COOKIE)?.value;
    const key = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim() ?? "";

    let provider = null as ReturnType<typeof openState>["provider"] | null;

    const finish = (response: ReturnType<typeof redirectToIntegrations>) => {
        response.cookies.set(CALENDAR_STATE_COOKIE, "", {
            path: "/api/integrations/calendar",
            maxAge: 0,
        });
        return response;
    };

    try {
        if (!isCalendarOAuthApp(params.app)) {
            return finish(redirectToIntegrations(req, { error: "unsupported_provider" }));
        }
        if (!key) throw new CalendarIntegrationError("not_configured", "INTEGRATIONS_ENCRYPTION_KEY");

        let statePayload: ReturnType<typeof openState> | null = null;
        let stateError: unknown = null;
        try {
            statePayload = openState(sealed, key);
            provider = statePayload.provider;
        } catch (error) {
            stateError = error;
        }

        // The user cancelled, or the provider refused the request outright.
        // Reported ahead of state problems — nothing is saved on this path, and
        // "you cancelled" is the truer message after a slow cancel.
        const providerError = search.get("error");
        if (providerError) {
            console.warn("[calendar] provider returned an error", {
                provider,
                error: providerError,
                description: search.get("error_description")?.slice(0, 300),
            });
            throw new CalendarIntegrationError(providerErrorToCode(providerError), providerError);
        }

        if (stateError || !statePayload || !provider) throw stateError;
        if (oauthAppFor(provider) !== params.app || search.get("state") !== statePayload.state) {
            throw new CalendarIntegrationError("invalid_state", "state mismatch");
        }

        const code = search.get("code");
        if (!code) throw new CalendarIntegrationError("missing_code");

        // The session must still belong to whoever started the flow.
        const tenant = await resolveTenant();
        if (!tenant) throw new CalendarIntegrationError("not_signed_in");
        if (tenant.userId !== statePayload.userId || tenant.workspaceId !== statePayload.workspaceId) {
            throw new CalendarIntegrationError("invalid_state", "session changed during OAuth");
        }

        await CalendarIntegrationService.completeConnection(tenant, {
            provider,
            code,
            verifier: statePayload.verifier,
            redirectUri: statePayload.redirectUri,
        });

        return finish(redirectToIntegrations(req, { connected: provider }));
    } catch (error) {
        if (error instanceof CalendarIntegrationError) {
            console.warn("[calendar] callback failed", { provider, reason: error.message });
            return finish(redirectToIntegrations(req, { error: error.code, provider }));
        }
        console.error("[calendar] callback crashed", error);
        return finish(redirectToIntegrations(req, { error: "unknown", provider }));
    }
}
