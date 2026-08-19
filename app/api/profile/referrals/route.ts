import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { resolveTenant } from "@/lib/auth/tenant";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ForbiddenError } from "@/lib/http/errors";
import { CreateReferralSchema } from "@/models/billing";
import { BillingService } from "@/services/billing.service";

/** The invitations raised from this workspace, newest first. */
export async function GET() {
    try {
        await requireSessionUser();
        const tenant = await resolveTenant();

        if (!tenant) return jsonOk({ referrals: [] });

        return jsonOk({ referrals: await BillingService.listReferrals(tenant.workspaceId) });
    } catch (error) {
        return jsonError(error);
    }
}

/**
 * Raises an invitation and returns its shareable link.
 *
 * No email leaves the app — there is no mail transport configured and no
 * Supabase service_role key, so the response deliberately carries the link for
 * the user to send themselves rather than reporting a delivery that did not
 * happen. The UI says as much.
 */
export async function POST(request: Request) {
    try {
        const session = await requireSessionUser();
        const tenant = await resolveTenant();

        if (!tenant) {
            throw new ForbiddenError(
                "This session has no workspace, so invitations cannot be raised."
            );
        }

        const { email } = validateBody(CreateReferralSchema, await request.json());

        const referral = await BillingService.createReferral({
            workspaceId: tenant.workspaceId,
            userId: tenant.userId,
            email,
            selfEmail: session.email || tenant.email,
        });

        return jsonOk({
            referral,
            message: "Invitation created. Copy the link to send it.",
        });
    } catch (error) {
        return jsonError(error);
    }
}
