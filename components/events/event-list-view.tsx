"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { findShowEvents } from '@/lib/find-shows/catalog';
import { EventsFilterSidebar } from '@/components/events/events-filter-sidebar';
import { EventsAiSearch } from '@/components/events/events-ai-search';
import { EventsResultsTable } from '@/components/events/events-results-table';
import { buildEventFilterChips, removeEventFilterChip } from '@/lib/events/chips';
import {
    computeEventFacets,
    filterEventList,
    parseEventQueryState,
    serializeEventQueryState,
    type EventQueryState,
} from '@/lib/events/filters';
import { emptyEventFilters, type EventAnswerRow, type EventFilters } from '@/types/events';

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

    // The question behind the current result set, and the grounded answer to it.
    const [question, setQuestion] = useState<string | null>(null);
    const [answer, setAnswer] = useState<string | null>(null);
    const [isAnswering, setIsAnswering] = useState(false);

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

    // Answer the user's question from the rows that actually matched. Runs after
    // filtering, and re-runs if the filters are then adjusted by hand.
    useEffect(() => {
        if (!question) return;

        const controller = new AbortController();
        setIsAnswering(true);

        const rows: EventAnswerRow[] = filteredEvents.slice(0, ANSWER_ROW_LIMIT).map((event) => ({
            name: event.name,
            organizer: event.organizer === '?' ? '' : event.organizer,
            city: event.city,
            country: event.country,
            dates: event.displayDate,
            category: event.primaryCategory,
        }));

        fetch('/api/ai/event-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, totalMatched: filteredEvents.length, rows }),
            signal: controller.signal,
        })
            .then((response) => (response.ok ? response.json() : { answer: null }))
            .then((data: { answer?: string | null }) => {
                setAnswer(typeof data.answer === 'string' ? data.answer : null);
                setIsAnswering(false);
            })
            .catch((error) => {
                if ((error as Error).name === 'AbortError') return;
                // The table is already on screen; a missing summary is not worth
                // an error state.
                setAnswer(null);
                setIsAnswering(false);
            });

        return () => controller.abort();
    }, [question, filteredEvents]);

    const applyQueryState = useCallback((next: EventQueryState, asked: string | null) => {
        setQueryState(next);
        setPage(1);
        if (asked !== null) {
            setQuestion(asked);
            setAnswer(null);
        }
    }, []);

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
        setQuestion(null);
        setAnswer(null);
    };

    // Emptying the compact box drops the question, but leaves filters the user
    // set by hand in the rail — those still have results worth showing.
    const clearQuery = () => {
        setQueryState((prev) => ({ ...prev, search: '' }));
        setPage(1);
        setQuestion(null);
        setAnswer(null);
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
    const isSearchActive = mode === 'target' || chips.length > 0 || question !== null;

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
                                <EventsAiSearch
                                    variant="compact"
                                    filters={queryState.filters}
                                    search={queryState.search}
                                    question={question}
                                    onApply={applyQueryState}
                                    onRemoveChip={removeChip}
                                    onClearAll={clearAll}
                                    onClearQuery={clearQuery}
                                    answer={answer}
                                    isAnswering={isAnswering}
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
                                <EventsAiSearch
                                    filters={queryState.filters}
                                    search={queryState.search}
                                    question={question}
                                    onApply={applyQueryState}
                                    onRemoveChip={removeChip}
                                    onClearAll={clearAll}
                                    onClearQuery={clearQuery}
                                    answer={answer}
                                    isAnswering={isAnswering}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
