"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The collapsible left-rail filter section, lifted out of the Companies tab so
 * both surfaces share one look. The Companies rail is single-select and driven
 * by API params; this adds multi-select with counts on top of the same shell.
 */
export function FilterAccordion({
  label,
  isOpen,
  onToggle,
  summary,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Short badge showing what's applied, e.g. "Europe +2". */
  summary?: string | null;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] border transition-colors",
        isOpen
          ? "border-indigo-300 bg-white shadow-sm dark:border-indigo-500/30 dark:bg-[#0E1830]"
          : "border-slate-200 bg-slate-50 hover:border-indigo-200 dark:border-[#22304A] dark:bg-[#0B1220] dark:hover:border-indigo-500/30"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex h-10 w-full items-center justify-between gap-2 px-3 text-[13px] font-medium text-slate-700 transition-colors [font-family:var(--font-inter),'Inter',sans-serif] dark:text-slate-200"
      >
        <span className="truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {summary ? (
            <span className="max-w-[110px] truncate rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              {summary}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "size-4 text-slate-400 transition-transform duration-200",
              isOpen && "rotate-180 text-indigo-500"
            )}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200 p-2 dark:border-[#22304A]">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export type FacetOption = { value: string; count: number };

/**
 * Multi-select option list with live counts. Long lists (countries, cities,
 * organizers) get a filter box and a "show more" step rather than a 200-row
 * scroller.
 */
export function FacetOptionList({
  options,
  selected,
  onToggle,
  searchPlaceholder,
  emptyLabel = "No matches under the current filters.",
  initialVisible = 12,
}: {
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  searchPlaceholder?: string;
  emptyLabel?: string;
  initialVisible?: number;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    // Selected values stay pinned to the top so they never scroll out of reach
    // once the counts shift underneath them.
    const matching = term
      ? options.filter((option) => option.value.toLowerCase().includes(term))
      : options;
    const chosen = matching.filter((option) => selected.includes(option.value));
    const rest = matching.filter((option) => !selected.includes(option.value));
    return [...chosen, ...rest];
  }, [options, query, selected]);

  const visible = expanded || query.trim() ? filtered : filtered.slice(0, initialVisible);
  const hiddenCount = filtered.length - visible.length;

  return (
    <div className="space-y-2">
      {searchPlaceholder ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-[9px] border border-slate-200 bg-slate-50 pl-9 pr-3 text-[12px] text-slate-900 outline-none focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white"
          />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="px-3 py-3 text-center text-[12px] text-slate-400 dark:text-slate-500">
          {emptyLabel}
        </p>
      ) : (
        <div className="max-h-60 space-y-0.5 overflow-y-auto">
          {visible.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggle(option.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[12px] font-medium transition-colors",
                  isSelected
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                    isSelected
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-slate-300 dark:border-[#33436B]"
                  )}
                >
                  {isSelected ? <Check className="size-3" /> : null}
                </span>
                <span className="flex-1 truncate">{option.value}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                  {option.count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-[9px] py-1.5 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
        >
          Show {hiddenCount.toLocaleString()} more
        </button>
      ) : null}
    </div>
  );
}
