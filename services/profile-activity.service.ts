import { prisma } from "@/lib/db/prisma";

/**
 * Activity figures for the Profile page.
 *
 * ── An honesty note that shapes the whole file ──
 * Lead, Deal and Contact carry a workspaceId but NO owner column (see
 * prisma/schema.prisma). There is therefore no way to attribute a lead or a
 * deal to an individual user with the current schema, and inventing an
 * attribution — say, counting everything and labelling it "yours" — would be a
 * fabricated statistic on a page about the user's own record.
 *
 * So each counter is returned with an explicit `scope`:
 *   "user"      — genuinely this person's (tasks have Task.ownerId)
 *   "workspace" — the whole workspace's, and the UI must say so
 *
 * The UI prints that scope next to the number. Adding `ownerId` to Lead/Deal/
 * Contact is the schema change that would let these become per-user; it is
 * noted in docs/PROFILE.md rather than done here, because it touches the
 * creation path of three CRM sections this task was told not to disturb.
 */

export type ActivityCounter = {
    key: string;
    label: string;
    value: number;
    scope: "user" | "workspace";
};

export type ActivityEntry = {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: Date;
    /** True when the audit row is attributable to this user. */
    byCurrentUser: boolean;
};

export type ProfileActivity = {
    counters: ActivityCounter[];
    recent: ActivityEntry[];
    /**
     * True when the audit trail could not be read at all, as opposed to being
     * genuinely empty. The two look identical in a list and mean opposite
     * things, so the UI needs to tell them apart — see readRecentActivity.
     */
    recentUnavailable: boolean;
    profileUpdatedAt: Date | null;
    lastLoginAt: Date | null;
    memberSince: Date | null;
};

/**
 * Reads the audit trail, tolerating a schema that does not match the model.
 *
 * This is not defensive programming for its own sake. The live database's
 * "AuditLog" table currently has only (id, workspaceId, userId, action) while
 * prisma/schema.prisma also declares entity, entityId and createdAt — drift
 * that predates this feature and belongs to the still-unapplied
 * 20260801_add_company_contact migration, not to the Profile page.
 *
 * Prisma selects every scalar field by default, so a plain findMany() raises
 * "The column AuditLog.entity does not exist" and takes the ENTIRE Activity
 * card down with it — sign-in times, CRM counters and all — over an optional
 * list. Isolating the failure keeps everything else working, and the read
 * starts succeeding on its own once the missing migration is applied.
 */
async function readRecentActivity(
    workspaceId: string,
    crmUserId: string
): Promise<{ entries: ActivityEntry[]; unavailable: boolean }> {
    try {
        const rows = await prisma.auditLog.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
            take: 8,
        });

        return {
            entries: rows.map((row) => ({
                id: row.id,
                action: row.action,
                entity: row.entity,
                entityId: row.entityId,
                createdAt: row.createdAt,
                byCurrentUser: row.userId === crmUserId,
            })),
            unavailable: false,
        };
    } catch (error) {
        console.error("[profile-activity] audit trail unavailable", error);
        return { entries: [], unavailable: true };
    }
}

export class ProfileActivityService {
    /**
     * @param crmUserId  User.id — the tenancy record, which is what AuditLog and
     *                   Task.ownerId reference. NOT the Supabase auth id.
     */
    static async forUser(params: {
        crmUserId: string;
        workspaceId: string;
        profileUpdatedAt: Date | null;
        lastLoginAt: Date | null;
        memberSince: Date | null;
    }): Promise<ProfileActivity> {
        const { crmUserId, workspaceId } = params;

        // One round trip rather than six sequential ones. Everything here is a
        // count or a small take(), so the whole set is cheap.
        const [leads, contacts, deals, tasksCompleted, tasksOpen, recent] =
            await Promise.all([
                prisma.lead.count({ where: { workspaceId } }),
                prisma.contact.count({ where: { workspaceId } }),
                prisma.deal.count({ where: { workspaceId } }),
                prisma.task.count({
                    where: { workspaceId, ownerId: crmUserId, completed: true },
                }),
                prisma.task.count({
                    where: { workspaceId, ownerId: crmUserId, completed: false },
                }),
                readRecentActivity(workspaceId, crmUserId),
            ]);

        return {
            counters: [
                { key: "leads", label: "Leads created", value: leads, scope: "workspace" },
                {
                    key: "customers",
                    label: "Customers added",
                    value: contacts,
                    scope: "workspace",
                },
                { key: "deals", label: "Deals handled", value: deals, scope: "workspace" },
                {
                    key: "tasksCompleted",
                    label: "Tasks completed",
                    value: tasksCompleted,
                    scope: "user",
                },
                { key: "tasksOpen", label: "Tasks open", value: tasksOpen, scope: "user" },
            ],
            recent: recent.entries,
            recentUnavailable: recent.unavailable,
            profileUpdatedAt: params.profileUpdatedAt,
            lastLoginAt: params.lastLoginAt,
            memberSince: params.memberSince,
        };
    }

    /**
     * The zero-state used when the session has no workspace yet.
     *
     * A signed-in user without a Membership is a real state in this app — the
     * seeded demo user, and anyone between signup and /api/onboarding — and
     * every count above requires a workspaceId. Returning empties lets the
     * Profile page render its empty states instead of 500-ing.
     */
    static empty(params: {
        profileUpdatedAt: Date | null;
        lastLoginAt: Date | null;
        memberSince: Date | null;
    }): ProfileActivity {
        return {
            counters: [],
            recent: [],
            recentUnavailable: false,
            profileUpdatedAt: params.profileUpdatedAt,
            lastLoginAt: params.lastLoginAt,
            memberSince: params.memberSince,
        };
    }
}
