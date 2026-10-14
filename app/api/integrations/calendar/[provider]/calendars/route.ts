import { resolveTenant } from "@/lib/auth/tenant";
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors";
import { jsonError, jsonOk } from "@/lib/http/response";
import { isCalendarProvider } from "@/lib/integrations/calendar/providers";
import { CalendarIntegrationError } from "@/lib/integrations/calendar/oauth";
import { calendarApiError } from "@/lib/integrations/calendar/route-helpers";
import { CalendarIntegrationService } from "@/services/calendar-integration.service";

export const dynamic = "force-dynamic";

/** The caller's calendars at this provider ("primary" = their default calendar). */
export async function GET(_req: Request, { params }: { params: { provider: string } }) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        if (!isCalendarProvider(params.provider)) throw new BadRequestError("Unsupported calendar provider");

        return jsonOk({ calendars: await CalendarIntegrationService.listCalendars(tenant, params.provider) });
    } catch (error) {
        return jsonError(error instanceof CalendarIntegrationError ? calendarApiError(error) : error);
    }
}
