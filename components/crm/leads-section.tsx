"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, MousePointerClick, Percent, TrendingUp, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, Role } from "@/lib/rbac/authorize";
import type { LeadDTO } from "@/models/lead";
import type { WorkspaceMemberDTO } from "@/models/workspace-member";
import { EmptyState, Skeleton, StatusMessage, useAutoClearedStatus } from "@/components/crm/profile/profile-ui";
import { leadApi } from "@/components/leads/lead-api";
import { useLeads } from "@/components/leads/use-leads";
import { LeadList } from "@/components/leads/lead-list";
import { LeadPipeline } from "@/components/leads/lead-pipeline";
import { LeadDetailPanel, type LeadPermissions } from "@/components/leads/lead-detail-panel";
import { LeadFormDialog } from "@/components/leads/lead-form-dialog";
import { LeadConvertDialog } from "@/components/leads/lead-convert-dialog";

/** Below this width the detail panel stacks under the list (see the xl grid). */
const STACKED_LAYOUT_QUERY = "(max-width: 1279px)";

function KpiCard({
    label,
    value,
    icon,
    accent,
}: {
    label: string;
    value: ReactNode;
    icon: ReactNode;
    accent?: "indigo" | "emerald";
}) {
    return (
        <div
            className={cn(
                "rounded-xl border p-3 shadow-sm flex flex-col justify-between h-[80px] relative overflow-hidden transition-colors cursor-default",
                accent === "indigo"
                    ? "border-indigo-200 dark:border-indigo-500/20 dark:bg-[#0B1220] bg-indigo-50/30"
                    : "dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:border-slate-300 dark:hover:border-[#374151]"
            )}
        >
            <div className="flex justify-between items-start relative z-10">
                <span
                    className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        accent === "indigo" ? "text-indigo-700 dark:text-indigo-400" : "text-slate-500 dark:text-[#9CA3AF]"
                    )}
                >
                    {label}
                </span>
                {icon}
            </div>
            <div
                className={cn(
                    "text-[20px] font-bold leading-none relative z-10",
                    accent === "indigo" && "text-indigo-700 dark:text-indigo-400",
                    accent === "emerald" && "text-emerald-600 dark:text-emerald-400",
                    !accent && "dark:text-white text-slate-900"
                )}
            >
                {value}
            </div>
        </div>
    );
}

const iconBox = "size-5 rounded-md flex items-center justify-center";

