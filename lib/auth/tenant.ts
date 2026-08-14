import { prisma } from "@/lib/db/prisma";
import { getSessionPayload } from "./session";

export type TenantContext = {
    userId: string;
    email: string;
    workspaceId: string;
    role: string; // ADMIN | SALES_REP | SUPPORT | VIEWER
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Finds the CRM User record behind a session.
 *
 * Prefers supabaseUserId (auth.users.id) because a Supabase user can change
 * their email address, which would otherwise orphan their workspace. Falls back
 * to email so records that predate Supabase Auth — the seeded demo user, and the
 * fixtures in tests/integration — still resolve.
 */
async function findSessionUser(sub: string, email: string) {
    if (UUID_PATTERN.test(sub)) {
        const byAuthId = await prisma.user.findUnique({
            where: { supabaseUserId: sub },
            include: { memberships: true },
        });
        if (byAuthId) return byAuthId;
    }

    return prisma.user.findUnique({
        where: { email },
        include: { memberships: true },
    });
}

export async function resolveTenant(): Promise<TenantContext | null> {
    const payload = await getSessionPayload();
    if (!payload || !payload.sub || !payload.email) return null;

    const email = payload.email as string;
    const user = await findSessionUser(payload.sub as string, email);

    if (!user || user.memberships.length === 0) return null;

    const defaultMembership = user.memberships[0];

    return {
        userId: user.id,
        email,
        workspaceId: defaultMembership.workspaceId,
        role: defaultMembership.role as string,
    };
}

/**
 * Whether this user already has a workspace, and which one.
 *
 * Used at sign-in to set the pcx_onboarded cookie correctly. Before Supabase
 * Auth, sign-in always wrote `pcx_onboarded=false`, which was harmless because
 * sign-in never actually authenticated anyone. Now that it does, sending a
 * returning user back through /onboarding would create a second Workspace and
 * Membership on every login.
 */
export async function resolveOnboardingState(params: { supabaseUserId: string; email: string }) {
    const user = await findSessionUser(params.supabaseUserId, params.email);
    const membership = user?.memberships[0];

    return {
        onboarded: Boolean(membership),
        workspaceId: membership?.workspaceId ?? "",
    };
}
