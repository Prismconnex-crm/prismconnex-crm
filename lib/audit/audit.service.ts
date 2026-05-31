import { prisma } from "@/lib/db/prisma";

export class AuditService {
    static async log(
        workspaceId: string,
        userId: string,
        entity: string,
        entityId: string,
        action: string
    ) {
        return prisma.auditLog.create({
            data: {
                workspaceId,
                userId,
                entity,
                entityId,
                action,
            },
        });
    }
}
