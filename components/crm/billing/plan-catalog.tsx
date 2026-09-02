"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { readJsonResponse } from "@/lib/http/read-json";
import {
    PrimaryButton,
    SecondaryButton,
    StatusMessage,
    useAutoClearedStatus,
} from "../profile/profile-ui";
import type { PlanWithCurrent } from "./use-credit-overview";

/**
 * The plan comparison grid, shared by /app/billing and /app/upgrade-plan.
 *
 * ── What "upgrade" does here ──
 * No payment provider is connected, so choosing a plan cannot charge anyone or
 * grant a larger allowance. The button records the request in the audit trail
 * and says so. Flipping WorkspaceCredit.plan on a click would hand out paid
 * credit volume for free, which is a billing bug wearing a feature's clothes.
 *
 * It lives here rather than inside either page so the two cannot disagree about
 * what a plan costs or what pressing the button actually did.
 */
export function PlanCard({
    plan,
    current,
    onChoose,
    pending,
}: {
    plan: PlanWithCurrent;
    current: boolean;
    onChoose: () => void;
    pending: boolean;
}) {
    return (
        <div
            className={cn(
                "flex flex-col rounded-xl border p-4 transition-colors",
                current
                    ? "border-brand/40 bg-brand/[0.04] dark:border-brand-hover/40 dark:bg-brand-hover/[0.06]"
                    : "border-slate-200 bg-white/60 dark:border-white/[0.06] dark:bg-white/[0.02]"
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
                    {plan.name}
                </h3>
                {current ? (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-brand-hover">
                        Current
                    </span>
                ) : null}
            </div>

            <p className="mt-1">
                <span className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
                    {plan.price}
                </span>
                <span className="text-[12px] text-slate-500 dark:text-slate-400">
                    {plan.period}
                </span>
            </p>

            <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-400">
                {plan.description}
            </p>

            <ul className="mt-3 flex-1 space-y-1.5">
                {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5 text-[12px]">
                        <Check
                            className="mt-0.5 size-3.5 shrink-0 text-brand dark:text-brand-hover"
                            aria-hidden="true"
                        />
                        <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-4">
                {current ? (
                    <SecondaryButton disabled className="w-full">
                        Your plan
                    </SecondaryButton>
                ) : (
                    <PrimaryButton onClick={onChoose} loading={pending} className="w-full">
                        Request {plan.name}
                    </PrimaryButton>
                )}
            </div>
        </div>
    );
}

export function PlanCatalog({
    plans,
    currentPlan,
}: {
    plans: PlanWithCurrent[];
    /** Plan key the workspace is on, or null when the session has no workspace. */
    currentPlan: string | null;
}) {
    const [pendingPlan, setPendingPlan] = useState<string | null>(null);
    const [status, setStatus] = useAutoClearedStatus(8000);

    const choose = async (planKey: string) => {
        setPendingPlan(planKey);
        try {
            const res = await fetch("/api/billing/plan-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan: planKey }),
            });
            const data = await readJsonResponse<{
                message?: string;
                error?: { message?: string };
            }>(res);

            setStatus(
                res.ok
                    ? { kind: "success", message: data?.message ?? "Request recorded." }
                    : {
                          kind: "error",
                          message: data?.error?.message ?? "We could not record that request.",
                      }
            );
        } catch {
            setStatus({ kind: "error", message: "We could not record that request." });
        } finally {
            setPendingPlan(null);
        }
    };

    return (
        <>
            {/* One column on phones, three from md up — the cards carry a price
                and a feature list, which stop being readable much below that. */}
            <div className="grid gap-3 md:grid-cols-3">
                {plans.map((plan) => (
                    <PlanCard
                        key={plan.key}
                        plan={plan}
                        current={Boolean(plan.current ?? (currentPlan && plan.key === currentPlan))}
                        pending={pendingPlan === plan.key}
                        onChoose={() => void choose(plan.key)}
                    />
                ))}
            </div>

            <div className="mt-3">
                <StatusMessage status={status} />
            </div>

            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
                No payment provider is connected to this workspace. Requesting a plan records it
                in the audit log for an admin to action; your allowance does not change until
                they do.
            </p>
        </>
    );
}
