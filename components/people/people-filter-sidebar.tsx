"use client";

import { useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacetOptionList, FilterAccordion } from "@/components/search/filter-accordion";
import type { PeopleFacets } from "@/lib/people/filters";
import { INTENT_LABELS, SOURCE_LABELS, VERIFICATION_LABELS } from "@/lib/people/vocabulary";
import {
  CONFIDENCE_THRESHOLDS,
  VERIFICATION_STATUSES,
  hasAnyPeopleFilter,
  type ConfidenceThreshold,
  type PeopleFilterListKey,
  type PeopleFilters,
  type Person,
  type VerificationStatus,
} from "@/types/people";

/**
 * The left rail. Renders straight from the shared `PeopleFilters` in the URL,
 * so it shows the same state whether the user ticked a box or the assistant set
 * it from a sentence.
 */

type SectionKey =
  | "lookalikes"
  | "verification"
  | "confidence"
  | PeopleFilterListKey;

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "lookalikes", label: "AI Lookalikes" },
  { key: "verification", label: "Verification Status" },
  { key: "confidence", label: "Confidence Score" },
  { key: "sources", label: "Data Source" },
  { key: "titles", label: "Job Title" },
  { key: "seniorities", label: "Seniority" },
  { key: "departments", label: "Department" },
  { key: "companies", label: "Company" },
  { key: "locations", label: "Location" },
  { key: "countries", label: "Country" },
  { key: "headcounts", label: "Employee Headcount" },
  { key: "industries", label: "Industry" },
  { key: "keywords", label: "Keywords" },
  { key: "buyingIntents", label: "Buying Intent" },
];

/** Which sections get a search box — the long, open vocabularies. */
const SEARCHABLE: Partial<Record<PeopleFilterListKey, boolean>> = {
  titles: true,
  companies: true,
  locations: true,
  countries: true,
  industries: true,
  keywords: true,
};

function summarise(values: string[], label: (value: string) => string): string | null {
  if (values.length === 0) return null;
  return values.length === 1 ? label(values[0]) : `${label(values[0])} +${values.length - 1}`;
}

