import { resolveTenant } from "@/lib/auth/tenant";
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors";
import { jsonError, jsonOk } from "@/lib/http/response";
import { isCalendarProvider } from "@/lib/integrations/calendar/providers";
import { CalendarIntegrationError } from "@/lib/integrations/calendar/oauth";
import { calendarApiError } from "@/lib/integrations/calendar/route-helpers";
import { CalendarIntegrationService } from "@/services/calendar-integration.service";

export const dynamic = "force-dynamic";

/**
 * Re-verifies a connection against the provider, refreshing an expired access
 * token. A revoked grant comes back as `token_expired` and the row is marked
 * expired so the page offers Reconnect.
 */
export async function POST(_req: Request, { params }: { params: { provider: string } }) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        if (!isCalendarProvider(params.provider)) throw new BadRequestError("Unsupported calendar provider");

        return jsonOk({ connection: await CalendarIntegrationService.check(tenant, params.provider) });
    } catch (error) {
        // 409 for connection-state problems, 502/503 for provider/database faults.
        return jsonError(error instanceof CalendarIntegrationError ? calendarApiError(error) : error);
    }
}
