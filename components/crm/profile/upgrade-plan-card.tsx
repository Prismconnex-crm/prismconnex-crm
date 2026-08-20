"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { PLANS } from "@/models/billing";
import type { CreditUsageDTO } from "@/models/billing";
import { SectionCard, Skeleton } from "./profile-ui";

/**
 * Upgrade Plan.
 *
 * A summary plus a way through to /app/billing, which is where the actual plan
 * comparison lives. The current plan and allowance come from the same
 * WorkspaceCredit row the Credit Usage card reads, so the two can never
 * disagree about which plan the workspace is on.
 */
export function UpgradePlanCard({
    usage,
    loading,
}: {
    usage: CreditUsageDTO | null;
    loading: boolean;
}) {
    const current = usage ? PLANS.find((plan) => plan.key === usage.plan) : undefined;
    // Everything above the current tier is what "upgrade" can mean here.
    const currentIndex = current ? PLANS.indexOf(current) : -1;
    const nextPlan = currentIndex >= 0 ? PLANS[currentIndex + 1] : undefined;

    return (
        <SectionCard
            id="plan"
            title="Upgrade Plan"
            description="Your workspace plan and what the next tier adds."
            icon={Sparkles}
            actions={
                <Link
                    href="/app/billing"
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-3 text-[12px] font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0B1220]"
                >
                    View plans
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
            }
        >
            {loading ? (
                <Skeleton className="h-16 w-full" />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-brand/30 bg-brand/[0.04] p-3 dark:border-brand-hover/30 dark:bg-brand-hover/[0.06]">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-brand dark:text-brand-hover">
                            Current plan
                        </p>
                        <p className="mt-0.5 text-[15px] font-bold text-slate-900 dark:text-white">
                            {usage?.planName ?? "Starter"}
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-400">
                            {usage
                                ? `${new Intl.NumberFormat("en-GB").format(usage.allowance)} credits per period`
                                : "Sign in with a workspace account to see your plan."}
                        </p>
                    </div>

                    {nextPlan ? (
                        <div className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.06]">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Next tier
                            </p>
                            <p className="mt-0.5 text-[15px] font-bold text-slate-900 dark:text-white">
                                {nextPlan.name}
                                <span className="ml-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                                    {nextPlan.price}
                                    {nextPlan.period}
                                </span>
                            </p>
                            <p className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-400">
                                {nextPlan.features[0]}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.06]">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Next tier
                            </p>
                            <p className="mt-0.5 text-[13px] text-slate-600 dark:text-slate-400">
                                You are on the highest plan.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </SectionCard>
    );
}
