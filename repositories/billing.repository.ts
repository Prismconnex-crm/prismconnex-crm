import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

/**
 * Data access for WorkspaceCredit, CreditUsageEntry and Referral.
 *
 * Every method is tenant-scoped by `workspaceId`, following the convention in
 * the other repositories: the id comes from resolveTenant() in the route, never
 * from the request body, so one workspace cannot read another's balance.
 */
export class BillingRepository {
    // ── Credits ──

    static async findCredit(workspaceId: string) {
        return prisma.workspaceCredit.findUnique({ where: { workspaceId } });
    }

    /**
     * Creates the credit row for a workspace that has none.
     *
     * Prisma's upsert is NOT atomic here — it reads, then writes — so two
     * concurrent first-loads of the Profile page both see "absent" and both
     * insert, and one gets a unique violation on the primary key. That is not
     * hypothetical: the Profile page and /app/billing each read this on mount.
     *
     * P2002 therefore means "somebody else just created it", which is the
     * outcome this method wanted anyway, so the loser re-reads and returns the
     * winner's row instead of failing the request.
     */
    static async createCredit(params: {
        workspaceId: string;
        plan: string;
        allowance: number;
        periodStart: Date;
        periodEnd: Date;
    }) {
        try {
            return await prisma.workspaceCredit.create({ data: params });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            ) {
                const existing = await prisma.workspaceCredit.findUnique({
                    where: { workspaceId: params.workspaceId },
                });
                if (existing) return existing;
            }
            throw error;
        }
    }

    static async updatePlan(workspaceId: string, plan: string, allowance: number) {
        return prisma.workspaceCredit.update({
            where: { workspaceId },
            data: { plan, allowance },
        });
    }

    /** Rolls the period forward, leaving the ledger intact. */
    static async rollPeriod(workspaceId: string, periodStart: Date, periodEnd: Date) {
        return prisma.workspaceCredit.update({
            where: { workspaceId },
            data: { periodStart, periodEnd },
        });
    }

    /**
     * Consumption for the current period, grouped by kind.
     *
     * groupBy + _sum rather than reading the rows and adding them up in JS: the
     * ledger is append-only and unbounded, and this is the query that has to
     * stay cheap as it grows.
     */
    static async sumUsageByKind(workspaceId: string, from: Date, to: Date) {
        return prisma.creditUsageEntry.groupBy({
            by: ["kind"],
            where: { workspaceId, createdAt: { gte: from, lte: to } },
            _sum: { amount: true },
        });
    }

    static async recentUsage(workspaceId: string, take = 5) {
        return prisma.creditUsageEntry.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
            take,
        });
    }

    static async recordUsage(params: {
        workspaceId: string;
        userId: string | null;
        kind: string;
        amount: number;
        description?: string | null;
    }) {
        return prisma.creditUsageEntry.create({ data: params });
    }

    // ── Referrals ──

    static async listReferrals(workspaceId: string, take = 10) {
        return prisma.referral.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
            take,
        });
    }

    static async findReferralByEmail(workspaceId: string, email: string) {
        return prisma.referral.findUnique({
            where: { workspaceId_email: { workspaceId, email } },
        });
    }

    /**
     * Creates the invitation, or re-issues the existing one for that address.
     *
     * The (workspaceId, email) unique index means a second invite to the same
     * person is an update, not a duplicate row — re-inviting someone should
     * refresh their link, not give the UI two entries to reconcile.
     */
    static async upsertReferral(params: {
        workspaceId: string;
        invitedByUserId: string;
        email: string;
        token: string;
    }) {
        return prisma.referral.upsert({
            where: {
                workspaceId_email: {
                    workspaceId: params.workspaceId,
                    email: params.email,
                },
            },
            update: {
                token: params.token,
                invitedByUserId: params.invitedByUserId,
                status: "PENDING",
                createdAt: new Date(),
                acceptedAt: null,
            },
            create: params,
        });
    }

    static async countReferrals(workspaceId: string) {
        return prisma.referral.count({ where: { workspaceId } });
    }
}
