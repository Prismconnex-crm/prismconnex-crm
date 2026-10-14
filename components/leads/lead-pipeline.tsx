"use client";

import { cn } from "@/lib/utils";
import type { LeadDTO, LeadStatsDTO } from "@/models/lead";
import { PIPELINE_STATUSES, describeFollowUp, statusLabel } from "@/lib/leads/presentation";
import { Skeleton } from "@/components/crm/profile/profile-ui";

/** Cards per column; the full set is one click away in the filtered list. */
const CARDS_PER_STAGE = 3;

type Props = {
    stats: LeadStatsDTO | null;
    leads: LeadDTO[];
    activeStatus: string;
    onFilterStatus: (status: string) => void;
    onSelect: (id: string) => void;
};

/**
 * Stage columns with the workspace-wide count from `stats`, and a preview of
 * the loaded leads in each. Clicking a heading filters the list below to that
 * stage; clicking it again clears the filter.
 */
export function LeadPipeline({ stats, leads, activeStatus, onFilterStatus, onSelect }: Props) {
    return (
        <div>
            <h2 className="text-[12px] font-bold dark:text-white text-slate-900 mb-2 uppercase tracking-wide">Lead Pipeline Overview</h2>
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 snap-x">
                {PIPELINE_STATUSES.map((status) => {
                    const stageLeads = leads.filter((lead) => lead.status === status).slice(0, CARDS_PER_STAGE);
                    const isActive = activeStatus === status;

                    return (
                        <div key={status} className="min-w-[160px] flex-1 flex flex-col gap-1.5 snap-start">
                            <button
                                type="button"
                                onClick={() => onFilterStatus(isActive ? "" : status)}
                                aria-pressed={isActive}
                                className={cn(
                                    "flex items-center justify-between rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
                                    isActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                                )}
                            >
                                <span>{statusLabel(status)}</span>
                                {stats ? <span className="tabular-nums">{stats.byStatus[status]}</span> : <Skeleton className="h-3 w-4" />}
                            </button>

                            {stageLeads.map((lead) => {
                                const followUp = describeFollowUp(lead.nextFollowUpAt);
                                return (
                                    <button
                                        type="button"
                                        key={lead.id}
                                        onClick={() => onSelect(lead.id)}
                                        className="text-left rounded-lg border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white p-2.5 shadow-sm hover:border-indigo-400 dark:hover:border-[#4F46E5]/50 transition-colors"
                                    >
                                        <p className="text-[10.5px] font-bold dark:text-white text-slate-800 leading-tight mb-0.5 truncate">{lead.fullName}</p>
                                        <p className="text-[9.5px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1.5 truncate">{lead.companyName ?? "—"}</p>
                                        <p className="text-[8.5px] font-bold text-slate-400 dark:text-[#9CA3AF] uppercase tracking-wide">
                                            Next:{" "}
                                            <span className={cn("tracking-normal font-medium normal-case", followUp?.overdue ? "text-rose-600 dark:text-rose-400" : "dark:text-[#E5E7EB] text-slate-700")}>
                                                {followUp?.label ?? "Not set"}
                                            </span>
                                        </p>
                                    </button>
                                );
                            })}

                            {stats && stats.byStatus[status] === 0 ? (
                                <p className="rounded-lg border border-dashed dark:border-white/[0.08] border-slate-200 px-2 py-3 text-center text-[9.5px] text-slate-400 dark:text-slate-500">
                                    No leads
                                </p>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
