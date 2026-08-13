"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Clock,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/search/filter-chips";
import { relativeTime, useQueryStore, type SavedQuery, type SavedQueryKind } from "@/components/search/query-store";

const TABS = [
  { key: "recent", label: "Recent" },
  { key: "saved", label: "Saved" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function QueryCard({
  entry,
  kindLabel,
  onView,
  onToggleSaved,
  onRemove,
}: {
  entry: SavedQuery;
  kindLabel: string;
  onView: () => void;
  onToggleSaved: () => void;
  onRemove: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-[14px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-xl transition-shadow hover:shadow-lg hover:shadow-indigo-500/10 dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:border-indigo-500/30"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-fuchsia-500/[0.05] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300">
            {entry.saved ? <Bookmark className="size-3.5" /> : <Clock className="size-3.5" />}
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className="font-medium text-slate-800 dark:text-slate-400">
              {relativeTime(entry.createdAt)}
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300">
              {kindLabel}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={entry.saved ? "Unsave query" : "Save query"}
            onClick={onToggleSaved}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-[9px] border transition-colors",
              entry.saved
                ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "border-slate-200 bg-white text-slate-500 hover:text-indigo-600 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-300"
            )}
          >
            {entry.saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="Delete query"
            onClick={onRemove}
            className="inline-flex size-8 items-center justify-center rounded-[9px] border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-200 hover:text-red-600 dark:border-white/[0.1] dark:bg-white/[0.04] dark:hover:border-red-500/30 dark:hover:text-red-400"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onView}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[9px] border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300"
          >
            View
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="relative mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-500">
          Your query
        </p>
        <p className="mt-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {entry.query}
        </p>
      </div>

      <FilterChips
        className="relative mt-3"
        chips={entry.chips.slice(0, 4).map((chip, index) => ({
          id: `${entry.id}-${index}`,
          label: chip.label,
          value: chip.value,
        }))}
      />
    </motion.div>
  );
}

/**
 * The Recent/Saved list body. Shared by the hero panel (inline, below the tabs)
 * and by the compact bar (inside the clock dropdown) so both stay in step.
 */
function QueryHistoryList({
  entries,
  activeTab,
  kindLabel,
  onSelectQuery,
  onToggleSaved,
  onRemove,
}: {
  entries: SavedQuery[];
  activeTab: TabKey;
  kindLabel: string;
  onSelectQuery: (entry: SavedQuery) => void;
  onToggleSaved: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-slate-400 dark:text-slate-500">
        {activeTab === "saved"
          ? "No saved searches yet — run one, then hit the bookmark."
          : "No searches yet. Ask a question above to get started."}
      </p>
    );
  }

  return (
    <>
      {entries.map((entry) => (
        <QueryCard
          key={entry.id}
          entry={entry}
          kindLabel={kindLabel}
          onView={() => onSelectQuery(entry)}
          onToggleSaved={() => onToggleSaved(entry.id)}
          onRemove={() => onRemove(entry.id)}
        />
      ))}
    </>
  );
}

/**
 * The "Find anything" prompt card. Shared shell: the caller supplies the copy,
 * the submit handler and whatever it wants rendered beneath the box (parsed
 * filter chips, a grounded answer), while Recent/Saved history comes from the
 * common query store.
 *
 * The history list is collapsed until a tab is clicked — unlike the Companies
 * empty state, this panel sits above a results table that should stay visible.
 */
