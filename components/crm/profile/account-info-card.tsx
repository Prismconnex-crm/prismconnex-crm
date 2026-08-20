"use client";

import { AlertTriangle, BadgeCheck, HelpCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotSet, ReadOnlyField, SectionCard, formatDate, formatDateTime } from "./profile-ui";
import type { AccountView, ProfileView } from "./types";

/**
 * Account Information — entirely read-only.
 *
 * Nothing here is editable by design: the role comes from workspace
 * membership, the timestamps are recorded by the system, and verification is
 * owned by Supabase. Rendering them as inputs would imply an edit that no
 * endpoint accepts.
 */
export function AccountInfoCard({
    profile,
    account,
}: {
    profile: ProfileView;
    account: AccountView;
}) {
    const status = profile.accountStatus;

    return (
        <SectionCard
            id="account-information"
            title="Account Information"
            description="System-managed details about your account."
            icon={ShieldCheck}
        >
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField
                    label="Username"
                    value={
                        // No username has been set for any existing user, and
                        // the email local-part is what every other surface in
                        // this app falls back to, so it is shown as the derived
                        // value rather than an empty row.
                        profile.username ?? (
                            <span className="text-slate-500 dark:text-slate-400">
                                {profile.email.split("@")[0]}{" "}
                                <span className="text-[11px]">(from email)</span>
                            </span>
                        )
                    }
                />

                <ReadOnlyField
                    label="Account Status"
                    value={
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                                status === "active"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : status === "inactive"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                            )}
                        >
                            {status}
                        </span>
                    }
                />

                <ReadOnlyField label="User Role" value={account.role ?? <NotSet />} />

                <ReadOnlyField label="Member Since" value={formatDate(profile.createdAt)} />

                <ReadOnlyField
                    label="Last Login"
                    value={
                        profile.lastLoginAt ? (
                            formatDateTime(profile.lastLoginAt)
                        ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                                Not recorded yet
                            </span>
                        )
                    }
                />

                <ReadOnlyField
                    label="Email Verification"
                    value={
                        account.emailVerified === true ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <BadgeCheck className="size-3.5" aria-hidden="true" />
                                Verified
                            </span>
                        ) : account.emailVerified === false ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="size-3.5" aria-hidden="true" />
                                Not verified
                            </span>
                        ) : (
                            // Genuinely unknown — see readEmailVerified in the
                            // API route. Better than a tick we cannot back up.
                            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                <HelpCircle className="size-3.5" aria-hidden="true" />
                                Unknown
                            </span>
                        )
                    }
                />

                <ReadOnlyField label="User ID" value={profile.id} mono />

                <ReadOnlyField
                    label="Workspace ID"
                    value={account.workspaceId ?? <NotSet />}
                    mono={Boolean(account.workspaceId)}
                />

                <ReadOnlyField label="Profile Updated" value={formatDateTime(profile.updatedAt)} />
            </dl>

            {profile.accountStatus === "inactive" ? (
                <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    This account is deactivated. Reactivate it from Account Actions below.
                </p>
            ) : null}
        </SectionCard>
    );
}
