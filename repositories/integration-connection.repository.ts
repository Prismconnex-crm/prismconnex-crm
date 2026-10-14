import { prisma } from "@/lib/db/prisma";

/**
 * IntegrationConnection rows, always scoped to (workspaceId, userId): a calendar
 * connection is personal, so no query here can reach another user's tokens.
 */
export class IntegrationConnectionRepository {
    static listForUser(workspaceId: string, userId: string, category: string) {
        return prisma.integrationConnection.findMany({
            where: { workspaceId, userId, category },
            orderBy: { connectedAt: "asc" },
        });
    }

    static find(workspaceId: string, userId: string, provider: string) {
        return prisma.integrationConnection.findUnique({
            where: { workspaceId_userId_provider: { workspaceId, userId, provider } },
        });
    }

    /** Cheap probe so a missing table is reported before the user goes to consent. */
    static async assertReady() {
        await prisma.integrationConnection.findFirst({ select: { id: true } });
    }

    static upsert(data: {
        workspaceId: string;
        userId: string;
        category: string;
        provider: string;
        accountEmail: string | null;
        scopes: string;
        accessTokenEnc: string;
        refreshTokenEnc: string | null;
        tokenExpiresAt: Date | null;
    }) {
        const fields = {
            accountEmail: data.accountEmail,
            scopes: data.scopes,
            accessTokenEnc: data.accessTokenEnc,
            refreshTokenEnc: data.refreshTokenEnc,
            tokenExpiresAt: data.tokenExpiresAt,
            status: "connected",
            lastError: null,
            lastCheckedAt: new Date(),
        };
        return prisma.integrationConnection.upsert({
            where: {
                workspaceId_userId_provider: {
                    workspaceId: data.workspaceId,
                    userId: data.userId,
                    provider: data.provider,
                },
            },
            create: { ...fields, workspaceId: data.workspaceId, userId: data.userId, category: data.category, provider: data.provider, connectedAt: new Date() },
            update: { ...fields, connectedAt: new Date() },
        });
    }

    static update(
        id: string,
        data: Partial<{
            accessTokenEnc: string;
            refreshTokenEnc: string | null;
            tokenExpiresAt: Date | null;
            status: string;
            lastError: string | null;
            lastCheckedAt: Date;
        }>
    ) {
        return prisma.integrationConnection.update({ where: { id }, data });
    }

    static delete(id: string) {
        return prisma.integrationConnection.delete({ where: { id } });
    }
}
