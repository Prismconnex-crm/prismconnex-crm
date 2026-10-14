import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonOk, jsonError } from "@/lib/http/response";
import { WorkspaceMemberService } from "@/services/workspace-member.service";

/** Members of the caller's workspace, for owner/assignee pickers. */
export async function GET() {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const members = await new WorkspaceMemberService(tenant).list();
        // `me` lets the UI label "Me" and hide actions this role cannot take
        // without a second request; the API still enforces every permission.
        return jsonOk({ members, me: { userId: tenant.userId, role: tenant.role } });
    } catch (err) {
        return jsonError(err);
    }
}
