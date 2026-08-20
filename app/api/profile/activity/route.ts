import { jsonOk, jsonError } from "@/lib/http/response";
import { requireSessionUser } from "@/lib/auth/require-session";
import { resolveTenant } from "@/lib/auth/tenant";
import { ProfileService } from "@/services/profile.service";
import { ProfileActivityService } from "@/services/profile-activity.service";

/**
 * Activity figures for the Profile page.
 *
 * Scoped by resolveTenant(), so the counts are for the caller's own workspace
 * and never leak another tenant's data. A user with no membership yet gets the
 * empty shape rather than a 500 — see ProfileActivityService.empty.
 */
export async function GET() {
    try {
        const { userId } = await requireSessionUser();

        const [profile, tenant] = await Promise.all([
            ProfileService.getByUserId(userId),
            resolveTenant(),
        ]);

        const common = {
            profileUpdatedAt: profile?.updatedAt ?? null,
            lastLoginAt: profile?.lastLoginAt ?? null,
            memberSince: profile?.createdAt ?? null,
        };

        const activity = tenant
            ? await ProfileActivityService.forUser({
                  crmUserId: tenant.userId,
                  workspaceId: tenant.workspaceId,
                  ...common,
              })
            : ProfileActivityService.empty(common);

        return jsonOk({ activity });
    } catch (error) {
        return jsonError(error);
    }
}
