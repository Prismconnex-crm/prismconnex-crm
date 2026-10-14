import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors";
import { jsonError, jsonOk } from "@/lib/http/response";
import { validateBody, validateQuery } from "@/lib/http/validate";
import { isCalendarProvider } from "@/lib/integrations/calendar/providers";
import { CalendarIntegrationError } from "@/lib/integrations/calendar/oauth";
import { calendarApiError } from "@/lib/integrations/calendar/route-helpers";
import { CalendarEventInputSchema, CalendarEventListQuerySchema } from "@/models/calendar-integration";
import { CalendarIntegrationService } from "@/services/calendar-integration.service";

export const dynamic = "force-dynamic";

type Params = { params: { provider: string } };

/**
 * GET  ?calendarId=primary&from=<ISO>&to=<ISO>&limit=50 — events in a window
 *      (defaults: now → +30 days), recurring events expanded.
 * POST ?calendarId=primary  body: CalendarEventInput — creates an event.
 */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        if (!isCalendarProvider(params.provider)) throw new BadRequestError("Unsupported calendar provider");

        const query = validateQuery(
            CalendarEventListQuerySchema,
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        return jsonOk({ events: await CalendarIntegrationService.listEvents(tenant, params.provider, query) });
    } catch (error) {
        return jsonError(error instanceof CalendarIntegrationError ? calendarApiError(error) : error);
    }
}

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        if (!isCalendarProvider(params.provider)) throw new BadRequestError("Unsupported calendar provider");

        const input = validateBody(CalendarEventInputSchema, await req.json().catch(() => null));
        const calendarId = req.nextUrl.searchParams.get("calendarId") || "primary";
        const event = await CalendarIntegrationService.createEvent(tenant, params.provider, calendarId, input);
        return jsonOk({ event }, 201);
    } catch (error) {
        return jsonError(error instanceof CalendarIntegrationError ? calendarApiError(error) : error);
    }
}
