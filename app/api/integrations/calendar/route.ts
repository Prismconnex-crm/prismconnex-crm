import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonError, jsonOk } from "@/lib/http/response";
import { CalendarIntegrationService } from "@/services/calendar-integration.service";

export const dynamic = "force-dynamic";

/** Calendar providers, whether each is configured, and the caller's connections. */
export async function GET() {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        return jsonOk(await CalendarIntegrationService.status(tenant));
    } catch (error) {
        return jsonError(error);
    }
}
