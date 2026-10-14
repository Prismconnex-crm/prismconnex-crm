import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import {
    buildCalendarAuthorizeUrl,
    calendarRedirectUri,
    isCalendarProvider,
    oauthAppFor,
} from "@/lib/integrations/calendar/providers";
import {
    CALENDAR_STATE_COOKIE,
    CALENDAR_STATE_MAX_AGE_SECONDS,
    CalendarIntegrationError,
    calendarCredentials,
    createPkcePair,
    sealState,
} from "@/lib/integrations/calendar/oauth";
import { appOrigin, redirectToIntegrations } from "@/lib/integrations/calendar/route-helpers";
import { CalendarIntegrationService } from "@/services/calendar-integration.service";

export const dynamic = "force-dynamic";

/**
 * Starts calendar OAuth. Integrations → Calendar → <provider> → Connect is a
 * top-level navigation to this route, which redirects to the provider's
 * consent screen.
 *
 * Every precondition (signed in, credentials present, table migrated) is
 * checked BEFORE leaving the app, so a problem becomes a message on the
 * Integrations page instead of a provider error page the app never regains
 * control from.
 */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
    const provider = isCalendarProvider(params.provider) ? params.provider : null;
    if (!provider) return redirectToIntegrations(req, { error: "unsupported_provider" });

    try {
        const tenant = await resolveTenant();
        if (!tenant) return redirectToIntegrations(req, { error: "not_signed_in", provider });

        const { clientId, encryptionKey } = calendarCredentials(provider);
        await CalendarIntegrationService.assertStorageReady();

        const redirectUri = calendarRedirectUri(oauthAppFor(provider), appOrigin(req));
        const { verifier, challenge, state } = createPkcePair();

        const response = NextResponse.redirect(
            buildCalendarAuthorizeUrl({ provider, clientId, redirectUri, state, codeChallenge: challenge })
        );
        response.cookies.set(
            CALENDAR_STATE_COOKIE,
            sealState(
                {
                    state,
                    verifier,
                    provider,
                    userId: tenant.userId,
                    workspaceId: tenant.workspaceId,
                    redirectUri,
                    issuedAt: Date.now(),
                },
                encryptionKey
            ),
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                // lax: the cookie must ride along on the top-level GET back from the provider.
                sameSite: "lax",
                path: "/api/integrations/calendar",
                maxAge: CALENDAR_STATE_MAX_AGE_SECONDS,
            }
        );
        return response;
    } catch (error) {
        if (error instanceof CalendarIntegrationError) {
            console.warn("[calendar] connect refused", { provider, reason: error.message });
            return redirectToIntegrations(req, { error: error.code, provider });
        }
        console.error("[calendar] connect failed", error);
        return redirectToIntegrations(req, { error: "unknown", provider });
    }
}
