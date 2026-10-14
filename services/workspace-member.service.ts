import { WorkspaceMemberRepository } from "@/repositories/workspace-member.repository";
import type { WorkspaceMemberDTO } from "@/models/workspace-member";
import type { TenantContext } from "@/lib/auth/tenant";
import { authorize, Role } from "@/lib/rbac/authorize";

export class WorkspaceMemberService {
    constructor(private tenant: TenantContext) { }

    /** Everyone in the caller's workspace — any member may see who their teammates are. */
    async list(): Promise<WorkspaceMemberDTO[]> {
        authorize(this.tenant, Role.VIEWER);

        const memberships = await WorkspaceMemberRepository.list(this.tenant.workspaceId);
        return memberships.map(({ role, user }) => ({
            userId: user.id,
            name: user.name?.trim() || user.email,
            email: user.email,
            role,
        }));
    }
}
