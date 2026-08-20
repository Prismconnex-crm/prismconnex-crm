"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Gauge, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { readJsonResponse } from "@/lib/http/read-json";
import { PLANS, type CreditUsageDTO, type PlanDefinition } from "@/models/billing";
import {
    CardSkeleton,
    PrimaryButton,
    SecondaryButton,
    SectionCard,
    StatusMessage,
    formatDate,
    useAutoClearedStatus,
} from "./profile/profile-ui";

/**
 * /app/billing — plan comparison and the current credit position.
 *
 * Reached from the Profile page's Upgrade Plan card. It reuses the Profile
 * page's card primitives rather than introducing a second visual language for
 * what is effectively another settings screen.
 *
 * ── What "upgrade" does here ──
 * No payment provider is connected, so choosing a plan cannot charge anyone or
 * grant a larger allowance. The button records the request in the audit trail
 * and says so. Flipping WorkspaceCredit.plan on a click would hand out paid
 * credit volume for free, which is a billing bug wearing a feature's clothes.
 */
type PlanWithCurrent = PlanDefinition & { current?: boolean };

function PlanCard({
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

export function BillingSection() {
    const [usage, setUsage] = useState<CreditUsageDTO | null>(null);
    const [plans, setPlans] = useState<PlanWithCurrent[]>([...PLANS]);
    const [loading, setLoading] = useState(true);
    const [pendingPlan, setPendingPlan] = useState<string | null>(null);
    const [status, setStatus] = useAutoClearedStatus(8000);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const res = await fetch("/api/profile/credits");
                const data = await readJsonResponse<{
                    usage?: CreditUsageDTO | null;
                    plans?: PlanWithCurrent[];
                }>(res);

                if (cancelled || !res.ok || !data) return;

                setUsage(data.usage ?? null);
                if (data.plans?.length) setPlans(data.plans);
            } catch {
                // The catalogue still renders from the static PLANS fallback.
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

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

    const formatter = new Intl.NumberFormat("en-GB");

    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-3 pb-10">
            <div className="flex items-center gap-2">
                <Link
                    href="/app/profile"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Back to Profile
                </Link>
            </div>

            {loading ? (
                <CardSkeleton rows={2} />
            ) : (
                <SectionCard
                    title="Current plan"
                    description={
                        usage
                            ? `Period ${formatDate(usage.periodStart)} — ${formatDate(usage.periodEnd)}`
                            : "This session has no workspace, so there is no plan to show."
                    }
                    icon={Gauge}
                >
                    {usage ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.06]">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Plan
                                </p>
                                <p className="mt-1 text-[18px] font-bold text-slate-900 dark:text-white">
                                    {usage.planName}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.06]">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Credits used
                                </p>
                                <p className="mt-1 text-[18px] font-bold tabular-nums text-slate-900 dark:text-white">
                                    {formatter.format(usage.used)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.06]">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Remaining
                                </p>
                                <p className="mt-1 text-[18px] font-bold tabular-nums text-brand dark:text-brand-hover">
                                    {formatter.format(usage.remaining)}
                                </p>
                            </div>
                        </div>
                    ) : null}
                </SectionCard>
            )}

            <SectionCard
                title="Plans"
                description="Choosing a plan records a request — no payment is taken."
                icon={Sparkles}
            >
                <div className="grid gap-3 md:grid-cols-3">
                    {plans.map((plan) => (
                        <PlanCard
                            key={plan.key}
                            plan={plan}
                            current={Boolean(plan.current ?? (usage && plan.key === usage.plan))}
                            pending={pendingPlan === plan.key}
                            onChoose={() => void choose(plan.key)}
                        />
                    ))}
                </div>

                <div className="mt-3">
                    <StatusMessage status={status} />
                </div>

                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
                    No payment provider is connected to this workspace. Requesting a plan records
                    it in the audit log for an admin to action; your allowance does not change
                    until they do.
                </p>
            </SectionCard>
        </div>
    );
}
