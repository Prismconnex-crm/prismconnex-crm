"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, Mail, MessageSquare, Pencil, Phone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadDTO, LeadDetailDTO } from "@/models/lead";
import type { WorkspaceMemberDTO } from "@/models/workspace-member";
import {
    EmptyState,
    PrimaryButton,
    SecondaryButton,
    Skeleton,
    StatusMessage,
    TextAreaField,
    formatDateTime,
    useAutoClearedStatus,
} from "@/components/crm/profile/profile-ui";
import { SELECTABLE_STATUS_OPTIONS, describeFollowUp, sourceLabel, toDateInputValue } from "@/lib/leads/presentation";
import { leadApi, type LeadInput } from "./lead-api";
import { StatusBadge } from "./lead-list";

const INLINE_CONTROL_CLASSES =
    "h-7 min-w-0 flex-1 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white px-2 text-[10.5px] font-medium dark:text-white text-slate-800 focus:border-indigo-500/50 focus:outline-none disabled:opacity-60";

export type LeadPermissions = { canEdit: boolean; canNote: boolean; canDelete: boolean };

type Props = {
    leadId: string;
    /** Bumped by the parent after an edit elsewhere, to refetch. */
    refreshKey: number;
    members: WorkspaceMemberDTO[];
    currentUserId: string | null;
    permissions: LeadPermissions;
    onChanged: (lead: LeadDTO) => void;
    onDeleted: (id: string) => void;
    onEdit: (lead: LeadDTO) => void;
    onConvert: (lead: LeadDTO) => void;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center gap-3 min-h-[28px]">
            <div className="w-[72px] shrink-0 font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400 text-[9px]">{label}</div>
            <div className="min-w-0 flex-1 dark:text-white text-slate-800 font-medium truncate">{children}</div>
        </div>
    );
}

