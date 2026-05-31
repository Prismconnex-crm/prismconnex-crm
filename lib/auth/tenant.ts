import { prisma } from "@/lib/db/prisma";
import { getSessionPayload } from "./session";

export type TenantContext = {
    userId: string;
    email: string;
    workspaceId: string;
    role: string; // ADMIN | SALES_REP | SUPPORT | VIEWER
};

export async function resolveTenant(): Promise<TenantContext | null> {
    const payload = await getSessionPayload();
    if (!payload || !payload.sub || !payload.email) return null;

    const email = payload.email as string;

    // Find user by email (no cognitoSub in simplified schema)
    const user = await prisma.user.findUnique({
        where: { email },
        include: { memberships: true },
    });

    if (!user || user.memberships.length === 0) return null;

    const defaultMembership = user.memberships[0];

    return {
        userId: user.id,
        email,
        workspaceId: defaultMembership.workspaceId,
        role: defaultMembership.role as string,
    };
}
