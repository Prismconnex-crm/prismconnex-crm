import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors";
import { jsonError, jsonOk } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { isCalendarProvider } from "@/lib/integrations/calendar/providers";
import { CalendarIntegrationError } from "@/lib/integrations/calendar/oauth";
import { calendarApiError } from "@/lib/integrations/calendar/route-helpers";
import { CalendarEventPatchSchema } from "@/models/calendar-integration";
import { CalendarIntegrationService } from "@/services/calendar-integration.service";

export const dynamic = "force-dynamic";

type Params = { params: { provider: string; eventId: string } };

/**
 * PATCH  ?calendarId=primary  body: partial CalendarEventInput — updates an event.
 * DELETE ?calendarId=primary — deletes an event.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        if (!isCalendarProvider(params.provider)) throw new BadRequestError("Unsupported calendar provider");

        const patch = validateBody(CalendarEventPatchSchema, await req.json().catch(() => null));
        const calendarId = req.nextUrl.searchParams.get("calendarId") || "primary";
        const event = await CalendarIntegrationService.updateEvent(
            tenant,
            params.provider,
            calendarId,
            params.eventId,
            patch
        );
        return jsonOk({ event });
    } catch (error) {
        return jsonError(error instanceof CalendarIntegrationError ? calendarApiError(error) : error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        if (!isCalendarProvider(params.provider)) throw new BadRequestError("Unsupported calendar provider");

        const calendarId = req.nextUrl.searchParams.get("calendarId") || "primary";
        await CalendarIntegrationService.deleteEvent(tenant, params.provider, calendarId, params.eventId);
        return jsonOk({ ok: true });
    } catch (error) {
        return jsonError(error instanceof CalendarIntegrationError ? calendarApiError(error) : error);
    }
}
