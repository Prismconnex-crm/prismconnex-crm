"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { AiSearchPanel, CompactSearchBar } from "@/components/search/ai-search-panel";
import { FilterChips } from "@/components/search/filter-chips";
import { useQueryStore, type SavedQuery } from "@/components/search/query-store";
import { useAskHandoff } from "@/components/search/use-ask-handoff";
import {
  buildCompanyFilterChips,
  emptyCompanyQuery,
  type CompanyQueryState,
} from "@/lib/companies/nl-query";

const PLACEHOLDER = "e.g., Give 30 fintech companies in India with 200-500 employees";

type AskResponse = {
  parsedQuery: CompanyQueryState;
  answer: string;
  totalCount: number;
  totalCountCapped: boolean;
};

/**
 * A stable identity for a search state, so the panel can tell "the answer on
 * screen already describes these filters" from "a chip was removed and the
 * answer is now stale". Without it, applying a parse would immediately
 * re-request the answer it just produced.
 */
function signature(state: CompanyQueryState) {
  return JSON.stringify([
    state.search,
    state.category,
    state.region,
    state.country,
    state.city,
    state.employeeRange,
    state.keywords,
    state.limit,
    state.sort,
  ]);
}

/**
 * The Companies "Find anything" panel.
 *
 * Deterministic end to end: POST /api/companies/ask with `mode: "structured"`
 * parses the sentence with dictionaries and answers straight from the
 * discovery dataset, so there is no model call, no API key and no per-keystroke
 * cost. The parse is handed up via `onApply` and becomes the left rail's
 * state — which is what makes a removed chip and a rail click the same code
 * path, and lets Recent/Saved restore a search exactly.
 */
