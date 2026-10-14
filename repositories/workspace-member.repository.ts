import { prisma } from "@/lib/db/prisma";

/** Membership lookups for a single workspace. */
export class WorkspaceMemberRepository {
    static async isMember(workspaceId: string, userId: string) {
        const membership = await prisma.membership.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
            select: { id: true },
        });
        return Boolean(membership);
    }

    static async list(workspaceId: string) {
        return prisma.membership.findMany({
            where: { workspaceId },
            select: {
                role: true,
                user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
        });
    }
}
