"use client";

import Link from "next/link";
import { ArrowUpRight, Gauge, WalletCards } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CreditUsageDTO } from "@/models/billing";
import { EmptyState, SectionCard, Skeleton, formatDate, formatDateTime } from "./profile-ui";

/**
 * Credit Usage.
 *
 * Every figure here is read from WorkspaceCredit + the CreditUsageEntry ledger
 * (see services/billing.service.ts) — nothing on this card is illustrative. A
 * workspace that has run no metered operations shows zero used, which is why
 * the empty state explains what consumes credits rather than apologising for
 * the number.
 */

/** Amber past 75%, red past 90% — the meter has to read at a glance. */
function meterTone(percent: number) {
    if (percent >= 90) return "bg-red-500";
    if (percent >= 75) return "bg-amber-500";
    return "bg-brand dark:bg-brand-hover";
}

function Stat({
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
        <div className="rounded-lg border border-slate-200 bg-white/60 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </p>
            <p
                className={cn(
                    "mt-1 text-[20px] font-bold tabular-nums tracking-tight",
                    emphasis
                        ? "text-brand dark:text-brand-hover"
                        : "text-slate-900 dark:text-white"
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

export function CreditUsageCard({
    usage,
    loading,
}: {
    usage: CreditUsageDTO | null;
    loading: boolean;
}) {
    if (loading) {
        return (
            <SectionCard
                title="Credit Usage"
                description="Credits consumed by this workspace in the current billing period."
                icon={Gauge}
            >
                <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Skeleton className="h-[74px]" />
                        <Skeleton className="h-[74px]" />
                        <Skeleton className="h-[74px]" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                </div>
            </SectionCard>
        );
    }

    if (!usage) {
        return (
            <SectionCard
                title="Credit Usage"
                description="Credits consumed by this workspace in the current billing period."
                icon={Gauge}
            >
                <EmptyState
                    icon={WalletCards}
                    title="No workspace on this session"
                    description="Credits belong to a workspace. Sign in with an account that has one to see its balance."
                />
            </SectionCard>
        );
    }

    const formatter = new Intl.NumberFormat("en-GB");

    return (
        <SectionCard
            title="Credit Usage"
            description={`${usage.planName} plan · period ends ${formatDate(usage.periodEnd)}`}
            icon={Gauge}
            actions={
                <Link
                    href="/app/billing"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                >
                    Manage plan
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
            }
        >
            <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                    label="Used"
                    value={formatter.format(usage.used)}
                    hint="this period"
                />
                <Stat
                    label="Remaining"
                    value={formatter.format(usage.remaining)}
                    hint={`of ${formatter.format(usage.allowance)} credits`}
                    emphasis
                />
                <Stat
                    label="Period started"
                    value={formatDate(usage.periodStart)}
                />
            </div>

            {/*
                The meter is a plain div rather than <progress>: Safari and
                Firefox style the native element differently enough that it
                cannot be made to match the rest of the page. The ARIA roles
                give assistive tech the same information the bar conveys.
            */}
            <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                        {usage.percentUsed}% of allowance used
                    </span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {formatter.format(usage.used)} / {formatter.format(usage.allowance)}
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

            {usage.breakdown.length > 0 ? (
                <dl className="mt-4 grid gap-2 sm:grid-cols-3">
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
                <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-[12px] text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                    No credits used yet this period. Credits are consumed when the People page
                    looks up employee details for a company.
                </p>
            )}

            {usage.recent.length > 0 ? (
                <div className="mt-4">
                    <h3 className="mb-2 text-[12px] font-bold text-slate-900 dark:text-white">
                        Recent usage
                    </h3>
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
                </div>
            ) : null}
        </SectionCard>
    );
}
