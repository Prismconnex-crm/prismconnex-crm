import { z } from "zod";

/**
 * Zod schemas + DTOs for credits, plans and referrals.
 *
 * Mirrors the convention in models/profile.ts: the schema is the single
 * definition of what the API accepts, and the DTO types are what the service
 * layer and the client agree on.
 */

// ─── Plans ───────────────────────────────────────────────────

/**
 * The three tiers on the public pricing page. Kept as a const tuple rather than
 * a Prisma enum so a pricing change is a code edit, not a migration — there is
 * no payment provider to keep in step with, so the database only needs to store
 * which one is current.
 */
export const PLAN_KEYS = ["STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type PlanDefinition = {
    key: PlanKey;
    name: string;
    price: string;
    period: string;
    description: string;
    /** Credits granted per period. Enterprise is negotiated, hence null. */
    credits: number | null;
    features: string[];
};

/**
 * Plan catalogue, matching app/(public)/pricing/page.tsx.
 *
 * `credits` is the number written to WorkspaceCredit.allowance when a workspace
 * lands on that plan, so this table and the balance can never disagree.
 */
export const PLANS: readonly PlanDefinition[] = [
    {
        key: "STARTER",
        name: "Starter",
        price: "€0",
        period: "/month",
        description: "For evaluating Prismconnex with a single user.",
        credits: 1000,
        features: [
            "1,000 credits per month",
            "Company + people discovery",
            "Up to 3 workspace members",
            "Email support",
        ],
    },
    {
        key: "PROFESSIONAL",
        name: "Professional",
        price: "€79",
        period: "/user/month",
        description: "For sales teams running live pipeline and sequences.",
        credits: 25000,
        features: [
            "25,000 credits per month",
            "Sequences + automation",
            "Unlimited workspace members",
            "Priority support",
        ],
    },
    {
        key: "ENTERPRISE",
        name: "Enterprise",
        price: "Custom",
        period: "",
        description: "For organisations with bespoke volume and compliance needs.",
        credits: null,
        features: [
            "Negotiated credit volume",
            "SSO + audit export",
            "Dedicated success manager",
            "Custom data retention",
        ],
    },
];

export function findPlan(key: string): PlanDefinition | undefined {
    return PLANS.find((plan) => plan.key === key);
}

// ─── Credits ─────────────────────────────────────────────────

/**
 * What a credit is spent on.
 *
 * PEOPLE_LOOKUP is the only kind currently written, because the ContactOut
 * people search is the only genuinely credit-metered call in the app. The
 * others are declared so the ledger does not need a migration when a second
 * metered call site appears.
 */
export const CREDIT_KINDS = ["PEOPLE_LOOKUP", "COMPANY_EXPORT", "AI_QUERY"] as const;
export type CreditKind = (typeof CREDIT_KINDS)[number];

export const CREDIT_KIND_LABELS: Record<CreditKind, string> = {
    PEOPLE_LOOKUP: "People lookups",
    COMPANY_EXPORT: "Company exports",
    AI_QUERY: "AI queries",
};

export type CreditBreakdownDTO = {
    kind: CreditKind | string;
    label: string;
    amount: number;
};

export type CreditUsageDTO = {
    plan: PlanKey | string;
    planName: string;
    /** Credits granted this period. */
    allowance: number;
    /** Credits consumed this period. */
    used: number;
    /** allowance - used, floored at 0. */
    remaining: number;
    /** 0-100, floored at 0 and capped at 100 for the meter width. */
    percentUsed: number;
    periodStart: string;
    periodEnd: string;
    breakdown: CreditBreakdownDTO[];
    recent: {
        id: string;
        kind: string;
        label: string;
        amount: number;
        description: string | null;
        createdAt: string;
    }[];
};

// ─── Referrals ───────────────────────────────────────────────

export const CreateReferralSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, "Enter an email address")
        .max(254, "That email address is too long")
        .email("Enter a valid email address")
        .transform((value) => value.toLowerCase()),
});

export type CreateReferralDTO = z.infer<typeof CreateReferralSchema>;

export type ReferralDTO = {
    id: string;
    email: string;
    status: string;
    /** Absolute sign-up URL carrying the token. */
    inviteUrl: string;
    createdAt: string;
    acceptedAt: string | null;
};
