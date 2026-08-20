import { jsonOk, jsonError } from "@/lib/http/response";
import { resolveTenant } from "@/lib/auth/tenant";
import { requireSessionUser } from "@/lib/auth/require-session";
import { BillingService } from "@/services/billing.service";

/**
 * Credit usage for the signed-in user's workspace.
 *
 * Credits are a workspace-level resource, not a personal one, so this route
 * resolves the tenant rather than keying off the Supabase user id the way the
 * other Profile routes do. requireSessionUser still runs first, so an
 * unauthenticated call is a 401 and not an empty 200.
 *
 * Responds 200 with `usage: null` when the session has no workspace — the
 * seeded demo user and /api/auth/mock-sign-in both produce exactly that, and
 * the card renders an explanatory state instead of an error.
 */
export async function GET() {
    try {
        await requireSessionUser();
        const tenant = await resolveTenant();

        if (!tenant) return jsonOk({ usage: null, plans: [] });

        // One call, not two in parallel: both provision the credit row on a
        // workspace's first ever read, and racing them made that first load
        // collide on the primary key.
        return jsonOk(await BillingService.getOverview(tenant.workspaceId));
    } catch (error) {
        return jsonError(error);
    }
}
