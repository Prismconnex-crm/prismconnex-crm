"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Bookmark,
  ChevronRight,
  Clock,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FinderChip = {
  label: string;
  value: string;
};

type FinderSearch = {
  id: string;
  when: string;
  kind: string;
  query: string;
  chips: FinderChip[];
};

// Dummy data for now — swap for an API call (e.g. /api/lead-queries) later.
const RECENT_SEARCHES: FinderSearch[] = [
  {
    id: "recent-1",
    when: "a few minutes ago",
    kind: "Lead query",
    query: "Founders and CEOs of funded fintech startups headquartered in India",
    chips: [
      { label: "Title contains", value: "CEO" },
      { label: "Match", value: "strict" },
      { label: "Seniority", value: "C-level" },
      { label: "Region", value: "India" },
    ],
  },
  {
    id: "recent-2",
    when: "an hour ago",
    kind: "Lead query",
    query: "Heads of growth at B2B SaaS companies with 50-200 employees",
    chips: [
      { label: "Title contains", value: "Growth" },
      { label: "Headcount", value: "50-200" },
      { label: "Segment", value: "B2B SaaS" },
    ],
  },
  {
    id: "recent-3",
    when: "yesterday",
    kind: "Lead query",
    query: "Procurement directors in manufacturing across Southeast Asia",
    chips: [
      { label: "Title contains", value: "Procurement" },
      { label: "Industry", value: "Manufacturing" },
      { label: "Region", value: "Southeast Asia" },
    ],
  },
];

const SAVED_SEARCHES: FinderSearch[] = [
  {
    id: "saved-1",
    when: "pinned last week",
    kind: "Lead query",
    query: "VPs of Marketing at enterprise software vendors in North America",
    chips: [
      { label: "Title contains", value: "VP Marketing" },
      { label: "Seniority", value: "VP+" },
      { label: "Region", value: "North America" },
    ],
  },
  {
    id: "saved-2",
    when: "pinned this month",
    kind: "Lead query",
    query: "CTOs at AI-first companies that raised funding in the last 12 months",
    chips: [
      { label: "Title contains", value: "CTO" },
      { label: "Signal", value: "Recently funded" },
      { label: "Focus", value: "AI" },
    ],
  },
];

const FINDER_TABS = [
  { key: "recent", label: "Recent" },
  { key: "saved", label: "Saved" },
] as const;

type FinderTabKey = (typeof FINDER_TABS)[number]["key"];

function SearchCard({ search, tab }: { search: FinderSearch; tab: FinderTabKey }) {
  const [expanded, setExpanded] = useState(false);
  const visibleChips = expanded ? search.chips : search.chips.slice(0, 3);
  const hiddenCount = search.chips.length - visibleChips.length;
  const LeadIcon = tab === "saved" ? Bookmark : Clock;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-[14px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-xl transition-shadow hover:shadow-lg hover:shadow-indigo-500/10 dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:border-indigo-500/30"
    >
      {/* gradient sheen on hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-fuchsia-500/[0.05] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300">
            <LeadIcon className="size-3.5" />
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className="font-medium text-slate-500 dark:text-slate-400">{search.when}</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300">
              {search.kind}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[9px] border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 hover:shadow-indigo-500/20 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300"
        >
          View
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="relative mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Your query
        </p>
        <p className="mt-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {search.query}
        </p>
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
        {visibleChips.map((chip) => (
          <span
            key={`${chip.label}-${chip.value}`}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300"
          >
            <span className="text-slate-400 dark:text-slate-500">{chip.label}:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-100">{chip.value}</span>
          </span>
        ))}
        {hiddenCount > 0 && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="ml-auto text-[11px] font-semibold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Show more
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

export function EnrichedLeadsFinderPanel() {
  const [prompt, setPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<FinderTabKey>("recent");
  const searches = activeTab === "saved" ? SAVED_SEARCHES : RECENT_SEARCHES;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex h-full flex-col overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm dark:border-transparent dark:bg-transparent"
    >
      {/* gradient border + glass base (dark) */}
      <div className="pointer-events-none absolute inset-0 hidden rounded-[16px] bg-gradient-to-br from-cyan-500/40 via-indigo-500/20 to-fuchsia-500/40 p-px dark:block">
        <div className="h-full w-full rounded-[15px] bg-[#0B1220]/90 backdrop-blur-2xl" />
      </div>
      {/* ambient glow blobs */}
      <div className="pointer-events-none absolute -top-24 left-1/2 hidden h-48 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl dark:block" />
      <div className="pointer-events-none absolute -bottom-32 right-0 hidden h-56 w-72 rounded-full bg-cyan-500/10 blur-3xl dark:block" />

      <div className="relative flex h-full flex-col overflow-y-auto p-5 sm:p-7">
        {/* Heading */}
        <div className="mx-auto w-full max-w-2xl pt-2 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-[14px] border border-indigo-200 bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30 dark:border-indigo-400/20">
            <Wand2 className="size-5 text-white" />
          </div>
          <h2 className="mt-4 bg-gradient-to-r from-slate-900 via-indigo-700 to-slate-900 bg-clip-text text-[26px] font-bold tracking-tight text-transparent dark:from-white dark:via-indigo-200 dark:to-white">
            Find anything
          </h2>
          <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
            Describe your ideal buyers in simple terms and we&apos;ll generate a precise lead search.
          </p>
        </div>

        {/* Prompt box */}
        <div className="mx-auto mt-6 w-full max-w-2xl">
          <div className="group relative rounded-[16px] bg-gradient-to-r from-cyan-500/50 via-indigo-500/50 to-fuchsia-500/50 p-px shadow-lg shadow-indigo-500/10 transition-shadow focus-within:shadow-indigo-500/30">
            <div className="relative flex items-start gap-3 rounded-[15px] bg-white p-4 dark:bg-[#0D1526]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={2}
                placeholder="e.g., VP Marketing at B2B SaaS in India with 100+ employees..."
                className="min-h-[48px] w-full resize-none bg-transparent pr-10 text-[13px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                aria-label="Generate lead search"
                className={cn(
                  "absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full transition-all",
                  prompt.trim()
                    ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/40 hover:scale-105"
                    : "bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500"
                )}
              >
                <ArrowUp className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto mt-8 w-full max-w-2xl">
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/[0.08]">
            {FINDER_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold transition-colors",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-300"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  {tab.key === "saved" ? <Bookmark className="size-3.5" /> : <Clock className="size-3.5" />}
                  {tab.label}
                  {isActive ? (
                    <motion.span
                      layoutId="finder-tab-underline"
                      className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Cards */}
          <div className="mt-4 space-y-3 pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {searches.map((search) => (
                  <SearchCard key={search.id} search={search} tab={activeTab} />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
