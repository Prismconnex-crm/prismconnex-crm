"use client";

import Link from "next/link";
import { Activity, ChevronRight, Clock, History } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    EmptyState,
    ReadOnlyField,
    SectionCard,
    Skeleton,
    formatDateTime,
} from "./profile-ui";
import type { ActivityView } from "./types";

/**
 * Activity: sign-in history, profile changes, and CRM counters.
 *
 * The scope badge on each counter is not decoration. Lead, Deal and Contact
 * carry no owner column in this schema, so those totals are workspace-wide and
 * saying "yours" would be a fabricated number on the user's own page. Tasks do
 * have an owner, so those are genuinely per-user and labelled accordingly.
 */
export function ActivityCard({
    activity,
    loading,
}: {
    activity: ActivityView | null;
    loading: boolean;
}) {
    return (
        <SectionCard
            id="activity"
            title="Activity"
            description="Your recent sign-ins, profile changes and CRM totals."
            icon={Activity}
            actions={
                /*
                    Top-right of the card, on the heading's row: SectionCard's
                    header is already a `justify-between` flex, so this is the
                    slot every other card puts its one action in — no new
                    layout, and it wraps under the heading on a narrow screen
                    rather than squeezing the title.

                    `next/link` rather than an onClick + location: the App
                    Router navigates client-side, keeping the shell — and the
                    assistant conversation mounted in it — alive, as every
                    other cross-section link on the Profile page does.
                */
                <Link
                    href="/app/audit-log"
                    aria-label="View more activity in the audit log"
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold text-brand transition-colors hover:bg-brand/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:text-brand-hover dark:hover:bg-brand-hover/[0.08]"
                >
                    View More
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
            }
        >
            {loading ? (
                <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                    </div>
                    <Skeleton className="h-24" />
                </div>
            ) : !activity ? (
                <EmptyState
                    icon={Activity}
                    title="Activity unavailable"
                    description="We could not load your activity just now. Refresh the page to try again."
                />
            ) : (
                <div className="space-y-5">
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                        <ReadOnlyField
                            label="Last Login"
                            value={
                                activity.lastLoginAt ? (
                                    formatDateTime(activity.lastLoginAt)
                                ) : (
                                    <span className="text-slate-400 dark:text-slate-500">
                                        Not recorded yet
                                    </span>
                                )
                            }
                        />
                        <ReadOnlyField
                            label="Profile Last Changed"
                            value={formatDateTime(activity.profileUpdatedAt)}
                        />
                        <ReadOnlyField
                            label="Member Since"
                            value={formatDateTime(activity.memberSince)}
                        />
                    </dl>

                    {/* ── Counters ── */}
                    <div>
                        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            CRM Activity
                        </h3>

                        {activity.counters.length ? (
                            <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                                {activity.counters.map((counter) => (
                                    <li
                                        key={counter.key}
                                        className="rounded-lg border border-slate-200 p-2.5 dark:border-white/[0.06]"
                                    >
                                        <p className="text-[20px] font-bold leading-none text-slate-900 dark:text-white">
                                            {counter.value.toLocaleString("en-GB")}
                                        </p>
                                        <p className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                            {counter.label}
                                        </p>
                                        <span
                                            className={cn(
                                                "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                                counter.scope === "user"
                                                    ? "bg-brand/10 text-brand dark:bg-brand-hover/10 dark:text-brand-hover"
                                                    : "bg-slate-200/70 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400"
                                            )}
                                        >
                                            {counter.scope === "user" ? "You" : "Workspace"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState
                                icon={Clock}
                                title="No workspace yet"
                                description="CRM totals appear once you belong to a workspace."
                            />
                        )}
                    </div>

                    {/* ── Audit trail ── */}
                    <div>
                        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Recent Changes
                        </h3>

                        {activity.recent.length ? (
                            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-white/[0.06] dark:border-white/[0.06]">
                                {activity.recent.map((entry) => (
                                    <li
                                        key={entry.id}
                                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <History
                                                className="size-3.5 shrink-0 text-slate-400"
                                                aria-hidden="true"
                                            />
                                            <p className="truncate text-[12px] text-slate-700 dark:text-slate-300">
                                                <span className="font-semibold">
                                                    {entry.action}
                                                </span>{" "}
                                                <span className="text-slate-500 dark:text-slate-400">
                                                    {entry.entity}
                                                </span>
                                                {entry.byCurrentUser ? (
                                                    <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand dark:bg-brand-hover/10 dark:text-brand-hover">
                                                        You
                                                    </span>
                                                ) : null}
                                            </p>
                                        </div>
                                        <time
                                            dateTime={entry.createdAt}
                                            className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400"
                                        >
                                            {formatDateTime(entry.createdAt)}
                                        </time>
                                    </li>
                                ))}
                            </ul>
                        ) : activity.recentUnavailable ? (
                            // Distinct from "empty" on purpose: an empty list
                            // says nothing has happened, which would be a
                            // false statement when the read itself failed.
                            <EmptyState
                                icon={History}
                                title="Audit trail unavailable"
                                description="The audit log table is missing columns this view needs. Applying the pending database migration restores it; everything else on this page is unaffected."
                            />
                        ) : (
                            <EmptyState
                                icon={History}
                                title="Nothing recorded yet"
                                description="Changes to leads, deals and companies in your workspace will be listed here."
                            />
                        )}
                    </div>
                </div>
            )}
        </SectionCard>
    );
}
