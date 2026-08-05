"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { AiSearchPanel, CompactSearchBar } from "@/components/search/ai-search-panel";
import { FilterChips } from "@/components/search/filter-chips";
import { useQueryStore, type SavedQuery } from "@/components/search/query-store";
import { buildEventFilterChips } from "@/lib/events/chips";
import { emptyEventFilters, type EventFilters, type EventQueryResponse } from "@/types/events";

type EventQueryApiResponse = EventQueryResponse & { degraded?: boolean; reason?: string };

/** Payload stored alongside a recent/saved query so "View" restores it exactly. */
type StoredEventQuery = { filters: EventFilters; search: string };

const PLACEHOLDER = "e.g., Plastics trade shows in Europe in Q1 2026";

export function EventsAiSearch({
  variant = "hero",
  filters,
  search,
  question,
  onApply,
  onRemoveChip,
  onClearAll,
  onClearQuery,
  answer,
  isAnswering,
}: {
  /**
   * `hero` is the empty state — the full "Find anything" card. `compact` is the
   * active state: one pinned line above the results, with the chips on their
   * own row beneath it.
   */
  variant?: "hero" | "compact";
  filters: EventFilters;
  search: string;
  /** The question behind the current results; seeds the compact input. */
  question?: string | null;
  /** Applies a complete search state and records the question that produced it. */
  onApply: (next: StoredEventQuery, question: string | null) => void;
  onRemoveChip: (chipId: string) => void;
  /** Full reset — query and filters — which collapses back to the hero. */
  onClearAll?: () => void;
  /** Drops just the question and free-text box, leaving the filters alone. */
  onClearQuery?: () => void;
  /** Grounded answer for the current question, owned by the parent. */
  answer: string | null;
  isAnswering: boolean;
}) {
  const [isAsking, setIsAsking] = useState(false);
  const [degraded, setDegraded] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [draft, setDraft] = useState(question ?? "");
  const { record } = useQueryStore("event_query");

  const chips = buildEventFilterChips(filters, search);

  // A follow-up chip or a restored history entry changes the question without
  // going through the input, so the compact box tracks it.
  useEffect(() => {
    setDraft(question ?? "");
  }, [question]);

  const runQuery = useCallback(
    async (prompt: string) => {
      setIsAsking(true);
      setDegraded(null);

      let result: EventQueryApiResponse;
      try {
        const response = await fetch("/api/ai/event-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, currentFilters: filters }),
        });

        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        result = await response.json();
      } catch {
        // The route already degrades server-side; this covers the network
        // itself being down, so fall back to a bare keyword search locally.
        result = {
          filters: { ...emptyEventFilters(), keywords: [prompt.trim()] },
          explanation: "",
          suggestedFollowUps: [],
          degraded: true,
        };
      } finally {
        setIsAsking(false);
      }

      if (result.degraded) {
        setDegraded(
          result.reason === "missing_api_key"
            ? "AI search is unavailable — ANTHROPIC_API_KEY is not configured. Showing a keyword search instead."
            : "AI search is unavailable right now. Showing a keyword search instead."
        );
      }

      setFollowUps(result.suggestedFollowUps ?? []);

      // The assistant produces filters only, so a new question replaces the
      // free-text box rather than stacking on top of it.
      const next: StoredEventQuery = { filters: result.filters, search: "" };
      onApply(next, prompt);

      record({
        query: prompt,
        chips: buildEventFilterChips(result.filters).map((chip) => ({
          label: chip.label,
          value: chip.value,
        })),
        payload: next,
      });
    },
    [filters, onApply, record]
  );

  const restore = useCallback(
    (entry: SavedQuery) => {
      const payload = entry.payload as StoredEventQuery | undefined;
      if (!payload?.filters) return;
      setFollowUps([]);
      setDegraded(null);
      onApply({ filters: payload.filters, search: payload.search ?? "" }, entry.query);
    },
    [onApply]
  );

  const degradedNote = degraded ? (
    <p className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      {degraded}
    </p>
  ) : null;

  const answerNote =
    answer || isAnswering ? (
      <div className="flex items-start gap-2.5 rounded-[12px] border border-indigo-100 bg-indigo-50/60 px-3.5 py-3 dark:border-indigo-500/20 dark:bg-indigo-500/[0.07]">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
        {isAnswering ? (
          <span className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
            <Loader2 className="size-3.5 animate-spin" />
            Reading the matching events…
          </span>
        ) : (
          <p className="text-[13px] font-medium leading-relaxed text-slate-800 dark:text-slate-100">
            {answer}
          </p>
        )}
      </div>
    ) : null;

  const followUpRow =
    followUps.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          Try next:
        </span>
        {followUps.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => void runQuery(suggestion)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-[#22304A] dark:text-slate-300 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300"
          >
            {suggestion}
          </button>
        ))}
      </div>
    ) : null;

  if (variant === "compact") {
    return (
      <>
        <CompactSearchBar
          className="sticky top-0 z-20 shrink-0"
          value={draft}
          placeholder={PLACEHOLDER}
          kind="event_query"
          kindLabel="Event query"
          isBusy={isAsking}
          onChange={(next) => {
            setDraft(next);
            // Emptying the box drops the question behind the results; the hero
            // comes back on its own once nothing is filtering the catalog.
            if (!next.trim()) onClearQuery?.();
          }}
          onSubmit={runQuery}
          onClear={() => {
            setFollowUps([]);
            setDegraded(null);
            onClearAll?.();
          }}
          onSelectQuery={restore}
        />

        <div className="sticky top-14 z-10 shrink-0 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-xl dark:border-[#22304A] dark:bg-[#111B2E]/95">
          <FilterChips
            chips={chips}
            onRemove={(chip) => onRemoveChip(chip.id)}
            emptyLabel="No filters applied — showing the whole catalog."
          />
        </div>

        {degradedNote || answerNote || followUpRow ? (
          <div className="shrink-0 space-y-3 border-b border-slate-200 px-4 py-3 dark:border-[#22304A]">
            {degradedNote}
            {answerNote}
            {followUpRow}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <AiSearchPanel
      title="Find anything"
      subtitle="Describe the shows you're looking for and we'll build the search — the filters on the left will update to match."
      placeholder={PLACEHOLDER}
      kind="event_query"
      kindLabel="Event query"
      isBusy={isAsking}
      onSubmit={runQuery}
      onSelectQuery={restore}
      note={degradedNote}
    >
      <div className="space-y-3">
        {answerNote}

        <FilterChips
          chips={chips}
          onRemove={(chip) => onRemoveChip(chip.id)}
          emptyLabel="No filters applied — showing the whole catalog."
        />

        {followUpRow}
      </div>
    </AiSearchPanel>
  );
}
