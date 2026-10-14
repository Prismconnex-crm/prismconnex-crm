"use client";

import { AlertCircle, Loader2, Search, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadDTO } from "@/models/lead";
import type { WorkspaceMemberDTO } from "@/models/workspace-member";
import { EmptyState, Skeleton } from "@/components/crm/profile/profile-ui";
import {
    SELECTABLE_STATUS_OPTIONS,
    describeFollowUp,
    leadInitials,
    sourceLabel,
    statusClassName,
    statusLabel,
} from "@/lib/leads/presentation";
import type { LeadFilters } from "./use-leads";

const FILTER_SELECT_CLASSES =
    "h-8 min-w-0 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white px-2 text-[10.5px] font-bold dark:text-slate-300 text-slate-700 shadow-sm focus:border-indigo-500/50 focus:outline-none";

export function StatusBadge({ status }: { status: string }) {
    return (
        <span
            className={cn(
                "inline-flex items-center justify-center rounded-[4px] px-1.5 py-[1px] text-[8.5px] font-bold tracking-wide uppercase border dark:border-transparent",
                statusClassName(status)
            )}
        >
            {statusLabel(status)}
        </span>
    );
}

function FollowUp({ iso }: { iso: string | null }) {
    const followUp = describeFollowUp(iso);
    if (!followUp) return <span className="text-slate-400 dark:text-slate-500">—</span>;
    return (
        <span className={cn("font-medium", followUp.overdue ? "text-rose-600 dark:text-rose-400" : "dark:text-slate-300 text-slate-600")}>
            {followUp.label}
        </span>
    );
}

function ScoreBar({ score }: { score: number }) {
    return (
        <div className="flex items-center gap-2 w-[80px]">
            <span className="text-[10px] font-bold dark:text-white text-slate-800">{score}%</span>
            <div className="h-1 flex-1 dark:bg-[#16233A] bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${score}%` }} />
            </div>
        </div>
    );
}