export function PeopleFilterSidebar({
  filters,
  facets,
  resultCount,
  lookalikeSeed,
  onFiltersChange,
  onClear,
}: {
  filters: PeopleFilters;
  facets: PeopleFacets;
  resultCount: number;
  lookalikeSeed: Person | null;
  onFiltersChange: (next: PeopleFilters) => void;
  onClear: () => void;
}) {
  const [openSection, setOpenSection] = useState<SectionKey | null>("verification");

  const activeCount =
    (Object.keys(filters) as (keyof PeopleFilters)[]).reduce((count, key) => {
      const value = filters[key];
      if (Array.isArray(value)) return count + value.length;
      if (key === "search") return count + (String(value).trim() ? 1 : 0);
      return count + (value === null ? 0 : 1);
    }, 0);

  const toggleValue = (key: PeopleFilterListKey, value: string) => {
    const current = filters[key];
    onFiltersChange({
      ...filters,
      [key]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };

  const labelFor = (key: SectionKey, value: string): string => {
    if (key === "sources") return SOURCE_LABELS[value] ?? value;
    if (key === "buyingIntents") return INTENT_LABELS[value] ?? value;
    return value;
  };

  const summaryFor = (key: SectionKey): string | null => {
    if (key === "lookalikes") {
      return lookalikeSeed ? `${lookalikeSeed.firstName} ${lookalikeSeed.lastName}` : null;
    }
    if (key === "verification") {
      return filters.verification ? VERIFICATION_LABELS[filters.verification] : null;
    }
    if (key === "confidence") {
      return filters.minConfidence !== null ? `≥${filters.minConfidence}%` : null;
    }
    return summarise(filters[key], (value) => labelFor(key, value));
  };

  const isDirty = hasAnyPeopleFilter(filters);

  return (
    <div className="flex h-full flex-col rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          placeholder="Search people, or ask about contacts..."
          className="h-10 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-10 pr-9 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white dark:placeholder:text-slate-500"
        />
        {filters.search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onFiltersChange({ ...filters, search: "" })}
            className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
        Press Enter to ask — e.g. &ldquo;verified marketing managers in Germany&rdquo;
      </p>

      {/* "All" chip row — mirrors the Companies rail. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
            !isDirty
              ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-[#0B1220]"
              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-slate-900 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-300 dark:hover:text-white"
          )}
        >
          All
        </button>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {resultCount.toLocaleString()} matching
        </span>
      </div>

      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {SECTIONS.map((section) => (
          <FilterAccordion
            key={section.key}
            label={section.label}
            isOpen={openSection === section.key}
            onToggle={() => setOpenSection(openSection === section.key ? null : section.key)}
            summary={summaryFor(section.key)}
          >
            {section.key === "lookalikes" ? (
              <div className="space-y-2 p-1">
                {lookalikeSeed ? (
                  <>
                    <div className="flex items-center gap-2 rounded-[9px] border border-indigo-200 bg-indigo-50 px-2.5 py-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                      <Sparkles className="size-3.5 shrink-0 text-indigo-500" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-indigo-700 dark:text-indigo-300">
                        {lookalikeSeed.firstName} {lookalikeSeed.lastName} · {lookalikeSeed.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, lookalikeSeedId: null })}
                      className="w-full rounded-[9px] py-1.5 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                    >
                      Clear lookalike seed
                    </button>
                  </>
                ) : (
                  <p className="px-3 py-3 text-center text-[12px] text-slate-400 dark:text-slate-500">
                    Open a contact and choose &ldquo;Find similar&rdquo; to rank everyone by how
                    closely they match.
                  </p>
                )}
              </div>
            ) : section.key === "verification" ? (
              <div className="space-y-1 p-1">
                {([null, ...VERIFICATION_STATUSES] as (VerificationStatus | null)[]).map(
                  (status) => {
                    const isSelected = filters.verification === status;
                    const count =
                      status === null
                        ? facets.verification.reduce((sum, option) => sum + option.count, 0)
                        : (facets.verification.find((option) => option.value === status)?.count ?? 0);
                    return (
                      <button
                        key={status ?? "all"}
                        type="button"
                        onClick={() => onFiltersChange({ ...filters, verification: status })}
                        className={cn(
                          "flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-left text-[12px] font-medium transition-colors",
                          isSelected
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                        )}
                      >
                        <span>{status === null ? "All" : VERIFICATION_LABELS[status]}</span>
                        <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {count.toLocaleString()}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            ) : section.key === "confidence" ? (
              <div className="flex flex-wrap gap-1.5 p-1">
                {([null, ...CONFIDENCE_THRESHOLDS] as (ConfidenceThreshold | null)[]).map(
                  (threshold) => {
                    const isSelected = filters.minConfidence === threshold;
                    return (
                      <button
                        key={threshold ?? "any"}
                        type="button"
                        onClick={() => onFiltersChange({ ...filters, minConfidence: threshold })}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400/50 dark:bg-indigo-500/10 dark:text-indigo-300"
                            : "border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-[#22304A] dark:text-slate-300"
                        )}
                      >
                        {threshold === null ? "Any" : `≥${threshold}%`}
                      </button>
                    );
                  }
                )}
              </div>
            ) : section.key === "sources" || section.key === "buyingIntents" ? (
              // These two carry enum values (`licensed_dataset`, `high`), and
              // FacetOptionList renders `option.value` verbatim with no label
              // hook — so they get the same inline list Verification uses.
              <div className="space-y-1 p-1">
                {facets[section.key].map((option) => {
                  // The narrowing on `section.key` does not survive into this
                  // callback, so the key is re-asserted the same way it is for
                  // `toggleValue` below.
                  const isSelected = filters[section.key as PeopleFilterListKey].includes(
                    option.value
                  );
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(section.key as PeopleFilterListKey, option.value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-left text-[12px] font-medium transition-colors",
                        isSelected
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                      )}
                    >
                      <span>{labelFor(section.key, option.value)}</span>
                      <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                        {option.count.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <FacetOptionList
                options={facets[section.key].map((option) => ({
                  value: option.value,
                  count: option.count,
                }))}
                selected={filters[section.key]}
                onToggle={(value) => toggleValue(section.key as PeopleFilterListKey, value)}
                searchPlaceholder={
                  SEARCHABLE[section.key as PeopleFilterListKey]
                    ? `Search ${section.label.toLowerCase()}...`
                    : undefined
                }
              />
            )}
          </FilterAccordion>
        ))}
      </div>

      {/* Sticky footer inside the panel. */}
      <div className="-mx-4 -mb-4 mt-3 flex items-center justify-between gap-2 rounded-b-[14px] border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#22304A] dark:bg-[#0B1220]">
        <button
          type="button"
          onClick={onClear}
          disabled={!isDirty}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
            isDirty
              ? "border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600 dark:border-[#22304A] dark:text-slate-300 dark:hover:border-red-500/30 dark:hover:text-red-400"
              : "cursor-not-allowed border-slate-200 text-slate-300 dark:border-[#22304A] dark:text-slate-600"
          )}
        >
          <X className="size-3" />
          Clear all
        </button>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {activeCount} active {activeCount === 1 ? "filter" : "filters"}
        </span>
      </div>
    </div>
  );
}
