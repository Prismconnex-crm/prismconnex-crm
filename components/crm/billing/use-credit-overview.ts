"use client";

import { useEffect, useState } from "react";

import { readJsonResponse } from "@/lib/http/read-json";
import { PLANS, type CreditUsageDTO, type PlanDefinition } from "@/models/billing";

/** A plan row as the API returns it — the catalogue plus which one is current. */
export type PlanWithCurrent = PlanDefinition & { current?: boolean };

export type CreditOverview = {
    usage: CreditUsageDTO | null;
    plans: PlanWithCurrent[];
    loading: boolean;
};

/**
 * Reads /api/profile/credits once per mount.
 *
 * Three screens now show the same workspace credit position — the Profile
 * page's two cards, /app/upgrade-plan and /app/credit-usage — and each of them
 * previously would have carried its own copy of this effect. Keeping the fetch
 * here means they cannot drift on how a 200-with-null-usage (a session with no
 * workspace) or a failed request is interpreted.
 *
 * A failed request is deliberately not an error state: `usage` stays null and
 * `plans` falls back to the static catalogue, so the plan comparison still
 * renders and only the workspace-specific figures go missing.
 */
export function useCreditOverview(): CreditOverview {
    const [usage, setUsage] = useState<CreditUsageDTO | null>(null);
    const [plans, setPlans] = useState<PlanWithCurrent[]>([...PLANS]);
    const [loading, setLoading] = useState(true);

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

    return { usage, plans, loading };
}