type Props = {
    leads: LeadDTO[];
    phase: "loading" | "ready" | "error";
    error: string | null;
    total: number | null;
    filters: LeadFilters;
    onFiltersChange: (patch: Partial<LeadFilters>) => void;
    hasFilters: boolean;
    members: WorkspaceMemberDTO[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onRetry: () => void;
    canCreate: boolean;
    onAdd: () => void;
    nextCursor: string | null;
    loadingMore: boolean;
    onLoadMore: () => void;
};

export function LeadList({
    leads,
    phase,
    error,
    total,
    filters,
    onFiltersChange,
    hasFilters,
    members,
    selectedId,
    onSelect,
    onRetry,
    canCreate,
    onAdd,
    nextCursor,
    loadingMore,
    onLoadMore,
}: Props) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[12px] font-bold dark:text-white text-slate-900 uppercase tracking-wide">Master List</h2>
                {total !== null ? (
                    <span className="px-1.5 py-0.5 rounded-[4px] dark:bg-[#16233A] bg-slate-100 text-[9.5px] font-bold dark:text-[#9CA3AF] text-slate-500 border dark:border-white/[0.06] border-slate-200 shadow-sm leading-none">
                        {total}
                    </span>
                ) : null}
            </div>

            <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white shadow-sm flex flex-col overflow-hidden">
                {/* Filter bar */}
                <div className="p-3 border-b dark:border-white/[0.06] border-slate-200 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 dark:bg-[#070B14] bg-slate-50">
                    <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 dark:text-[#9CA3AF]" aria-hidden="true" />
                        <input
                            type="search"
                            value={filters.q}
                            onChange={(event) => onFiltersChange({ q: event.target.value })}
                            placeholder="Search name, email or company..."
                            aria-label="Search leads"
                            className="w-full h-8 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white pl-8 pr-3 text-[10.5px] font-medium dark:text-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500/50 focus:outline-none transition-all shadow-inner"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <select
                            value={filters.status}
                            onChange={(event) => onFiltersChange({ status: event.target.value })}
                            aria-label="Filter by status"
                            className={cn(FILTER_SELECT_CLASSES, "sm:w-[130px]")}
                        >
                            <option value="">All statuses</option>
                            {SELECTABLE_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                            <option value="CONVERTED">Converted</option>
                        </select>
                        <select
                            value={filters.owner}
                            onChange={(event) => onFiltersChange({ owner: event.target.value })}
                            aria-label="Filter by owner"
                            className={cn(FILTER_SELECT_CLASSES, "sm:w-[140px]")}
                        >
                            <option value="all">All owners</option>
                            <option value="me">Assigned to me</option>
                            <option value="unassigned">Unassigned</option>
                            {members.map((member) => (
                                <option key={member.userId} value={member.userId}>{member.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {phase === "loading" ? (
                    <div className="p-3 space-y-2" aria-busy="true" aria-label="Loading leads">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <Skeleton key={index} className="h-9 w-full" />
                        ))}
                    </div>
                ) : phase === "error" ? (
                    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <AlertCircle className="size-5 text-rose-500" aria-hidden="true" />
                        <p className="text-[12px] font-semibold dark:text-slate-200 text-slate-700">Could not load leads</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{error}</p>
                        <button
                            type="button"
                            onClick={onRetry}
                            className="mt-1 h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 bg-white dark:bg-transparent text-[10px] font-bold dark:text-slate-300 text-slate-700 hover:bg-slate-100 dark:hover:bg-[#16233A] transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                ) : leads.length === 0 ? (
                    <div className="p-4">
                        {hasFilters ? (
                            <EmptyState icon={Search} title="No leads match these filters" description="Try a different search, status or owner." />
                        ) : (
                            <div className="space-y-3">
                                <EmptyState
                                    icon={Users}
                                    title="No leads yet"
                                    description={canCreate ? "Add your first lead to start building the pipeline." : "Leads your team adds will appear here."}
                                />
                                {canCreate ? (
                                    <div className="flex justify-center">
                                        <button
                                            type="button"
                                            onClick={onAdd}
                                            className="inline-flex items-center gap-1.5 h-7 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors"
                                        >
                                            <UserPlus className="size-3" aria-hidden="true" /> Add Lead
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Phones: stacked cards — a 7-column table is unreadable at 375px. */}
                        <ul className="md:hidden divide-y dark:divide-white/[0.06] divide-slate-100">
                            {leads.map((lead) => (
                                <li key={lead.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(lead.id)}
                                        aria-current={selectedId === lead.id ? "true" : undefined}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-l-[3px] transition-colors",
                                            selectedId === lead.id ? "dark:bg-[#111B2E] bg-slate-50 border-indigo-500" : "border-transparent hover:bg-slate-50 dark:hover:bg-[#16233A]/40"
                                        )}
                                    >
                                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full dark:bg-[#16233A] bg-slate-200 text-[9.5px] font-bold dark:text-white text-slate-700">
                                            {leadInitials(lead.fullName)}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="truncate text-[12px] font-bold dark:text-slate-100 text-slate-800">{lead.fullName}</span>
                                                <StatusBadge status={lead.status} />
                                            </span>
                                            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                                                {[lead.companyName, lead.owner?.name].filter(Boolean).join(" · ") || "No company"}
                                            </span>
                                            <span className="mt-0.5 block text-[10.5px]">
                                                <FollowUp iso={lead.nextFollowUpAt} />
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {/* md and up: the table */}
                        <div className="hidden md:block overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left text-[10.5px] whitespace-nowrap min-w-[760px]">
                                <thead className="dark:bg-[#070B14]/50 bg-slate-50/50 border-b dark:border-white/[0.06] border-slate-200 uppercase tracking-widest text-[9px] font-bold dark:text-slate-500 text-slate-400">
                                    <tr>
                                        <th scope="col" className="px-3 py-2">Lead</th>
                                        <th scope="col" className="px-3 py-2">Company</th>
                                        <th scope="col" className="px-3 py-2">Source</th>
                                        <th scope="col" className="px-3 py-2">Status</th>
                                        <th scope="col" className="px-3 py-2">Owner</th>
                                        <th scope="col" className="px-3 py-2">Follow-up</th>
                                        <th scope="col" className="px-3 py-2">Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-white/[0.06] divide-slate-100">
                                    {leads.map((lead) => {
                                        const isActive = selectedId === lead.id;
                                        return (
                                            <tr
                                                key={lead.id}
                                                onClick={() => onSelect(lead.id)}
                                                className={cn(
                                                    "transition-colors h-[40px] cursor-pointer group border-l-[3px]",
                                                    isActive ? "dark:bg-[#111B2E] bg-slate-50 border-indigo-500" : "hover:bg-slate-50 dark:hover:bg-[#16233A]/40 border-transparent"
                                                )}
                                            >
                                                <td className="px-3">
                                                    {/* The row's click target, reachable by keyboard. */}
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onSelect(lead.id);
                                                        }}
                                                        aria-current={isActive ? "true" : undefined}
                                                        className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded"
                                                    >
                                                        <span className="flex size-5 items-center justify-center rounded-full dark:bg-[#16233A] bg-slate-200 text-[8.5px] font-bold dark:text-white text-slate-700 border dark:border-white/[0.06] border-slate-300">
                                                            {leadInitials(lead.fullName)}
                                                        </span>
                                                        <span className={cn("font-bold", isActive ? "text-indigo-700 dark:text-indigo-400" : "dark:text-slate-200 text-slate-700")}>
                                                            {lead.fullName}
                                                        </span>
                                                    </button>
                                                </td>
                                                <td className="px-3 font-medium dark:text-slate-300 text-slate-600 truncate max-w-[140px]">{lead.companyName ?? "—"}</td>
                                                <td className="px-3 font-medium dark:text-slate-500 text-slate-500 truncate max-w-[120px]">{sourceLabel(lead.source)}</td>
                                                <td className="px-3"><StatusBadge status={lead.status} /></td>
                                                <td className="px-3 font-medium dark:text-slate-300 text-slate-600 truncate max-w-[120px]">
                                                    {lead.owner?.name ?? <span className="text-slate-400 dark:text-slate-500">Unassigned</span>}
                                                </td>
                                                <td className="px-3"><FollowUp iso={lead.nextFollowUpAt} /></td>
                                                <td className="px-3"><ScoreBar score={lead.score} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {nextCursor ? (
                            <div className="p-2 border-t dark:border-white/[0.06] border-slate-200 flex justify-center">
                                <button
                                    type="button"
                                    onClick={onLoadMore}
                                    disabled={loadingMore}
                                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[10px] font-bold dark:text-slate-300 text-slate-600 hover:bg-slate-100 dark:hover:bg-[#16233A] transition-colors disabled:opacity-60"
                                >
                                    {loadingMore ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
                                    Load more
                                </button>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}
