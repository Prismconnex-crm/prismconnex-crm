"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Filter, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/search/filter-chips";
import { PeopleResultsTable } from "@/components/people/people-results-table";
import type { PeopleChatMessage } from "@/components/people/use-people-chat";
import type { PeopleFilters, Person } from "@/types/people";

/**
 * One turn in the thread. An assistant turn is three things stacked: the prose
 * answer, the chips showing how the question was read (with "Apply filters"),
 * and the capped inline table.
 */
export function PeopleMessage({
  message,
  savedIds,
  selectedIds,
  isStreaming,
  onApplyFilters,
  onViewAll,
  onRetry,
  onToggleSelect,
  onToggleSaved,
  onOpenPerson,
}: {
  message: PeopleChatMessage;
  savedIds: Set<string>;
  selectedIds: Set<string>;
  isStreaming: boolean;
  onApplyFilters: (filters: PeopleFilters) => void;
  onViewAll: (filters: PeopleFilters) => void;
  onRetry: () => void;
  onToggleSelect: (id: string) => void;
  onToggleSaved: (person: Person) => void;
  onOpenPerson: (person: Person) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-indigo-600 px-3.5 py-2.5 text-[13px] font-medium text-white shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  const isRateLimited = message.error?.code === "rate_limited";
  // Results have not arrived yet — show the skeleton rather than an empty table.
  const isAwaitingResults = !message.filters && !message.error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-3 rounded-[14px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]"
    >
      {message.text ? (
        <p className="text-[13px] leading-6 text-slate-800 dark:text-slate-200">
          {message.text}
          {isStreaming && !message.isComplete ? (
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-indigo-500 align-middle" />
          ) : null}
        </p>
      ) : null}

      {message.error ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[12px]",
            isRateLimited
              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
          )}
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{message.error.message}</p>
            {/* Rate limits get no retry button until the window elapses. */}
            {!isRateLimited ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1.5 inline-flex items-center gap-1 rounded-[8px] border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:bg-[#0B1220] dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <RefreshCw className="size-3" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {message.chips.length > 0 && message.filters ? (
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips chips={message.chips} />
          <button
            type="button"
            onClick={() => onApplyFilters(message.filters as PeopleFilters)}
            className="inline-flex h-7 items-center gap-1.5 rounded-[8px] border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
          >
            <Filter className="size-3" />
            Apply filters
          </button>
        </div>
      ) : null}

      {isAwaitingResults || message.results.length > 0 ? (
        <PeopleResultsTable
          people={message.results}
          selectedIds={selectedIds}
          savedIds={savedIds}
          isLoading={isAwaitingResults}
          skeletonRows={5}
          onToggleSelect={onToggleSelect}
          onToggleSaved={onToggleSaved}
          onOpenPerson={onOpenPerson}
        />
      ) : null}

      {message.total > message.results.length && message.filters ? (
        <button
          type="button"
          onClick={() => onViewAll(message.filters as PeopleFilters)}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          View all {message.total.toLocaleString()} results
          <ArrowRight className="size-3.5" />
        </button>
      ) : null}
    </motion.div>
  );
}
