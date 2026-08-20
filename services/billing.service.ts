import { randomBytes } from "node:crypto";

import { BillingRepository } from "@/repositories/billing.repository";
import { AuditService } from "@/lib/audit/audit.service";
import { BadRequestError } from "@/lib/http/errors";
import {
    CREDIT_KIND_LABELS,
    PLANS,
    findPlan,
    type CreditBreakdownDTO,
    type CreditKind,
    type CreditUsageDTO,
    type ReferralDTO,
} from "@/models/billing";

/**
 * Credits, plans and referrals.
 *
 * ── An honesty note, matching services/profile-activity.service.ts ──
 * No payment provider is connected. Everything below is real persisted state:
 * the allowance comes from the plan row, and consumption is summed from an
 * append-only ledger written by the metered call sites. Nothing is seeded,
 * estimated or backfilled — a workspace that has spent nothing reads zero,
 * because that is what happened.
 *
 * The one thing the app cannot do is take payment, so `requestPlanChange`
 * records the request in the audit trail rather than pretending to charge a
 * card and flip the plan.
 */

const DEFAULT_PLAN = "STARTER";

/**
 * Writes an audit row, tolerating the AuditLog schema drift.
 *
 * The live database's "AuditLog" table is missing the `entity`/`entityId`/
 * `createdAt` columns that prisma/schema.prisma declares — drift that predates
 * this feature and belongs to the still-unapplied 20260801_add_company_contact
 * migration. services/profile-activity.service.ts documents the same problem
 * for reads.
 *
 * Un-guarded, that failure propagates: creating a referral would 500 AFTER the
 * referral row was already committed, so the user would see an error for an
 * invitation that actually exists. The audit entry is secondary to the thing it
 * records, so it is allowed to be dropped and starts working by itself once the
 * missing migration is applied.
 */
async function auditQuietly(
    workspaceId: string,
    userId: string,
    entity: string,
    entityId: string,
    action: string
) {
    try {
        await AuditService.log(workspaceId, userId, entity, entityId, action);
    } catch (error) {
        console.warn("[billing] audit write skipped:", error);
    }
}

/** Same day next month, which is what a monthly credit period means here. */
function addOneMonth(from: Date): Date {
    const end = new Date(from);
    end.setMonth(end.getMonth() + 1);
    return end;
}

export class BillingService {
    /**
     * The workspace's credit row, created on first read.
     *
     * Lazily provisioning here rather than at workspace creation keeps this
     * feature from touching the onboarding path, and means workspaces that
     * already existed before the migration get a row the first time anyone
     * opens the Profile page.
     */
    static async ensureCredit(workspaceId: string) {
        const existing = await BillingRepository.findCredit(workspaceId);
        if (existing) return this.ensureCurrentPeriod(existing);

        const plan = findPlan(DEFAULT_PLAN);
        const periodStart = new Date();

        return BillingRepository.createCredit({
            workspaceId,
            plan: DEFAULT_PLAN,
            allowance: plan?.credits ?? 1000,
            periodStart,
            periodEnd: addOneMonth(periodStart),
        });
    }

    /**
     * Rolls an expired period forward before it is reported.
     *
     * Without this the card would keep showing last month's consumption against
     * this month's allowance — the balance would look spent and never recover,
     * because nothing else in the app runs on a schedule to reset it.
     */
    private static async ensureCurrentPeriod(
        credit: NonNullable<Awaited<ReturnType<typeof BillingRepository.findCredit>>>
    ) {
        if (credit.periodEnd > new Date()) return credit;

        const periodStart = new Date();
        return BillingRepository.rollPeriod(
            credit.workspaceId,
            periodStart,
            addOneMonth(periodStart)
        );
    }

    static async getUsage(workspaceId: string): Promise<CreditUsageDTO> {
        const credit = await this.ensureCredit(workspaceId);

        const [grouped, recent] = await Promise.all([
            BillingRepository.sumUsageByKind(
                workspaceId,
                credit.periodStart,
                credit.periodEnd
            ),
            BillingRepository.recentUsage(workspaceId),
        ]);

        const breakdown: CreditBreakdownDTO[] = grouped.map((row) => ({
            kind: row.kind,
            label: CREDIT_KIND_LABELS[row.kind as CreditKind] ?? row.kind,
            amount: row._sum.amount ?? 0,
        }));

        const used = breakdown.reduce((total, row) => total + row.amount, 0);
        const plan = findPlan(credit.plan);

        return {
            plan: credit.plan,
            planName: plan?.name ?? credit.plan,
            allowance: credit.allowance,
            used,
            // Floored at 0 so an over-spend (possible if the allowance is
            // lowered mid-period) reads "0 remaining" rather than a negative.
            remaining: Math.max(credit.allowance - used, 0),
            percentUsed:
                credit.allowance > 0
                    ? Math.min(Math.round((used / credit.allowance) * 100), 100)
                    : 0,
            periodStart: credit.periodStart.toISOString(),
            periodEnd: credit.periodEnd.toISOString(),
            breakdown: breakdown.sort((a, b) => b.amount - a.amount),
            recent: recent.map((entry) => ({
                id: entry.id,
                kind: entry.kind,
                label: CREDIT_KIND_LABELS[entry.kind as CreditKind] ?? entry.kind,
                amount: entry.amount,
                description: entry.description,
                createdAt: entry.createdAt.toISOString(),
            })),
        };
    }

