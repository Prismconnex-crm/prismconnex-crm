"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
    Field,
    NO_STATUS,
    PrimaryButton,
    ReadOnlyField,
    SecondaryButton,
    StatusMessage,
    type Status,
} from "@/components/crm/profile/profile-ui";
import type { LeadDTO } from "@/models/lead";
import { leadApi } from "./lead-api";

type Props = {
    lead: LeadDTO | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConverted: (deal: { id: string; name: string }) => void;
};

/** Turns a lead into a Deal (stage DISCOVERY) and marks the lead Converted, in one transaction. */
export function LeadConvertDialog({ lead, open, onOpenChange, onConverted }: Props) {
    const [dealName, setDealName] = useState("");
    const [amount, setAmount] = useState("0");
    const [nameError, setNameError] = useState<string | undefined>();
    const [amountError, setAmountError] = useState<string | undefined>();
    const [status, setStatus] = useState<Status>(NO_STATUS);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !lead) return;
        setDealName(lead.companyName ? `${lead.companyName} — ${lead.fullName}` : lead.fullName);
        setAmount("0");
        setNameError(undefined);
        setAmountError(undefined);
        setStatus(NO_STATUS);
    }, [open, lead]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!lead) return;

        const parsedAmount = Number(amount);
        const badName = dealName.trim() ? undefined : "Deal name is required";
        const badAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? undefined : "Enter an amount of 0 or more";
        setNameError(badName);
        setAmountError(badAmount);
        if (badName || badAmount) return;

        setSaving(true);
        setStatus(NO_STATUS);
        try {
            const deal = await leadApi.convert(lead.id, { dealName: dealName.trim(), amount: parsedAmount });
            onConverted(deal);
            onOpenChange(false);
        } catch (caught) {
            setStatus({ kind: "error", message: caught instanceof Error ? caught.message : "Could not convert the lead." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 dark:bg-[#070B14] bg-white border dark:border-white/[0.06] border-slate-200 rounded-xl">
                <DialogTitle className="text-[14px] font-bold tracking-tight dark:text-white text-slate-900 flex items-center gap-2 pr-10">
                    <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" /> Convert Lead to Deal
                </DialogTitle>
                <DialogDescription className="text-[12px] text-slate-500 dark:text-slate-400">
                    Creates a deal in the Discovery stage and marks this lead as Converted. This cannot be undone.
                </DialogDescription>

                {lead ? (
                    <form onSubmit={submit} noValidate className="mt-4 space-y-4">
                        <dl className="grid gap-3 sm:grid-cols-2">
                            <ReadOnlyField label="Lead" value={lead.fullName} />
                            <ReadOnlyField label="Company" value={lead.companyName ?? "—"} />
                        </dl>
                        <Field label="Deal name" name="dealName" value={dealName} onChange={(v) => { setDealName(v); setNameError(undefined); }} error={nameError} required maxLength={160} />
                        <Field label="Amount" name="amount" type="number" inputMode="numeric" value={amount} onChange={(v) => { setAmount(v); setAmountError(undefined); }} error={amountError} hint="Estimated deal value. Costs can be added on the deal later." />

                        <StatusMessage status={status} />

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>Cancel</SecondaryButton>
                            <PrimaryButton type="submit" loading={saving} className="bg-emerald-600 hover:bg-emerald-500">
                                Create Deal
                            </PrimaryButton>
                        </div>
                    </form>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