export function AiSearchPanel({
  title,
  subtitle,
  placeholder,
  kind,
  kindLabel,
  isBusy = false,
  note,
  onSubmit,
  onSelectQuery,
  children,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  kind: SavedQueryKind;
  kindLabel: string;
  isBusy?: boolean;
  note?: ReactNode;
  onSubmit: (prompt: string) => void;
  onSelectQuery: (entry: SavedQuery) => void;
  children?: ReactNode;
}) {
  const [prompt, setPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const { recent, saved, toggleSaved, remove } = useQueryStore(kind);

  const entries = activeTab === "saved" ? saved : recent;

  const submit = () => {
    const raw = prompt.trim();
    if (!raw || isBusy) return;
    onSubmit(raw);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm dark:border-transparent dark:bg-transparent"
    >
      {/* gradient border + glass base (dark) */}
      <div className="pointer-events-none absolute inset-0 hidden rounded-[16px] bg-gradient-to-br from-cyan-500/40 via-indigo-500/20 to-fuchsia-500/40 p-px dark:block">
        <div className="h-full w-full rounded-[15px] bg-[#0B1220]/90 backdrop-blur-2xl" />
      </div>
      <div className="pointer-events-none absolute -top-24 left-1/2 hidden h-48 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl dark:block" />

      <div className="relative p-5 sm:p-6">
        <div className="mx-auto w-full max-w-2xl text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-[14px] border border-indigo-200 bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30 dark:border-indigo-400/20">
            <Wand2 className="size-5 text-white" />
          </div>
          <h2 className="mt-4 bg-gradient-to-r from-slate-900 via-indigo-700 to-slate-900 bg-clip-text text-[26px] font-bold tracking-tight text-transparent dark:from-white dark:via-indigo-200 dark:to-white">
            {title}
          </h2>
          <p className="mt-1.5 text-[13px] text-slate-900 dark:text-slate-400">{subtitle}</p>
        </div>

        <div className="mx-auto mt-5 w-full max-w-2xl">
          <div className="group relative rounded-[16px] bg-gradient-to-r from-cyan-500/50 via-indigo-500/50 to-fuchsia-500/50 p-px shadow-lg shadow-indigo-500/10 transition-shadow focus-within:shadow-indigo-500/30">
            <div className="relative flex items-start gap-3 rounded-[15px] bg-white p-4 dark:bg-[#0D1526]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                placeholder={placeholder}
                className="min-h-[48px] w-full resize-none bg-transparent pr-10 text-[13px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                aria-label="Run search"
                onClick={submit}
                disabled={isBusy}
                className={cn(
                  "absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full transition-all",
                  prompt.trim() && !isBusy
                    ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/40 hover:scale-105"
                    : "bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500"
                )}
              >
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
          </div>

          {note ? <div className="mt-3">{note}</div> : null}
          {children ? <div className="mt-4">{children}</div> : null}
        </div>

        <div className="mx-auto mt-5 w-full max-w-2xl">
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/[0.08]">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tab.key === "saved" ? saved.length : recent.length;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(isActive ? null : tab.key)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold transition-colors",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-300"
                      : "text-slate-800 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  {tab.key === "saved" ? <Bookmark className="size-3.5" /> : <Clock className="size-3.5" />}
                  {tab.label}
                  {count > 0 ? (
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      {count}
                    </span>
                  ) : null}
                  {isActive ? (
                    <motion.span
                      layoutId="ai-panel-tab-underline"
                      className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <AnimatePresence initial={false}>
            {activeTab ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3 pb-1">
                  <QueryHistoryList
                    entries={entries}
                    activeTab={activeTab}
                    kindLabel={kindLabel}
                    onSelectQuery={onSelectQuery}
                    onToggleSaved={toggleSaved}
                    onRemove={remove}
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * The collapsed form of the panel above: a single line that stays pinned over
 * the results once a search is running. The heading and subtitle are gone
 * rather than hidden — at that point the rows, not the pitch, are the subject —
 * and Recent/Saved move behind the clock icon so they never sit between the
 * input and the results.
 *
 * The input is controlled by the caller so that clearing it can collapse the
 * whole surface back to the hero.
 */
export function CompactSearchBar({
  value,
  placeholder,
  kind,
  kindLabel,
  isBusy = false,
  onChange,
  onSubmit,
  onClear,
  onSelectQuery,
  className,
}: {
  value: string;
  placeholder: string;
  kind: SavedQueryKind;
  kindLabel: string;
  isBusy?: boolean;
  onChange: (value: string) => void;
  onSubmit: (prompt: string) => void;
  /** Full reset — drops the query and every filter, restoring the hero. */
  onClear: () => void;
  onSelectQuery: (entry: SavedQuery) => void;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const { recent, saved, toggleSaved, remove } = useQueryStore(kind);

  const entries = activeTab === "saved" ? saved : recent;

  const submit = () => {
    const raw = value.trim();
    if (!raw || isBusy) return;
    onSubmit(raw);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("relative", className)}
    >
      <div className="border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-xl dark:border-[#22304A] dark:bg-[#111B2E]/95">
        <div className="rounded-[14px] bg-gradient-to-r from-cyan-500/50 via-indigo-500/50 to-fuchsia-500/50 p-px shadow-sm shadow-indigo-500/10 transition-shadow focus-within:shadow-indigo-500/30">
          <div className="flex h-10 items-center gap-2.5 rounded-[13px] bg-white px-3 dark:bg-[#0D1526]">
            <Sparkles className="size-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
            <input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={placeholder}
              className="h-full w-full min-w-0 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
            <button
              type="button"
              aria-label="Recent and saved searches"
              aria-expanded={activeTab !== null}
              onClick={() => setActiveTab((current) => (current ? null : "recent"))}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                activeTab
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
              )}
            >
              <Clock className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Run search"
              onClick={submit}
              disabled={isBusy}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full transition-all",
                value.trim() && !isBusy
                  ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/40 hover:scale-105"
                  : "bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500"
              )}
            >
              {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" />}
            </button>
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setActiveTab(null);
                onClear();
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {activeTab ? (
          <>
            {/* Click-away target — the dropdown floats over the rows. */}
            <button
              type="button"
              aria-label="Close search history"
              tabIndex={-1}
              onClick={() => setActiveTab(null)}
              className="fixed inset-0 z-20 cursor-default"
            />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute right-3 top-full z-30 w-[min(30rem,calc(100%-1.5rem))] overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-[#22304A] dark:bg-[#0D1526] dark:shadow-black/40"
            >
              <div className="flex items-center gap-1 border-b border-slate-200 px-2 dark:border-white/[0.08]">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  const count = tab.key === "saved" ? saved.length : recent.length;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold transition-colors",
                        isActive
                          ? "text-indigo-600 dark:text-indigo-300"
                          : "text-slate-800 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      {tab.key === "saved" ? <Bookmark className="size-3.5" /> : <Clock className="size-3.5" />}
                      {tab.label}
                      {count > 0 ? (
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          {count}
                        </span>
                      ) : null}
                      {isActive ? (
                        <motion.span
                          layoutId="compact-bar-tab-underline"
                          className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="max-h-[22rem] space-y-3 overflow-y-auto p-3">
                <QueryHistoryList
                  entries={entries}
                  activeTab={activeTab}
                  kindLabel={kindLabel}
                  onSelectQuery={(entry) => {
                    setActiveTab(null);
                    onSelectQuery(entry);
                  }}
                  onToggleSaved={toggleSaved}
                  onRemove={remove}
                />
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
