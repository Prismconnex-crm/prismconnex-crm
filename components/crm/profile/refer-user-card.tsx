"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Mail, UserPlus } from "lucide-react";

import { readJsonResponse } from "@/lib/http/read-json";
import type { ReferralDTO } from "@/models/billing";
import {
    Field,
    PrimaryButton,
    SecondaryButton,
    SectionCard,
    StatusMessage,
    formatDate,
    useAutoClearedStatus,
} from "./profile-ui";

/**
 * Refer a New User.
 *
 * The app has no mail transport and no Supabase service_role key, so nothing is
 * emailed from here. Saying "invitation sent" would be a straightforward lie,
 * so the card instead creates a real Referral row and hands back its link for
 * the user to send — copy to clipboard, or open in their own mail client.
 * The wording on the card matches what actually happens.
 */
export function ReferUserCard() {
    const [email, setEmail] = useState("");
    const [fieldError, setFieldError] = useState("");
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useAutoClearedStatus();
    const [referrals, setReferrals] = useState<ReferralDTO[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const res = await fetch("/api/profile/referrals");
                const data = await readJsonResponse<{ referrals?: ReferralDTO[] }>(res);
                if (!cancelled && res.ok && data?.referrals) setReferrals(data.referrals);
            } catch {
                // Non-fatal: the list simply stays empty.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setFieldError("");

        const trimmed = email.trim();
        if (!trimmed) {
            setFieldError("Enter an email address");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/profile/referrals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmed }),
            });
            const data = await readJsonResponse<{
                referral?: ReferralDTO;
                message?: string;
                error?: { message?: string };
            }>(res);

            if (!res.ok || !data?.referral) {
                const message = data?.error?.message ?? "We could not create that invitation.";
                // A validation failure is about the field, so it belongs on the
                // field; anything else is about the request.
                if (res.status === 400) setFieldError(message.replace(/^email:\s*/, ""));
                else setStatus({ kind: "error", message });
                return;
            }

            // Replace any existing entry for the same address: the API upserts,
            // so a re-invite must not appear twice in the list.
            setReferrals((current) => [
                data.referral as ReferralDTO,
                ...current.filter((item) => item.email !== data.referral?.email),
            ]);
            setEmail("");
            setStatus({
                kind: "success",
                message: data.message ?? "Invitation created.",
            });
        } catch {
            setStatus({ kind: "error", message: "We could not create that invitation." });
        } finally {
            setSaving(false);
        }
    };

    const copyLink = async (referral: ReferralDTO) => {
        try {
            await navigator.clipboard.writeText(referral.inviteUrl);
            setCopiedId(referral.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            setStatus({
                kind: "error",
                message: "Your browser blocked clipboard access. Select the link and copy it.",
            });
        }
    };

    return (
        <SectionCard
            id="refer"
            title="Refer a New User"
            description="Invite a colleague to this workspace."
            icon={UserPlus}
        >
            <form onSubmit={submit} noValidate className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field
                        label="Email address"
                        name="referralEmail"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="colleague@company.com"
                        autoComplete="email"
                        error={fieldError}
                        hint="We create a personal invite link for this address."
                    />
                    <PrimaryButton type="submit" loading={saving} className="h-9 sm:mb-[22px]">
                        Create invite
                    </PrimaryButton>
                </div>

                <StatusMessage status={status} />
            </form>

            {/*
                Stated plainly rather than buried: the user is about to tell
                somebody they have been invited, and needs to know the app did
                not contact them.
            */}
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
                No email is sent automatically — this workspace has no mail provider connected.
                Copy the link below and send it yourself.
            </p>

            {referrals.length > 0 ? (
                <div className="mt-4">
                    <h3 className="mb-2 text-[12px] font-bold text-slate-900 dark:text-white">
                        Invitations
                    </h3>
                    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-white/[0.06] dark:border-white/[0.06]">
                        {referrals.map((referral) => (
                            <li key={referral.id} className="px-3 py-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
                                            {referral.email}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                            {referral.status === "ACCEPTED"
                                                ? `Joined ${formatDate(referral.acceptedAt)}`
                                                : `Invited ${formatDate(referral.createdAt)} · Pending`}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <SecondaryButton onClick={() => void copyLink(referral)}>
                                            {copiedId === referral.id ? (
                                                <>
                                                    <Check
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                    Copied
                                                </>
                                            ) : (
                                                <>
                                                    <Copy
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                    Copy link
                                                </>
                                            )}
                                        </SecondaryButton>
                                        <a
                                            href={`mailto:${referral.email}?subject=${encodeURIComponent(
                                                "Join me on Prismconnex"
                                            )}&body=${encodeURIComponent(
                                                `Hi,\n\nJoin my Prismconnex workspace:\n${referral.inviteUrl}\n`
                                            )}`}
                                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                                        >
                                            <Mail className="size-3.5" aria-hidden="true" />
                                            Email
                                        </a>
                                    </div>
                                </div>

                                {/*
                                    `break-all` because an invite token is a
                                    43-character unbroken string, which would
                                    otherwise push the card wider than the
                                    viewport on a phone.
                                */}
                                <p className="mt-1.5 break-all font-mono text-[11px] text-slate-500 dark:text-slate-500">
                                    {referral.inviteUrl}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </SectionCard>
    );
}
