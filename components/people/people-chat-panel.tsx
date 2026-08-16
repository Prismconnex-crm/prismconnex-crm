"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AiSearchPanel, CompactSearchBar } from "@/components/search/ai-search-panel";
import { useQueryStore } from "@/components/search/query-store";
import { PeopleMessage } from "@/components/people/people-message";
import { PeopleResultsTable } from "@/components/people/people-results-table";
import { PeopleBulkToolbar } from "@/components/people/people-bulk-toolbar";
import type { PeopleChatMessage } from "@/components/people/use-people-chat";
import type { PeopleFilters, Person } from "@/types/people";

/**
 * The right column. Two states, one surface:
 *
 * - EMPTY: the shared `AiSearchPanel` hero — gradient sparkle badge, gradient
 *   textarea, circular send button, Recent | Saved cards.
 * - ACTIVE: the hero collapses to `CompactSearchBar`, pinned above a scrolling
 *   thread.
 *
 * `View all N results` flips `view` to "results" — a full paginated table with
 * the thread preserved underneath, rather than a third column.
 */
export function PeopleChatPanel({
  messages,
  isStreaming,
  view,
  results,
  resultsTotal,
  page,
  pageSize,
  isLoadingResults,
  selectedIds,
  savedIds,
  onViewChange,
  onPageChange,
  onSend,
  onRetry,
  onApplyFilters,
  onViewAll,
  onToggleSelect,
  onToggleSelectAll,
  onToggleSaved,
  onOpenPerson,
}: {
  messages: PeopleChatMessage[];
  isStreaming: boolean;
  view: "chat" | "results";
  results: Person[];
  resultsTotal: number;
  page: number;
  pageSize: number;
  isLoadingResults: boolean;
  selectedIds: Set<string>;
  savedIds: Set<string>;
  onViewChange: (view: "chat" | "results") => void;
  onPageChange: (page: number) => void;
  onSend: (message: string) => void;
  onRetry: () => void;
  onApplyFilters: (filters: PeopleFilters) => void;
  onViewAll: (filters: PeopleFilters) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleSaved: (person: Person) => void;
  onOpenPerson: (person: Person) => void;
}) {
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const { record } = useQueryStore("people_query");

  // Follow the answer as it streams.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (prompt: string) => {
    const question = prompt.trim();
    if (!question) return;
    onSend(question);
    setDraft("");
  };

  // Record each completed exchange so the Recent | Saved cards show real chips.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.isComplete || last.error) return;
    const question = messages[messages.length - 2];
    if (!question || question.role !== "user") return;
    record({
      query: question.text,
      chips: last.chips.map((chip) => ({ label: chip.label, value: chip.value })),
      payload: last.filters,
    });
  }, [messages, record]);

  if (messages.length === 0) {
    return (
      <AiSearchPanel
        title="Find anything"
        subtitle="Describe the contacts you're looking for in simple terms and we'll find and answer questions about them."
        placeholder="e.g., Verified marketing managers at AI companies in Germany..."
        kind="people_query"
        kindLabel="People query"
        isBusy={isStreaming}
        defaultTab="recent"
        onSubmit={submit}
        onSelectQuery={(entry) => {
          if (entry.payload) onApplyFilters(entry.payload as PeopleFilters);
          submit(entry.query);
        }}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(resultsTotal / pageSize));

  return (
    <div className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="flex items-center gap-1 border-b border-slate-200 p-2 dark:border-[#22304A]">
        {(["chat", "results"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewChange(mode)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
              view === mode
                ? "bg-slate-900 text-white dark:bg-white dark:text-[#0B1220]"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#16233A] dark:hover:text-white"
            )}
          >
            {mode === "results" ? `Results (${resultsTotal.toLocaleString()})` : "Chat"}
          </button>
        ))}
      </div>

      {view === "chat" ? (
        <>
          <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((message) => (
              <PeopleMessage
                key={message.id}
                message={message}
                savedIds={savedIds}
                selectedIds={selectedIds}
                isStreaming={isStreaming}
                onApplyFilters={onApplyFilters}
                onViewAll={onViewAll}
                onRetry={onRetry}
                onToggleSelect={onToggleSelect}
                onToggleSaved={onToggleSaved}
                onOpenPerson={onOpenPerson}
              />
            ))}
          </div>
          {/* Composer pinned to the bottom: the thread above takes `flex-1`, so
              DOM order alone holds this bar down. */}
          <CompactSearchBar
            value={draft}
            placeholder="Ask a follow-up about these contacts..."
            kind="people_query"
            kindLabel="People query"
            isBusy={isStreaming}
            onChange={setDraft}
            onSubmit={submit}
            onClear={() => setDraft("")}
            onSelectQuery={(entry) => submit(entry.query)}
          />
        </>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <PeopleBulkToolbar
            selectedCount={selectedIds.size}
            totalCount={results.length}
            allSelected={results.length > 0 && results.every((person) => selectedIds.has(person.id))}
            onToggleSelectAll={onToggleSelectAll}
            onVerifyEmails={() => undefined}
            onAddToSequence={() => undefined}
            onMerge={() => undefined}
          />
          <PeopleResultsTable
            people={results}
            selectedIds={selectedIds}
            savedIds={savedIds}
            isLoading={isLoadingResults}
            skeletonRows={10}
            onToggleSelect={onToggleSelect}
            onToggleSaved={onToggleSaved}
            onOpenPerson={onOpenPerson}
          />
          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#22304A] dark:bg-[#0B1220]">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-[6px] border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 transition-colors disabled:cursor-not-allowed disabled:text-slate-300 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-[#E5E7EB] dark:disabled:text-slate-600"
            >
              Prev
            </button>
            <span className="text-[12px] font-medium text-slate-600 dark:text-[#E5E7EB]">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-[6px] border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 transition-colors disabled:cursor-not-allowed disabled:text-slate-300 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-[#E5E7EB] dark:disabled:text-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
