import { z } from "zod";

import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { resolveTenant } from "@/lib/auth/tenant";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ForbiddenError } from "@/lib/http/errors";
import { PLAN_KEYS } from "@/models/billing";
import { BillingService } from "@/services/billing.service";

const PlanRequestSchema = z.object({
    plan: z.enum(PLAN_KEYS),
});

/**
 * Records a request to move to another plan.
 *
 * This does NOT change the workspace's plan or allowance. There is no payment
 * provider connected, and granting a paid credit allowance because someone
 * clicked a button is a billing bug rather than a feature. The request is
 * written to the audit trail, where an admin can act on it, and the UI tells
 * the user that is what happened.
 */
export async function POST(request: Request) {
    try {
        await requireSessionUser();
        const tenant = await resolveTenant();

        if (!tenant) {
            throw new ForbiddenError(
                "This session has no workspace, so a plan change cannot be requested."
            );
        }

        const { plan } = validateBody(PlanRequestSchema, await request.json());

        const result = await BillingService.requestPlanChange({
            workspaceId: tenant.workspaceId,
            userId: tenant.userId,
            plan,
        });

        return jsonOk({
            ...result,
            message: `Request to move to ${result.planName} recorded. Your workspace admin will follow up — no payment has been taken.`,
        });
    } catch (error) {
        return jsonError(error);
    }
}
