"use client";

import Link from "next/link";
import { ArrowLeft, Gauge, Sparkles } from "lucide-react";

import { CardSkeleton, SectionCard, formatDate } from "./profile/profile-ui";
import { PlanCatalog } from "./billing/plan-catalog";
import { useCreditOverview } from "./billing/use-credit-overview";

/**
 * /app/upgrade-plan — the dedicated Upgrade Plan page.
 *
 * Reached from the topbar user menu (and from the Profile page's Upgrade Plan
 * card, via /app/billing). The plan catalogue itself is ./billing/plan-catalog,
 * shared with /app/billing, so adding a tier or changing a price is one edit to
 * models/billing.ts and both screens follow — this file only owns the page
 * frame around it.
 *
 * No payment is taken anywhere in this app; PlanCatalog documents why and says
 * so on screen.
 */
export function UpgradePlanSection() {
    const { usage, plans, loading } = useCreditOverview();

    const formatter = new Intl.NumberFormat("en-GB");

    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-3 pb-10">
            {/*
                Header stacks on phones and sits inline from sm up, so the
                "Back to Profile" control never squeezes the title.
            */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand dark:bg-brand-hover/10 dark:text-brand-hover">
                        <Sparkles className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                        <h1 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-white">
                            Upgrade Plan
                        </h1>
                        <p className="mt-0.5 text-[13px] text-slate-600 dark:text-slate-400">
                            Compare tiers and request a change for this workspace.
                        </p>
                    </div>
                </div>

                <Link
                    href="/app/profile"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Back to Profile
                </Link>
            </div>

            {loading ? (
                <CardSkeleton rows={2} />
            ) : (
                <SectionCard
                    title="Current plan"
                    description={
                        usage
                            ? `Period ${formatDate(usage.periodStart)} — ${formatDate(usage.periodEnd)}`
                            : "This session has no workspace, so there is no plan to show."
                    }
                    icon={Gauge}
                >
                    {usage ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-brand/30 bg-brand/[0.04] p-3 dark:border-brand-hover/30 dark:bg-brand-hover/[0.06]">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-brand dark:text-brand-hover">
                                    Plan
                                </p>
                                <p className="mt-1 text-[18px] font-bold text-slate-900 dark:text-white">
                                    {usage.planName}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.06]">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Credits per period
                                </p>
                                <p className="mt-1 text-[18px] font-bold tabular-nums text-slate-900 dark:text-white">
                                    {formatter.format(usage.allowance)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.06]">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Remaining
                                </p>
                                <p className="mt-1 text-[18px] font-bold tabular-nums text-brand dark:text-brand-hover">
                                    {formatter.format(usage.remaining)}
                                </p>
                            </div>
                        </div>
                    ) : null}
                </SectionCard>
            )}

            <SectionCard
                title="Plans"
                description="Choosing a plan records a request — no payment is taken."
                icon={Sparkles}
            >
                <PlanCatalog plans={plans} currentPlan={usage?.plan ?? null} />
            </SectionCard>
        </div>
    );
}