export function CompaniesAiSearch({
  variant = "hero",
  state,
  question,
  onApply,
  onRemoveChip,
  onClearAll,
  onClearQuery,
}: {
  /** `hero` is the empty state; `compact` is one pinned line above the results. */
  variant?: "hero" | "compact";
  state: CompanyQueryState;
  /** The question behind the current results; seeds the compact input. */
  question: string | null;
  onApply: (next: CompanyQueryState, question: string | null) => void;
  onRemoveChip: (chipId: string) => void;
  /** Full reset — question and filters — which collapses back to the hero. */
  onClearAll?: () => void;
  /** Drops just the question, leaving the filters alone. */
  onClearQuery?: () => void;
}) {
  const [isAsking, setIsAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [draft, setDraft] = useState(question ?? "");
  const { record } = useQueryStore("lead_query");

  // The state the answer on screen was computed for.
  const answered = useRef<string | null>(null);
  /**
   * Identifies the newest in-flight request. A plain per-effect `cancelled`
   * flag is not enough here: applying a parse re-renders with a new state
   * object, so the refresh effect below tears down and re-runs while its own
   * request is still open. With `cancelled` that request's `finally` was
   * skipped and the busy spinner never cleared.
   */
  const requestId = useRef(0);

  const chips = buildCompanyFilterChips(state);

  // A restored history entry changes the question without going through the
  // input, so the compact box tracks it.
  useEffect(() => {
    setDraft(question ?? "");
  }, [question]);

  const ask = useCallback(
    async (prompt: string, filters?: CompanyQueryState): Promise<AskResponse | null> => {
      const response = await fetch("/api/companies/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: prompt, mode: "structured", filters }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return (await response.json()) as AskResponse;
    },
    []
  );

  const runQuery = useCallback(
    async (prompt: string) => {
      const id = (requestId.current += 1);
      setIsAsking(true);
      setFailure(null);
      try {
        const result = await ask(prompt);
        if (!result || requestId.current !== id) return;

        answered.current = signature(result.parsedQuery);
        setAnswer(result.answer);
        onApply(result.parsedQuery, prompt);

        record({
          query: prompt,
          chips: buildCompanyFilterChips(result.parsedQuery).map((chip) => ({
            label: chip.label,
            value: chip.value,
          })),
          // The parse, not the rows: "View" restores the search and re-runs it
          // against live data rather than replaying a stale page.
          payload: result.parsedQuery,
        });
      } catch {
        if (requestId.current !== id) return;
        setAnswer(null);
        answered.current = null;
        setFailure("Couldn't reach the search service. The filters on the left still work.");
      } finally {
        if (requestId.current === id) setIsAsking(false);
      }
    },
    [ask, onApply, record]
  );

  /**
   * Cross-page routing. A trade-show question typed here is handed to the
   * Events Explorer instead of being answered badly against the company
   * dataset; a question arriving from Events runs `runQuery` directly, which
   * skips classification and so cannot bounce back.
   */
  const handOff = useAskHandoff("companies", runQuery);

  const submit = useCallback(
    (prompt: string) => {
      if (handOff(prompt)) return;
      void runQuery(prompt);
    },
    [handOff, runQuery]
  );

  /**
   * Keeps the answer honest after the filters move underneath it — a chip
   * removed here, a value picked in the rail. Re-runs the same question
   * against the *current* filters rather than re-reading the sentence, which
   * would put back the filter that was just dropped.
   */
  useEffect(() => {
    if (!question) {
      setAnswer(null);
      answered.current = null;
      return;
    }
    const current = signature(state);
    if (answered.current === current) return;

    const id = (requestId.current += 1);
    answered.current = current;
    setIsAsking(true);
    ask(question, state)
      .then((result) => {
        if (requestId.current !== id || !result) return;
        setAnswer(result.answer);
        setFailure(null);
      })
      .catch(() => {
        if (requestId.current === id) setAnswer(null);
      })
      .finally(() => {
        if (requestId.current === id) setIsAsking(false);
      });
  }, [ask, question, state]);

  const restore = useCallback(
    (entry: SavedQuery) => {
      const payload = entry.payload as Partial<CompanyQueryState> | undefined;
      if (!payload) return;
      const next = { ...emptyCompanyQuery(), ...payload };
      answered.current = null;
      setFailure(null);
      onApply(next, entry.query);
    },
    [onApply]
  );

  const failureNote = failure ? (
    <p className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      {failure}
    </p>
  ) : null;

  const answerNote =
    answer || isAsking ? (
      <div className="flex items-start gap-2.5 rounded-[12px] border border-indigo-100 bg-indigo-50/60 px-3.5 py-3 dark:border-indigo-500/20 dark:bg-indigo-500/[0.07]">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
        {isAsking ? (
          <span className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
            <Loader2 className="size-3.5 animate-spin" />
            Searching the discovery dataset…
          </span>
        ) : (
          <p className="text-[13px] font-medium leading-relaxed text-slate-800 dark:text-slate-100">
            {answer}
          </p>
        )}
      </div>
    ) : null;

  if (variant === "compact") {
    return (
      <>
        <CompactSearchBar
          className="sticky top-0 z-20 shrink-0"
          value={draft}
          placeholder={PLACEHOLDER}
          kind="lead_query"
          kindLabel="Company query"
          isBusy={isAsking}
          onChange={(next) => {
            setDraft(next);
            // Emptying the box drops the question behind the results; the hero
            // comes back on its own once nothing is filtering the list.
            if (!next.trim()) onClearQuery?.();
          }}
          onSubmit={submit}
          onClear={() => {
            setAnswer(null);
            setFailure(null);
            answered.current = null;
            onClearAll?.();
          }}
          onSelectQuery={restore}
        />

        <div className="sticky top-14 z-10 shrink-0 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-xl dark:border-[#22304A] dark:bg-[#111B2E]/95">
          <FilterChips
            chips={chips}
            onRemove={(chip) => onRemoveChip(chip.id)}
            emptyLabel="No filters applied — showing the whole dataset."
          />
        </div>

        {failureNote || answerNote ? (
          <div className="shrink-0 space-y-3 border-b border-slate-200 px-4 py-3 dark:border-[#22304A]">
            {failureNote}
            {answerNote}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <AiSearchPanel
      title="Find anything"
      subtitle="Describe the companies you're looking for and we'll build the search — the filters on the left will update to match."
      placeholder={PLACEHOLDER}
      kind="lead_query"
      kindLabel="Company query"
      isBusy={isAsking}
      onSubmit={submit}
      onSelectQuery={restore}
      note={failureNote}
    >
      <div className="space-y-3">
        {answerNote}
        <FilterChips
          chips={chips}
          onRemove={(chip) => onRemoveChip(chip.id)}
          emptyLabel="No filters applied — showing the whole dataset."
        />
      </div>
    </AiSearchPanel>
  );
}