    /**
     * Records one metered operation.
     *
     * Metering must never fail the work it measures: the caller invokes this
     * without awaiting its failure, because a dropped ledger row is preferable
     * to a people search that 500s over a write to an unrelated table.
     */
    static async recordUsage(params: {
        workspaceId: string;
        userId: string | null;
        kind: CreditKind;
        amount: number;
        description?: string;
    }) {
        if (params.amount <= 0) return null;

        await this.ensureCredit(params.workspaceId);

        return BillingRepository.recordUsage({
            workspaceId: params.workspaceId,
            userId: params.userId,
            kind: params.kind,
            amount: params.amount,
            description: params.description ?? null,
        });
    }

    /**
     * Records that someone asked to move plans.
     *
     * There is no payment integration, so this cannot and does not change
     * WorkspaceCredit.plan — silently granting a paid allowance on a button
     * click would be a billing bug, not a feature. The request lands in the
     * audit trail where an admin can act on it, and the UI says so.
     */
    static async requestPlanChange(params: {
        workspaceId: string;
        userId: string;
        plan: string;
    }) {
        const plan = findPlan(params.plan);
        if (!plan) throw new BadRequestError("Unknown plan.");

        await auditQuietly(
            params.workspaceId,
            params.userId,
            "Billing",
            params.workspaceId,
            `PLAN_CHANGE_REQUESTED:${plan.key}`
        );

        return { plan: plan.key, planName: plan.name };
    }

    // ── Referrals ──

    private static inviteUrl(token: string): string {
        // APP_URL rather than the request origin: the link is meant to be
        // pasted into an email or a chat, so it has to be the address the
        // recipient can reach, not whatever host this request arrived on.
        const base = process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
        return `${base}/auth/sign-up?ref=${token}`;
    }

    private static toDTO(referral: {
        id: string;
        email: string;
        status: string;
        token: string;
        createdAt: Date;
        acceptedAt: Date | null;
    }): ReferralDTO {
        return {
            id: referral.id,
            email: referral.email,
            status: referral.status,
            inviteUrl: this.inviteUrl(referral.token),
            createdAt: referral.createdAt.toISOString(),
            acceptedAt: referral.acceptedAt?.toISOString() ?? null,
        };
    }

    static async listReferrals(workspaceId: string): Promise<ReferralDTO[]> {
        const rows = await BillingRepository.listReferrals(workspaceId);
        return rows.map((row) => this.toDTO(row));
    }

    /**
     * Creates (or re-issues) an invitation and returns its shareable link.
     *
     * No email is sent: the app has no mail transport and no Supabase
     * service_role key, so reporting "invitation sent" would be a lie. The
     * token is 32 bytes from a CSPRNG — it is the only thing between a guessed
     * URL and a workspace invitation, so `Math.random` is not an option.
     */
    static async createReferral(params: {
        workspaceId: string;
        userId: string;
        email: string;
        /** The referrer's own address, rejected below. */
        selfEmail: string;
    }): Promise<ReferralDTO> {
        if (params.email === params.selfEmail.trim().toLowerCase()) {
            throw new BadRequestError("That is your own email address.");
        }

        const referral = await BillingRepository.upsertReferral({
            workspaceId: params.workspaceId,
            invitedByUserId: params.userId,
            email: params.email,
            token: randomBytes(32).toString("base64url"),
        });

        await auditQuietly(
            params.workspaceId,
            params.userId,
            "Referral",
            referral.id,
            "REFERRAL_CREATED"
        );

        return this.toDTO(referral);
    }

    /** The plan catalogue, with the workspace's current plan marked. */
    static async getPlans(workspaceId: string) {
        const credit = await this.ensureCredit(workspaceId);
        return this.markCurrentPlan(credit.plan);
    }

    private static markCurrentPlan(currentPlan: string) {
        return PLANS.map((plan) => ({ ...plan, current: plan.key === currentPlan }));
    }

    /**
     * Usage and the plan catalogue in one pass.
     *
     * getUsage() and getPlans() each provision the credit row, so calling both
     * concurrently made a workspace's very first page load race itself. This
     * ensures once and derives both from that single row.
     */
    static async getOverview(workspaceId: string) {
        const usage = await this.getUsage(workspaceId);
        return { usage, plans: this.markCurrentPlan(usage.plan) };
    }
}