export function LeadsSection() {
    const leads = useLeads();
    const [members, setMembers] = useState<WorkspaceMemberDTO[]>([]);
    const [me, setMe] = useState<{ userId: string; role: string } | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<LeadDTO | null>(null);
    const [converting, setConverting] = useState<LeadDTO | null>(null);
    const [notice, setNotice] = useAutoClearedStatus();
    const detailRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        leadApi
            .members()
            .then((result) => {
                setMembers(result.members);
                setMe(result.me);
            })
            // Pickers fall back to "Unassigned" only; the list itself still works.
            .catch(() => setMembers([]));
    }, []);

    // Keep the detail panel populated on wide screens, where it sits beside the list.
    useEffect(() => {
        if (selectedId || leads.items.length === 0) return;
        if (typeof window !== "undefined" && window.matchMedia(STACKED_LAYOUT_QUERY).matches) return;
        setSelectedId(leads.items[0].id);
    }, [leads.items, selectedId]);

    const role = me?.role ?? "";
    const permissions: LeadPermissions = {
        canEdit: hasPermission(role, Role.SALES_REP),
        canNote: hasPermission(role, Role.SUPPORT),
        canDelete: hasPermission(role, Role.ADMIN),
    };

    const select = (id: string) => {
        setSelectedId(id);
        // Stacked layout: the panel is below the list, so bring it into view.
        if (window.matchMedia(STACKED_LAYOUT_QUERY).matches) {
            requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
    };

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    const handleSaved = (lead: LeadDTO, mode: "create" | "edit") => {
        if (mode === "create") {
            setSelectedId(lead.id);
            setNotice({ kind: "success", message: `${lead.fullName} added.` });
        } else {
            leads.replaceLead(lead);
            setRefreshKey((key) => key + 1);
            setNotice({ kind: "success", message: "Lead updated." });
        }
        void leads.reload(true);
    };

    const handleChanged = (lead: LeadDTO) => {
        leads.replaceLead(lead);
        void leads.reload(true);
    };

    const handleDeleted = (id: string) => {
        leads.dropLead(id);
        setSelectedId(null);
        setNotice({ kind: "success", message: "Lead deleted." });
        void leads.reload(true);
    };

    const handleConverted = (deal: { id: string; name: string }) => {
        setRefreshKey((key) => key + 1);
        setNotice({ kind: "success", message: `Converted to deal “${deal.name}”.` });
        void leads.reload(true);
    };

    const stats = leads.stats;
    const statValue = (value: number | string) => (stats ? value : <Skeleton className="h-5 w-10" />);

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto pb-14">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b dark:border-white/[0.06] border-slate-200"
            >
                <div>
                    <h1 className="text-base font-bold tracking-tight dark:text-white text-slate-900 mb-0.5">Leads</h1>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Track prospects from first contact to deal pipeline
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Not built yet — shown so the layout does not shift when they land. */}
                    <button type="button" disabled title="Coming soon" className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white text-[10px] font-bold dark:text-slate-500 text-slate-400 shadow-sm cursor-not-allowed">
                        Import CSV/XLSX
                    </button>
                    <button type="button" disabled title="Coming soon" className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white text-[10px] font-bold dark:text-slate-500 text-slate-400 shadow-sm cursor-not-allowed">
                        Export
                    </button>
                    {permissions.canEdit ? (
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-1.5 h-7 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors"
                        >
                            <UserPlus className="size-3" aria-hidden="true" /> Add Lead
                        </button>
                    ) : null}
                </div>
            </motion.div>

            <StatusMessage status={notice} />

            {/* KPI cards — workspace-wide, unaffected by the list filters */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-3"
            >
                <KpiCard
                    label="Total Leads"
                    value={statValue(stats?.total ?? 0)}
                    icon={<div className={cn(iconBox, "dark:bg-white/5 bg-slate-100")}><Users className="size-3 text-slate-500 dark:text-[#9CA3AF]" /></div>}
                />
                <KpiCard
                    label="Qualified"
                    accent="indigo"
                    value={statValue(stats?.byStatus.QUALIFIED ?? 0)}
                    icon={<div className={cn(iconBox, "bg-indigo-100 dark:bg-indigo-500/20")}><CheckCircle2 className="size-3 text-indigo-600 dark:text-indigo-400" /></div>}
                />
                <KpiCard
                    label="Converted"
                    accent="emerald"
                    value={statValue(stats?.byStatus.CONVERTED ?? 0)}
                    icon={<div className={cn(iconBox, "bg-emerald-100 dark:bg-emerald-500/20")}><TrendingUp className="size-3 text-emerald-600 dark:text-emerald-400" /></div>}
                />
                <KpiCard
                    label="Conversion"
                    value={statValue(`${stats?.conversionRate ?? 0}%`)}
                    icon={<div className={cn(iconBox, "dark:bg-white/5 bg-slate-100")}><Percent className="size-3 text-slate-500 dark:text-[#9CA3AF]" /></div>}
                />
            </motion.div>

            {/* Main split layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex flex-col gap-5 min-w-0"
                >
                    <LeadPipeline
                        stats={stats}
                        leads={leads.items}
                        activeStatus={leads.filters.status}
                        onFilterStatus={(status) => leads.updateFilters({ status })}
                        onSelect={select}
                    />
                    <LeadList
                        leads={leads.items}
                        phase={leads.phase}
                        error={leads.error}
                        total={stats?.total ?? null}
                        filters={leads.filters}
                        onFiltersChange={leads.updateFilters}
                        hasFilters={leads.hasFilters}
                        members={members}
                        selectedId={selectedId}
                        onSelect={select}
                        onRetry={() => void leads.reload()}
                        canCreate={permissions.canEdit}
                        onAdd={openCreate}
                        nextCursor={leads.nextCursor}
                        loadingMore={leads.loadingMore}
                        onLoadMore={() => void leads.loadMore()}
                    />
                </motion.div>

                <div ref={detailRef} className="scroll-mt-20 xl:sticky xl:top-4">
                    {selectedId ? (
                        <LeadDetailPanel
                            leadId={selectedId}
                            refreshKey={refreshKey}
                            members={members}
                            currentUserId={me?.userId ?? null}
                            permissions={permissions}
                            onChanged={handleChanged}
                            onDeleted={handleDeleted}
                            onEdit={(lead) => {
                                setEditing(lead);
                                setFormOpen(true);
                            }}
                            onConvert={setConverting}
                        />
                    ) : leads.phase === "ready" && leads.items.length > 0 ? (
                        <div className="hidden xl:block">
                            <EmptyState icon={MousePointerClick} title="Select a lead" description="Pick a lead from the list to see its details and notes." />
                        </div>
                    ) : null}
                </div>
            </div>

            <LeadFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                lead={editing}
                members={members}
                currentUserId={me?.userId ?? null}
                onSaved={handleSaved}
            />
            <LeadConvertDialog
                lead={converting}
                open={converting !== null}
                onOpenChange={(open) => !open && setConverting(null)}
                onConverted={handleConverted}
            />
        </div>
    );
}