export function LeadDetailPanel({ leadId, refreshKey, members, currentUserId, permissions, onChanged, onDeleted, onEdit, onConvert }: Props) {
    const [lead, setLead] = useState<LeadDetailDTO | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useAutoClearedStatus();
    const [note, setNote] = useState("");
    const [noteError, setNoteError] = useState<string | undefined>();
    const [addingNote, setAddingNote] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            setLead(await leadApi.get(leadId));
        } catch (caught) {
            setLoadError(caught instanceof Error ? caught.message : "Could not load this lead.");
        }
    }, [leadId]);

    // New lead selected: clear the old one so its data never shows under the new name.
    useEffect(() => {
        setLead(null);
        setNote("");
        setNoteError(undefined);
        setConfirmDelete(false);
        setStatus({ kind: null, message: "" });
    }, [leadId, setStatus]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const quickUpdate = async (patch: Partial<LeadInput>, success: string) => {
        if (!lead) return;
        setSaving(true);
        try {
            const updated = await leadApi.update(lead.id, patch);
            setLead((current) => (current ? { ...current, ...updated } : current));
            onChanged(updated);
            setStatus({ kind: "success", message: success });
        } catch (caught) {
            setStatus({ kind: "error", message: caught instanceof Error ? caught.message : "Could not save that change." });
        } finally {
            setSaving(false);
        }
    };

    const submitNote = async (event: FormEvent) => {
        event.preventDefault();
        if (!lead) return;
        if (!note.trim()) {
            setNoteError("Write something first");
            return;
        }

        setAddingNote(true);
        try {
            const created = await leadApi.addNote(lead.id, note);
            setLead((current) => (current ? { ...current, notes: [created, ...current.notes] } : current));
            setNote("");
            setStatus({ kind: "success", message: "Note added." });
        } catch (caught) {
            setNoteError(caught instanceof Error ? caught.message : "Could not add the note.");
        } finally {
            setAddingNote(false);
        }
    };

    const remove = async () => {
        if (!lead) return;
        setDeleting(true);
        try {
            await leadApi.remove(lead.id);
            onDeleted(lead.id);
        } catch (caught) {
            setStatus({ kind: "error", message: caught instanceof Error ? caught.message : "Could not delete the lead." });
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const shellClasses = "rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white overflow-hidden shadow-sm";

    if (loadError) {
        return (
            <div role="alert" className={cn(shellClasses, "p-6 flex flex-col items-center gap-2 text-center")}>
                <AlertCircle className="size-5 text-rose-500" aria-hidden="true" />
                <p className="text-[12px] font-semibold dark:text-slate-200 text-slate-700">Could not load this lead</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{loadError}</p>
                <SecondaryButton onClick={() => void load()}>Try again</SecondaryButton>
            </div>
        );
    }

    if (!lead) {
        return (
            <div className={cn(shellClasses, "p-4 space-y-3")} aria-busy="true" aria-label="Loading lead">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
                {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-7 w-full" />
                ))}
            </div>
        );
    }

    const converted = lead.status === "CONVERTED";
    const followUp = describeFollowUp(lead.nextFollowUpAt);
    const ownerOptions = [
        { value: "", label: "Unassigned" },
        ...members.map((member) => ({
            value: member.userId,
            label: member.userId === currentUserId ? `${member.name} (me)` : member.name,
        })),
    ];

    return (
        <div className={cn(shellClasses, "flex flex-col pb-4")}>
            {/* Header */}
            <div className="p-4 pb-3 border-b dark:border-white/[0.06] border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-[20px] rounded-full pointer-events-none" />
                <h2 className="text-[16px] font-bold dark:text-white text-slate-900 leading-tight mb-1 relative z-10 break-words">{lead.fullName}</h2>
                {lead.jobTitle || lead.companyName ? (
                    <span className="text-[9.5px] font-bold text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-[4px] bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 inline-block mb-3 relative z-10 max-w-full truncate">
                        {[lead.jobTitle, lead.companyName].filter(Boolean).join(" · ")}
                    </span>
                ) : (
                    <div className="mb-3" />
                )}

                <div className="flex flex-wrap items-center gap-1.5 relative z-10">
                    {permissions.canEdit ? (
                        <button
                            type="button"
                            onClick={() => onEdit(lead)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[9.5px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm"
                        >
                            <Pencil className="size-3" aria-hidden="true" /> Edit
                        </button>
                    ) : null}
                    {permissions.canEdit && !converted ? (
                        <button
                            type="button"
                            onClick={() => onConvert(lead)}
                            className="h-7 px-2.5 rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors shadow-sm"
                        >
                            Convert to Deal
                        </button>
                    ) : null}
                    {lead.email ? (
                        <a href={`mailto:${lead.email}`} aria-label={`Email ${lead.fullName}`} className="size-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shadow-sm">
                            <Mail className="size-3.5" aria-hidden="true" />
                        </a>
                    ) : null}
                    {lead.phone ? (
                        <a href={`tel:${lead.phone}`} aria-label={`Call ${lead.fullName}`} className="size-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shadow-sm">
                            <Phone className="size-3.5" aria-hidden="true" />
                        </a>
                    ) : null}
                </div>
                {converted && lead.deal ? (
                    <p className="mt-2 text-[10.5px] font-medium text-teal-700 dark:text-teal-400 relative z-10">
                        Converted to deal “{lead.deal.name}”.
                    </p>
                ) : null}
            </div>

            {/* Info grid, with inline edits for the fields changed most often */}
            <div className="p-4 flex flex-col gap-1.5 text-[10.5px] border-b dark:border-white/[0.06] border-slate-200 bg-slate-50/50 dark:bg-transparent">
                <Row label="Status">
                    {permissions.canEdit && !converted ? (
                        <select
                            aria-label="Status"
                            value={lead.status}
                            disabled={saving}
                            onChange={(event) => void quickUpdate({ status: event.target.value }, "Status updated.")}
                            className={INLINE_CONTROL_CLASSES}
                        >
                            {SELECTABLE_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    ) : (
                        <StatusBadge status={lead.status} />
                    )}
                </Row>
                <Row label="Owner">
                    {permissions.canEdit ? (
                        <select
                            aria-label="Owner"
                            value={lead.owner?.id ?? ""}
                            disabled={saving}
                            onChange={(event) => void quickUpdate({ ownerId: event.target.value || null }, "Owner updated.")}
                            className={INLINE_CONTROL_CLASSES}
                        >
                            {ownerOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    ) : (
                        lead.owner?.name ?? "Unassigned"
                    )}
                </Row>
                <Row label="Follow-up">
                    {permissions.canEdit ? (
                        <input
                            type="date"
                            aria-label="Next follow-up"
                            value={toDateInputValue(lead.nextFollowUpAt)}
                            disabled={saving}
                            onChange={(event) => void quickUpdate({ nextFollowUpAt: event.target.value }, event.target.value ? "Follow-up scheduled." : "Follow-up cleared.")}
                            className={cn(INLINE_CONTROL_CLASSES, followUp?.overdue && "text-rose-600 dark:text-rose-400")}
                        />
                    ) : (
                        <span className={followUp?.overdue ? "text-rose-600 dark:text-rose-400" : undefined}>{followUp?.label ?? "Not set"}</span>
                    )}
                </Row>
                <Row label="Email">{lead.email ?? <span className="text-slate-400">—</span>}</Row>
                <Row label="Phone">{lead.phone ?? <span className="text-slate-400">—</span>}</Row>
                <Row label="Source">{sourceLabel(lead.source)}</Row>

                <div className="mt-2 rounded-lg dark:bg-[#0B1220] bg-white border dark:border-white/[0.06] border-slate-200 p-3 flex flex-col gap-1.5 shadow-sm">
                    <div className="flex items-center justify-between text-[9.5px] font-bold dark:text-slate-500 text-slate-400 uppercase tracking-widest mb-1">
                        <span>Score</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{lead.score}%</span>
                    </div>
                    <div className="h-1 w-full dark:bg-[#16233A] bg-slate-100 rounded-full overflow-hidden flex mb-1">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${lead.score}%` }} />
                    </div>
                    <p className="text-[9px] dark:text-slate-400 text-slate-500 leading-tight font-medium">
                        Added {formatDateTime(lead.createdAt)} · updated {formatDateTime(lead.updatedAt)}
                    </p>
                </div>

                <div className="pt-1 min-h-[18px]">
                    <StatusMessage status={status} />
                </div>
            </div>

            {/* Notes timeline */}
            <div className="px-4 pt-3 flex flex-col gap-3">
                <h3 className="text-[10.5px] font-bold uppercase tracking-wide dark:text-white text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-indigo-500" aria-hidden="true" /> Notes
                </h3>

                {permissions.canNote ? (
                    <form onSubmit={submitNote} noValidate className="space-y-2">
                        <TextAreaField
                            label="Add a note"
                            name="note"
                            value={note}
                            onChange={(value) => { setNote(value); setNoteError(undefined); }}
                            placeholder="Call summary, next steps, objections…"
                            rows={3}
                            maxLength={2000}
                            error={noteError}
                        />
                        <div className="flex justify-end">
                            <PrimaryButton type="submit" loading={addingNote}>Add note</PrimaryButton>
                        </div>
                    </form>
                ) : null}

                {lead.notes.length === 0 ? (
                    <EmptyState icon={MessageSquare} title="No notes yet" description="Notes from calls and meetings will build a timeline here." />
                ) : (
                    <ol className="space-y-2">
                        {lead.notes.map((item) => (
                            <li key={item.id} className="rounded-lg border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white p-2.5">
                                <p className="text-[11px] dark:text-slate-200 text-slate-700 whitespace-pre-wrap break-words">{item.body}</p>
                                <p className="mt-1 text-[9.5px] text-slate-400 dark:text-slate-500">
                                    {item.author?.name ?? "Former member"} · {formatDateTime(item.createdAt)}
                                </p>
                            </li>
                        ))}
                    </ol>
                )}

                {permissions.canDelete ? (
                    <div className="pt-2 border-t dark:border-white/[0.06] border-slate-200 flex flex-wrap items-center justify-end gap-2">
                        {confirmDelete ? (
                            <>
                                <span className="text-[11px] text-slate-600 dark:text-slate-400 mr-auto">Delete this lead and its notes?</span>
                                <SecondaryButton onClick={() => setConfirmDelete(false)} disabled={deleting}>Keep</SecondaryButton>
                                <SecondaryButton tone="danger" onClick={() => void remove()} disabled={deleting}>
                                    {deleting ? "Deleting…" : "Delete"}
                                </SecondaryButton>
                            </>
                        ) : (
                            <SecondaryButton tone="danger" onClick={() => setConfirmDelete(true)}>
                                <Trash2 className="size-3.5" aria-hidden="true" /> Delete lead
                            </SecondaryButton>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
