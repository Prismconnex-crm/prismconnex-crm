"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { readJsonResponse, type ApiErrorBody } from "@/lib/http/read-json";
import {
    PrimaryButton,
    SecondaryButton,
    SectionCard,
    StatusMessage,
    useAutoClearedStatus,
} from "./profile-ui";
import type { ProfileView } from "./types";

/**
 * Notification Settings.
 *
 * Two groups, because the toggles answer different questions: CHANNELS are
 * "how should we reach you", EVENTS are "what is worth reaching you about".
 * Presenting eight switches as one flat list makes it look as though turning
 * off Email would be independent of turning off New Leads.
 */

type ToggleKey =
    | "notifyEmail"
    | "notifySms"
    | "notifyPush"
    | "notifyNewLead"
    | "notifyNewCustomer"
    | "notifyDeal"
    | "notifyTask"
    | "notifySystem";

const CHANNELS: { key: ToggleKey; label: string; description: string }[] = [
    { key: "notifyEmail", label: "Email", description: "Updates sent to your inbox" },
    { key: "notifySms", label: "SMS", description: "Text messages to your mobile" },
    { key: "notifyPush", label: "Push", description: "Browser and mobile push alerts" },
];

const EVENTS: { key: ToggleKey; label: string; description: string }[] = [
    { key: "notifyNewLead", label: "New leads", description: "A lead is created or assigned" },
    {
        key: "notifyNewCustomer",
        label: "New customers",
        description: "A contact converts to a customer",
    },
    { key: "notifyDeal", label: "Deals", description: "Stage changes and closures" },
    { key: "notifyTask", label: "Tasks", description: "Assignments and due dates" },
    { key: "notifySystem", label: "System", description: "Security and product announcements" },
];

type FormState = Record<ToggleKey, boolean>;

function toFormState(profile: ProfileView): FormState {
    return {
        notifyEmail: profile.notifyEmail,
        notifySms: profile.notifySms,
        notifyPush: profile.notifyPush,
        notifyNewLead: profile.notifyNewLead,
        notifyNewCustomer: profile.notifyNewCustomer,
        notifyDeal: profile.notifyDeal,
        notifyTask: profile.notifyTask,
        notifySystem: profile.notifySystem,
    };
}

function ToggleRow({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
                    {label}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{description}</p>
            </div>
            {/* aria-label rather than a wrapping <label>: the Radix Switch is a
                button, and the visible text sits in its own block above. */}
            <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
        </div>
    );
}

export function NotificationsCard({
    profile,
    onProfileChange,
}: {
    profile: ProfileView;
    onProfileChange: (profile: ProfileView) => void;
}) {
    const [form, setForm] = useState<FormState>(() => toFormState(profile));
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useAutoClearedStatus();

    useEffect(() => setForm(toFormState(profile)), [profile]);

    const dirty = (Object.keys(form) as ToggleKey[]).some((key) => form[key] !== profile[key]);

    const set = (key: ToggleKey) => (value: boolean) =>
        setForm((previous) => ({ ...previous, [key]: value }));

    const save = async () => {
        setSaving(true);
        setStatus({ kind: null, message: "" });

        try {
            const res = await fetch("/api/profile/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await readJsonResponse<
                ApiErrorBody & { profile?: ProfileView; message?: string }
            >(res);

            if (!res.ok || !data?.profile) {
                throw new Error(data?.error?.message ?? "Could not save your settings.");
            }

            onProfileChange(data.profile);
            setStatus({
                kind: "success",
                message: data.message ?? "Notification settings updated.",
            });
        } catch (error) {
            setStatus({
                kind: "error",
                message: error instanceof Error ? error.message : "Could not save your settings.",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <SectionCard
            id="notification-settings"
            title="Notification Settings"
            description="Choose how and when Prismconnex contacts you."
            icon={Bell}
        >
            {/*
                Said plainly rather than buried: no delivery pipeline exists in
                this codebase yet, so these record a preference for when one
                does. A toggle that silently does nothing is worse than an
                absent one, and worse still if the user believes it armed an
                alert they are now relying on.
            */}
            <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
                These preferences are saved to your profile. Delivery is not yet wired up in this
                build — nothing is sent on any channel today.
            </p>

            <div className="grid gap-x-8 sm:grid-cols-2">
                <fieldset>
                    <legend className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Channels
                    </legend>
                    <div className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                        {CHANNELS.map((item) => (
                            <ToggleRow
                                key={item.key}
                                label={item.label}
                                description={item.description}
                                checked={form[item.key]}
                                onChange={set(item.key)}
                            />
                        ))}
                    </div>
                </fieldset>

                <fieldset className="mt-4 sm:mt-0">
                    <legend className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Events
                    </legend>
                    <div className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                        {EVENTS.map((item) => (
                            <ToggleRow
                                key={item.key}
                                label={item.label}
                                description={item.description}
                                checked={form[item.key]}
                                onChange={set(item.key)}
                            />
                        ))}
                    </div>
                </fieldset>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <PrimaryButton onClick={save} loading={saving} disabled={!dirty}>
                    Save Changes
                </PrimaryButton>
                <SecondaryButton
                    onClick={() => setForm(toFormState(profile))}
                    disabled={saving || !dirty}
                >
                    Cancel
                </SecondaryButton>
                <div className="ml-auto">
                    <StatusMessage status={status} />
                </div>
            </div>
        </SectionCard>
    );
}
