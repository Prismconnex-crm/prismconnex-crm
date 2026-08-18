"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { findShowEvents } from '@/lib/find-shows/catalog';
import { EventsFilterSidebar } from '@/components/events/events-filter-sidebar';
import { EventsResultsTable } from '@/components/events/events-results-table';
import { buildEventFilterChips, removeEventFilterChip } from '@/lib/events/chips';
import {
    computeEventFacets,
    filterEventList,
    parseEventQueryState,
    serializeEventQueryState,
    type EventQueryState,
} from '@/lib/events/filters';
import { emptyEventFilters, type EventFilters } from '@/types/events';
import { AssistantPanel } from '@/components/assistant/assistant-panel';
import { useAssistantConversation } from '@/components/assistant/assistant-provider';
import { eventsBinding } from '@/components/assistant/bindings/events';

const PAGE_SIZE = 25;
/** How many rows the answering model is allowed to see. */
const ANSWER_ROW_LIMIT = 40;

function readSlugSet(key: string): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
    } catch {
        return new Set();
    }
}

export function EventListView({ mode = 'all' }: { mode?: 'all' | 'target' }) {
    // Filter state is read from — and written back to — the URL, so a search is
    // shareable and the AI panel and the left rail read the same source.
    const [queryState, setQueryState] = useState<EventQueryState>(() => ({
        filters: emptyEventFilters(),
        search: '',
    }));
    // The URL is read after mount rather than in the initializer above: parsing
    // it during render would have the server produce an unfiltered list and the
    // client a filtered one, which is a hydration mismatch.
    const [isHydrated, setIsHydrated] = useState(false);
    const [page, setPage] = useState(1);

    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [targetIds, setTargetIds] = useState<Set<string>>(new Set());


    useEffect(() => {
        setQueryState(parseEventQueryState(window.location.search));
        setLikedIds(readSlugSet('pc_liked_events'));
        setTargetIds(readSlugSet('pc_target_events'));
        setIsHydrated(true);
    }, []);

    // history.replaceState rather than router.replace: this only needs to keep
    // the address bar shareable, and avoids re-running the RSC payload on every
    // checkbox click. Skipped until the URL has been read, so the first paint
    // cannot blank out an incoming shared link.
    useEffect(() => {
        if (!isHydrated) return;
        const query = serializeEventQueryState(queryState);
        window.history.replaceState(null, '', `${window.location.pathname}${query}`);
    }, [queryState, isHydrated]);

    const toggleLike = (slug: string) => {
        setLikedIds((prev) => {
            const next = new Set(prev);
            if (next.has(slug)) next.delete(slug);
            else next.add(slug);
            localStorage.setItem('pc_liked_events', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const toggleTarget = (slug: string) => {
        setTargetIds((prev) => {
            const next = new Set(prev);
            if (next.has(slug)) next.delete(slug);
            else next.add(slug);
            localStorage.setItem('pc_target_events', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    // The Target Events route filters the catalog down before anything else, so
    // facet counts and the assistant's answer both reflect that subset.
    const baseEvents = useMemo(
        () => (mode === 'target' ? findShowEvents.filter((e) => targetIds.has(e.slug)) : findShowEvents),
        [mode, targetIds]
    );

    const filteredEvents = useMemo(
        () => filterEventList(baseEvents, queryState.filters, queryState.search, likedIds),
        [baseEvents, queryState, likedIds]
    );

    const facets = useMemo(
        () => computeEventFacets(baseEvents, queryState.filters, queryState.search, likedIds),
        [baseEvents, queryState, likedIds]
    );

    const pageCount = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const pagedEvents = useMemo(
        () => filteredEvents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [filteredEvents, safePage]
    );

    const applyQueryState = useCallback((next: EventQueryState) => {
        setQueryState(next);
        setPage(1);
    }, []);

    // A handoff carries filters the RAIL must show, not just the panel. Keyed by
    // the question so a second handoff for the same target still applies.
    const { state: conversation } = useAssistantConversation();
    const appliedHandoffRef = useRef<string | null>(null);

    useEffect(() => {
        const handoff = conversation.pendingHandoff;
        if (!handoff || handoff.to !== 'events' || !handoff.presetFilters) return;
        const key = `${handoff.to}:${handoff.message}`;
        if (appliedHandoffRef.current === key) return;
        appliedHandoffRef.current = key;
        setQueryState((prev) =>
            eventsBinding.applyFilters(prev, handoff.presetFilters as Partial<EventQueryState>)
        );
        setPage(1);
    }, [conversation.pendingHandoff]);

    const updateFilters = (filters: EventFilters) => {
        setQueryState((prev) => ({ ...prev, filters }));
        setPage(1);
    };

    const updateSearch = (search: string) => {
        setQueryState((prev) => ({ ...prev, search }));
        setPage(1);
    };

    const clearAll = () => {
        setQueryState({ filters: emptyEventFilters(), search: '' });
        setPage(1);
    };

    const removeChip = (chipId: string) => {
        setQueryState((prev) => removeEventFilterChip(prev.filters, prev.search, chipId));
        setPage(1);
    };

    const chips = buildEventFilterChips(queryState.filters, queryState.search);

    // The hero and the results share one slot. Anything narrowing the catalog —
    // a typed question or a single filter — means the rows are what the user
    // came for, so the pitch collapses to a one-line bar. Target Events is a
    // curated list rather than a search, so it skips the hero entirely.
    const isSearchActive = mode === 'target' || chips.length > 0;

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-8">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-start justify-between gap-4 py-2 sm:flex-row sm:items-center"
            >
                <div>
                    <h1 className="mb-1 flex items-center gap-2 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
                        <Calendar className="size-6 text-indigo-500" />
                        {mode === 'target' ? 'Target Events' : 'Events Explorer'}
                    </h1>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400">
                        {mode === 'target'
                            ? 'Focused tracking for high-priority shows'
                            : `${findShowEvents.length.toLocaleString()} trade shows — filter them, or just ask`}
                    </p>
                </div>
                <button className="h-9 rounded-[8px] bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                    Add New Event
                </button>
            </motion.div>

            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[340px_1fr]">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.05 }}
                    className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"
                >
                    <EventsFilterSidebar
                        filters={queryState.filters}
                        search={queryState.search}
                        facets={facets}
                        resultCount={filteredEvents.length}
                        onFiltersChange={updateFilters}
                        onSearchChange={updateSearch}
                        onClear={clearAll}
                    />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="min-w-0"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {isSearchActive ? (
                            <motion.div
                                key="events-results"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                // The panel owns its scroll: the bar and chips
                                // stay pinned while the rows run under them,
                                // and the page keeps its single scrollbar.
                                className="flex flex-col overflow-y-auto rounded-[16px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E] xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"
                            >
                                <AssistantPanel
                                    currentPage="events"
                                    activeFilters={queryState as unknown as Record<string, unknown>}
                                    rowContext={{
                                        likedIds,
                                        targetIds,
                                        onToggleLike: toggleLike,
                                        onToggleTarget: toggleTarget,
                                    }}
                                    onGoBack={(entity, sourceFilters) => {
                                        // Spec 2b binds People and Events; a
                                        // back-jump to Companies arrives in 2c.
                                        if (entity === 'events' && sourceFilters) {
                                            applyQueryState(
                                                eventsBinding.applyFilters(
                                                    queryState,
                                                    sourceFilters as Partial<EventQueryState>
                                                )
                                            );
                                        }
                                    }}
                                />

                                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#22304A]">
                                    <span className="text-[13px] font-bold text-slate-900 dark:text-white">
                                        {filteredEvents.length.toLocaleString()}{' '}
                                        <span className="font-semibold text-slate-500 dark:text-[#9CA3AF]">
                                            {filteredEvents.length === 1 ? 'event' : 'events'}
                                        </span>
                                    </span>
                                    {/* The empty state carries its own reset, so this
                                        only appears when there are rows to clear. */}
                                    {chips.length > 0 && filteredEvents.length > 0 ? (
                                        <button
                                            type="button"
                                            onClick={clearAll}
                                            className="text-[12px] font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-[#9CA3AF] dark:hover:text-indigo-400"
                                        >
                                            Clear all
                                        </button>
                                    ) : null}
                                </div>

                                <EventsResultsTable
                                    events={pagedEvents}
                                    totalMatched={filteredEvents.length}
                                    page={safePage}
                                    pageSize={PAGE_SIZE}
                                    onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
                                    likedIds={likedIds}
                                    targetIds={targetIds}
                                    onToggleLike={toggleLike}
                                    onToggleTarget={toggleTarget}
                                    chips={chips}
                                    onRemoveChip={removeChip}
                                    onClearAll={clearAll}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="events-hero"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <AssistantPanel
                                    currentPage="events"
                                    activeFilters={queryState as unknown as Record<string, unknown>}
                                    rowContext={{
                                        likedIds,
                                        targetIds,
                                        onToggleLike: toggleLike,
                                        onToggleTarget: toggleTarget,
                                    }}
                                    onGoBack={(entity, sourceFilters) => {
                                        // Spec 2b binds People and Events; a
                                        // back-jump to Companies arrives in 2c.
                                        if (entity === 'events' && sourceFilters) {
                                            applyQueryState(
                                                eventsBinding.applyFilters(
                                                    queryState,
                                                    sourceFilters as Partial<EventQueryState>
                                                )
                                            );
                                        }
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
