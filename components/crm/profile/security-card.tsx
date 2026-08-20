"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChangePasswordSchema, scorePassword } from "@/models/profile";
import { readJsonResponse, type ApiErrorBody } from "@/lib/http/read-json";
import {
    PrimaryButton,
    SectionCard,
    StatusMessage,
    useAutoClearedStatus,
} from "./profile-ui";
import type { AccountView } from "./types";

/**
 * Security: changing the account password.
 *
 * This card used to also carry two-factor enrolment and an active-sessions
 * panel; both were removed from the Profile page by request. Their API routes
 * (/api/profile/mfa, /api/profile/mfa/verify, /api/profile/sessions) are left
 * in place and still work — sign-in's MFA challenge depends on the same
 * Supabase factors — so this is a UI removal, not a capability removal.
 *
 * Nothing here trusts client state for authorization: the change is a server
 * call that re-derives the user from the session cookie. The component only
 * decides what to *offer*, and disables what cannot work (no Supabase token)
 * with a reason rather than letting the user click into a 401.
 */

function PasswordInput({
    id,
    label,
    value,
    onChange,
    autoComplete,
    error,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    autoComplete: string;
    error?: string;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <label
                htmlFor={id}
                className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300"
            >
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={visible ? "text" : "password"}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete={autoComplete}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={cn(
                        "h-9 w-full rounded-lg border border-slate-300 bg-white pl-2.5 pr-9 text-[13px] text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-[#22304A] dark:bg-[#0F1729] dark:text-white",
                        error && "border-red-400 dark:border-red-500/60"
                    )}
                />
                <button
                    type="button"
                    onClick={() => setVisible((previous) => !previous)}
                    // The label changes with state so a screen reader announces
                    // what the button will DO, not what is currently showing.
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                >
                    {visible ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                        <Eye className="size-4" aria-hidden="true" />
                    )}
                </button>
            </div>
            {error ? (
                <p
                    id={`${id}-error`}
                    className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}

/** Advisory meter — see scorePassword for why it never blocks submission. */
function StrengthMeter({ password }: { password: string }) {
    if (!password) return null;

    const { score, label, suggestions } = scorePassword(password);
    const colors = [
        "bg-red-500",
        "bg-orange-500",
        "bg-amber-500",
        "bg-emerald-500",
        "bg-emerald-600",
    ];

    return (
        <div className="mt-1.5">
            <div className="flex items-center gap-1.5">
                <div
                    className="flex h-1 flex-1 gap-1"
                    // The bar is decorative; the text beside it carries the
                    // same information for anyone who cannot see colour.
                    aria-hidden="true"
                >
                    {[0, 1, 2, 3, 4].map((index) => (
                        <span
                            key={index}
                            className={cn(
                                "h-full flex-1 rounded-full transition-colors",
                                index <= score
                                    ? colors[score]
                                    : "bg-slate-200 dark:bg-white/[0.08]"
                            )}
                        />
                    ))}
                </div>
                <span
                    role="status"
                    aria-live="polite"
                    className="w-20 shrink-0 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-400"
                >
                    {label}
                </span>
            </div>
            {suggestions.length ? (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {suggestions.join(" · ")}
                </p>
            ) : null}
        </div>
    );
}

export function SecurityCard({ account }: { account: AccountView }) {
    const disabled = !account.hasSupabaseSession;

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
    const [pwSaving, setPwSaving] = useState(false);
    const [pwStatus, setPwStatus] = useAutoClearedStatus();

    const changePassword = async (event: React.FormEvent) => {
        event.preventDefault();
        setPwErrors({});

        const parsed = ChangePasswordSchema.safeParse({
            currentPassword,
            newPassword,
            confirmPassword,
        });

        if (!parsed.success) {
            const errors: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path[0];
                if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
            }
            setPwErrors(errors);
            return;
        }

        setPwSaving(true);
        setPwStatus({ kind: null, message: "" });

        try {
            const res = await fetch("/api/profile/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
            });

            const data = await readJsonResponse<ApiErrorBody & { message?: string }>(res);
            if (!res.ok) {
                throw new Error(data?.error?.message ?? "Could not change your password.");
            }

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPwStatus({ kind: "success", message: data?.message ?? "Password changed." });
        } catch (error) {
            setPwStatus({
                kind: "error",
                message:
                    error instanceof Error ? error.message : "Could not change your password.",
            });
        } finally {
            setPwSaving(false);
        }
    };

    return (
        <SectionCard
            id="security"
            title="Security"
            description="Change the password used to sign in."
            icon={Lock}
        >
            {disabled ? (
                <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    Your session has no Supabase credentials attached, so password changes are
                    unavailable. Sign out and sign in again with your email and password to
                    enable them.
                </p>
            ) : null}

            <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900 dark:text-white">
                    <KeyRound className="size-3.5 text-slate-500" aria-hidden="true" />
                    Change Password
                </h3>

                <form onSubmit={changePassword} noValidate className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <PasswordInput
                            id="current-password"
                            label="Current Password"
                            value={currentPassword}
                            onChange={setCurrentPassword}
                            autoComplete="current-password"
                            error={pwErrors.currentPassword}
                        />
                        <div>
                            <PasswordInput
                                id="new-password"
                                label="New Password"
                                value={newPassword}
                                onChange={setNewPassword}
                                autoComplete="new-password"
                                error={pwErrors.newPassword}
                            />
                            <StrengthMeter password={newPassword} />
                        </div>
                        <PasswordInput
                            id="confirm-password"
                            label="Confirm New Password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            autoComplete="new-password"
                            error={pwErrors.confirmPassword}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <PrimaryButton type="submit" loading={pwSaving} disabled={disabled}>
                            Update Password
                        </PrimaryButton>
                        <div className="ml-auto">
                            <StatusMessage status={pwStatus} />
                        </div>
                    </div>
                </form>
            </div>
        </SectionCard>
    );
}
