"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Gauge, History, PieChart, WalletCards } from "lucide-react";

import { cn } from "@/lib/utils";
import {
    CardSkeleton,
    EmptyState,
    SectionCard,
    formatDate,
    formatDateTime,
} from "./profile/profile-ui";
import { useCreditOverview } from "./billing/use-credit-overview";

/**
 * /app/credit-usage — the dedicated Credit Usage page.
 *
 * Reached from the topbar user menu. Every figure comes from WorkspaceCredit
 * plus the CreditUsageEntry ledger (services/billing.service.ts) — nothing here
 * is illustrative or seeded. A workspace that has run no metered operations
 * reads zero used, which is why the empty states explain what consumes credits
 * rather than apologising for the number.
 *
 * The Profile page keeps its compact Credit Usage card; this page is the full
 * view of the same data, led by the three figures a user actually comes for.
 */

/** Amber past 75%, red past 90% — the meter has to read at a glance. */
function meterTone(percent: number) {
    if (percent >= 90) return "bg-red-500";
    if (percent >= 75) return "bg-amber-500";
    return "bg-brand dark:bg-brand-hover";
}

function SummaryTile({
    label,
    value,
    hint,
    emphasis,
}: {
    label: string;
    value: string;
    hint?: string;
    emphasis?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-lg border p-3.5",
                emphasis
                    ? "border-brand/30 bg-brand/[0.04] dark:border-brand-hover/30 dark:bg-brand-hover/[0.06]"
                    : "border-slate-200 bg-white/60 dark:border-white/[0.06] dark:bg-white/[0.02]"
            )}
        >
            <p
                className={cn(
                    "text-[11px] font-medium uppercase tracking-wide",
                    emphasis
                        ? "text-brand dark:text-brand-hover"
                        : "text-slate-500 dark:text-slate-400"
                )}
            >
                {label}
            </p>
            <p
                className={cn(
                    "mt-1 text-[24px] font-bold tabular-nums tracking-tight",
                    emphasis ? "text-brand dark:text-brand-hover" : "text-slate-900 dark:text-white"
                )}
            >
                {value}
            </p>
            {hint ? (
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
            ) : null}
        </div>
    );
}

export function CreditUsageSection() {
    const { usage, loading } = useCreditOverview();

    const formatter = new Intl.NumberFormat("en-GB");

    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-3 pb-10">
            {/*
                Header stacks on phones and sits inline from sm up, so the
                back/upgrade controls never squeeze the title.
            */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand dark:bg-brand-hover/10 dark:text-brand-hover">
                        <Gauge className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                        <h1 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-white">
                            Credit Usage
                        </h1>
                        <p className="mt-0.5 text-[13px] text-slate-600 dark:text-slate-400">
                            Credits consumed by this workspace in the current billing period.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/app/profile"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                    >
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                        Back to Profile
                    </Link>
                    <Link
                        href="/app/upgrade-plan"
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-3 text-[12px] font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0B1220]"
                    >
                        Upgrade plan
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                </div>
            </div>

            {loading ? (
                <CardSkeleton rows={3} />
            ) : !usage ? (
                <SectionCard title="Summary" icon={Gauge}>
                    <EmptyState
                        icon={WalletCards}
                        title="No workspace on this session"
                        description="Credits belong to a workspace. Sign in with an account that has one to see its balance."
                    />
                </SectionCard>
            ) : (
                <>
                    <SectionCard
                        title="Summary"
                        description={`${usage.planName} plan · period ${formatDate(usage.periodStart)} — ${formatDate(usage.periodEnd)}`}
                        icon={Gauge}
                    >
                        {/* Stacks on phones, three across from sm up. */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <SummaryTile
                                label="Total credits"
                                value={formatter.format(usage.allowance)}
                                hint="granted this period"
                            />
                            <SummaryTile
                                label="Used credits"
                                value={formatter.format(usage.used)}
                                hint="this period"
                            />
                            <SummaryTile
                                label="Remaining credits"
                                value={formatter.format(usage.remaining)}
                                hint={`of ${formatter.format(usage.allowance)} credits`}
                                emphasis
                            />
                        </div>

                        {/*
                            The meter is a plain div rather than <progress>:
                            Safari and Firefox style the native element
                            differently enough that it cannot be made to match
                            the rest of the page. The ARIA roles give assistive
                            tech the same information the bar conveys.
                        */}
                        <div className="mt-4">
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-[12px]">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {usage.percentUsed}% of allowance used
                                </span>
                                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                                    {formatter.format(usage.used)} /{" "}
                                    {formatter.format(usage.allowance)}
                                </span>
                            </div>
                            <div
                                role="progressbar"
                                aria-valuenow={usage.percentUsed}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label="Credits used"
                                className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]"
                            >
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-[width] duration-500",
                                        meterTone(usage.percentUsed)
                                    )}
                                    style={{ width: `${usage.percentUsed}%` }}
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="What credits were spent on"
                        description="Totals for the current period, by kind of operation."
                        icon={PieChart}
                    >
                        {usage.breakdown.length > 0 ? (
                            <dl className="grid gap-2 sm:grid-cols-3">
                                {usage.breakdown.map((row) => (
                                    <div
                                        key={row.kind}
                                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/[0.06]"
                                    >
                                        <dt className="text-[12px] text-slate-600 dark:text-slate-400">
                                            {row.label}
                                        </dt>
                                        <dd className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white">
                                            {formatter.format(row.amount)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        ) : (
                            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-[12px] text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                                No credits used yet this period. Credits are consumed when the
                                People page looks up employee details for a company.
                            </p>
                        )}
                    </SectionCard>

                    <SectionCard
                        title="Recent usage"
                        description="The most recent entries in this workspace's credit ledger."
                        icon={History}
                    >
                        {usage.recent.length > 0 ? (
                            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-white/[0.06] dark:border-white/[0.06]">
                                {usage.recent.map((entry) => (
                                    <li
                                        key={entry.id}
                                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-200">
                                                {entry.description || entry.label}
                                            </p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {formatDateTime(entry.createdAt)}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                                            −{formatter.format(entry.amount)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-[12px] text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                                Nothing recorded yet. Metered operations appear here as they run.
                            </p>
                        )}
                    </SectionCard>
                </>
            )}
        </div>
    );
}
