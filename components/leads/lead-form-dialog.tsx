"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
    Field,
    NO_STATUS,
    PrimaryButton,
    SecondaryButton,
    SelectField,
    StatusMessage,
    type Status,
} from "@/components/crm/profile/profile-ui";
import type { LeadDTO } from "@/models/lead";
import type { WorkspaceMemberDTO } from "@/models/workspace-member";
import { SELECTABLE_STATUS_OPTIONS, SOURCE_OPTIONS, toDateInputValue } from "@/lib/leads/presentation";
import { leadApi, type LeadInput } from "./lead-api";

type FieldErrors = Partial<Record<keyof LeadInput, string>>;

const UNASSIGNED = "";

function initialValues(lead: LeadDTO | null, currentUserId: string | null): LeadInput {
    return {
        fullName: lead?.fullName ?? "",
        email: lead?.email ?? "",
        phone: lead?.phone ?? "",
        jobTitle: lead?.jobTitle ?? "",
        companyName: lead?.companyName ?? "",
        source: lead?.source ?? "MANUAL",
        status: lead?.status ?? "NEW",
        score: lead?.score ?? 0,
        // A new lead defaults to the person creating it, matching the API.
        ownerId: lead ? lead.owner?.id ?? null : currentUserId,
        nextFollowUpAt: toDateInputValue(lead?.nextFollowUpAt ?? null),
    };
}

/** The same checks the API makes, so the common mistakes never round-trip. */
function validate(values: LeadInput): FieldErrors {
    const errors: FieldErrors = {};
    if (!values.fullName.trim()) errors.fullName = "Name is required";
    if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        errors.email = "Enter a valid email address";
    }
    if (!Number.isInteger(values.score) || values.score < 0 || values.score > 100) {
        errors.score = "Score must be a whole number from 0 to 100";
    }
    return errors;
}

/**
 * validateBody() reports "field: message" for the first bad field; route that
 * onto the field itself rather than a generic line under the form.
 */
function fieldErrorFrom(message: string, values: LeadInput): FieldErrors | null {
    const match = /^(\w+): (.+)$/.exec(message);
    if (match && match[1] in values) return { [match[1]]: match[2] } as FieldErrors;
    return null;
}

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null = create a new lead */
    lead: LeadDTO | null;
    members: WorkspaceMemberDTO[];
    currentUserId: string | null;
    onSaved: (lead: LeadDTO, mode: "create" | "edit") => void;
};

export function LeadFormDialog({ open, onOpenChange, lead, members, currentUserId, onSaved }: Props) {
    const mode = lead ? "edit" : "create";
    const [values, setValues] = useState<LeadInput>(() => initialValues(lead, currentUserId));
    const [errors, setErrors] = useState<FieldErrors>({});
    const [status, setStatus] = useState<Status>(NO_STATUS);
    const [saving, setSaving] = useState(false);

    // Reset every time the dialog opens, so a cancelled edit leaves no residue.
    useEffect(() => {
        if (!open) return;
        setValues(initialValues(lead, currentUserId));
        setErrors({});
        setStatus(NO_STATUS);
    }, [open, lead, currentUserId]);

    const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) => {
        setValues((current) => ({ ...current, [key]: value }));
        if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        const found = validate(values);
        setErrors(found);
        if (Object.keys(found).length > 0) return;

        setSaving(true);
        setStatus(NO_STATUS);
        try {
            const saved = lead ? await leadApi.update(lead.id, values) : await leadApi.create(values);
            onSaved(saved, mode);
            onOpenChange(false);
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : "Could not save the lead.";
            const fieldError = fieldErrorFrom(message, values);
            if (fieldError) setErrors(fieldError);
            else setStatus({ kind: "error", message });
        } finally {
            setSaving(false);
        }
    };

    const ownerOptions = [
        { value: UNASSIGNED, label: "Unassigned" },
        ...members.map((member) => ({
            value: member.userId,
            label: member.userId === currentUserId ? `${member.name} (me)` : member.name,
        })),
    ];

    // A converted lead's status is fixed; offering the select would only
    // produce an error from the API.
    const statusLocked = lead?.status === "CONVERTED";

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 dark:bg-[#070B14] bg-white border dark:border-white/[0.06] border-slate-200 rounded-xl">
                <DialogTitle className="text-[14px] font-bold tracking-tight dark:text-white text-slate-900 pr-10">
                    {mode === "create" ? "Add lead" : `Edit ${lead?.fullName}`}
                </DialogTitle>
                <DialogDescription className="text-[12px] text-slate-500 dark:text-slate-400">
                    {mode === "create" ? "Only the name is required — fill in the rest as you learn it." : "Changes are saved to the lead and recorded in the audit log."}
                </DialogDescription>

                <form onSubmit={submit} noValidate className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Full name" name="fullName" value={values.fullName} onChange={(v) => set("fullName", v)} error={errors.fullName} required maxLength={120} autoComplete="off" />
                        <Field label="Company" name="companyName" value={values.companyName} onChange={(v) => set("companyName", v)} error={errors.companyName} maxLength={160} autoComplete="off" />
                        <Field label="Email" name="email" type="email" value={values.email} onChange={(v) => set("email", v)} error={errors.email} inputMode="email" maxLength={254} autoComplete="off" />
                        <Field label="Phone" name="phone" type="tel" value={values.phone} onChange={(v) => set("phone", v)} error={errors.phone} inputMode="tel" maxLength={40} autoComplete="off" />
                        <Field label="Job title" name="jobTitle" value={values.jobTitle} onChange={(v) => set("jobTitle", v)} error={errors.jobTitle} maxLength={120} autoComplete="off" />
                        <SelectField label="Source" value={values.source} onChange={(v) => set("source", v)} options={SOURCE_OPTIONS} />
                        {statusLocked ? (
                            <SelectField label="Status" value="CONVERTED" onChange={() => undefined} options={[{ value: "CONVERTED", label: "Converted" }]} disabled hint="Fixed once a lead is converted to a deal." />
                        ) : (
                            <SelectField label="Status" value={values.status} onChange={(v) => set("status", v)} options={SELECTABLE_STATUS_OPTIONS} />
                        )}
                        <SelectField label="Owner" value={values.ownerId ?? UNASSIGNED} onChange={(v) => set("ownerId", v === UNASSIGNED ? null : v)} options={ownerOptions} />
                        <Field label="Next follow-up" name="nextFollowUpAt" type="date" value={values.nextFollowUpAt} onChange={(v) => set("nextFollowUpAt", v)} error={errors.nextFollowUpAt} />
                        <Field
                            label="Score (0–100)"
                            name="score"
                            type="number"
                            inputMode="numeric"
                            value={String(values.score)}
                            onChange={(v) => set("score", v === "" ? 0 : Number(v))}
                            error={errors.score}
                        />
                    </div>

                    <StatusMessage status={status} />

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>Cancel</SecondaryButton>
                        <PrimaryButton type="submit" loading={saving}>
                            {mode === "create" ? "Add lead" : "Save changes"}
                        </PrimaryButton>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
