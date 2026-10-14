"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeadDTO, LeadStatsDTO } from "@/models/lead";
import { leadApi } from "./lead-api";

export type LeadFilters = {
    q: string;
    /** "" = all statuses */
    status: string;
    /** "all" | "me" | "unassigned" | a CRM User.id */
    owner: string;
};

export const DEFAULT_LEAD_FILTERS: LeadFilters = { q: "", status: "", owner: "all" };

const SEARCH_DEBOUNCE_MS = 300;

type Phase = "loading" | "ready" | "error";

/**
 * The lead list: filters, cursor paging and the workspace-wide stats.
 *
 * Each fetch carries a sequence number and only the latest one may write
 * state, so a slow response for an old search can never overwrite the results
 * of the search the user is looking at.
 */
export function useLeads() {
    const [filters, setFilters] = useState<LeadFilters>(DEFAULT_LEAD_FILTERS);
    const [debouncedQ, setDebouncedQ] = useState("");
    const [items, setItems] = useState<LeadDTO[]>([]);
    const [stats, setStats] = useState<LeadStatsDTO | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [phase, setPhase] = useState<Phase>("loading");
    const [error, setError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const sequence = useRef(0);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQ(filters.q.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [filters.q]);

    /** `quiet` keeps the current rows on screen while refreshing after a change. */
    const load = useCallback(
        async (quiet = false) => {
            const id = ++sequence.current;
            if (!quiet) setPhase("loading");

            try {
                const result = await leadApi.list({
                    q: debouncedQ,
                    status: filters.status,
                    owner: filters.owner === "all" ? undefined : filters.owner,
                });
                if (id !== sequence.current) return;

                setItems(result.items);
                setStats(result.stats);
                setNextCursor(result.nextCursor);
                setError(null);
                setPhase("ready");
            } catch (caught) {
                if (id !== sequence.current) return;
                setError(caught instanceof Error ? caught.message : "Could not load leads.");
                setPhase("error");
            }
        },
        [debouncedQ, filters.status, filters.owner]
    );

    useEffect(() => {
        void load();
    }, [load]);

    const loadMore = useCallback(async () => {
        if (!nextCursor || loadingMore) return;
        const id = sequence.current;
        setLoadingMore(true);

        try {
            const result = await leadApi.list({
                q: debouncedQ,
                status: filters.status,
                owner: filters.owner === "all" ? undefined : filters.owner,
                cursor: nextCursor,
            });
            // A filter changed while this page was in flight — drop it.
            if (id !== sequence.current) return;

            setItems((current) => [...current, ...result.items]);
            setNextCursor(result.nextCursor);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not load more leads.");
        } finally {
            setLoadingMore(false);
        }
    }, [nextCursor, loadingMore, debouncedQ, filters.status, filters.owner]);

    const updateFilters = useCallback((patch: Partial<LeadFilters>) => {
        setFilters((current) => ({ ...current, ...patch }));
    }, []);

    /** Shows an edited lead immediately; the quiet refresh then fixes counts and order. */
    const replaceLead = useCallback((lead: LeadDTO) => {
        setItems((current) => current.map((item) => (item.id === lead.id ? lead : item)));
    }, []);

    const dropLead = useCallback((id: string) => {
        setItems((current) => current.filter((item) => item.id !== id));
    }, []);

    const hasFilters = Boolean(debouncedQ || filters.status || filters.owner !== "all");

    return {
        filters,
        updateFilters,
        items,
        stats,
        phase,
        error,
        nextCursor,
        loadingMore,
        hasFilters,
        reload: load,
        loadMore,
        replaceLead,
        dropLead,
    };
}
