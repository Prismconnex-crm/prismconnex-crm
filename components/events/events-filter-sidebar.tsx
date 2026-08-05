"use client";

import { useEffect, useState } from "react";
import { Heart, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacetOptionList, FilterAccordion } from "@/components/search/filter-accordion";
import { formatDateRange } from "@/lib/events/chips";
import { dateRangeForPreset, matchDatePreset, type EventFacets } from "@/lib/events/filters";
import {
  EVENT_DATE_PRESETS,
  hasAnyEventFilter,
  type EventFilterListKey,
  type EventFilters,
} from "@/types/events";

type SectionKey = EventFilterListKey | "dates";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "regions", label: "Region" },
  { key: "countries", label: "Country" },
  { key: "cities", label: "City / Venue" },
  { key: "categories", label: "Category" },
  { key: "dates", label: "Date range" },
  { key: "organizers", label: "Organizer" },
  { key: "keywords", label: "Keywords" },
];

function summarise(values: string[]): string | null {
  if (values.length === 0) return null;
  return values.length === 1 ? values[0] : `${values[0]} +${values.length - 1}`;
}

/**
 * The left rail. Renders straight from the shared `EventFilters` in the URL, so
 * it shows the same state whether the user clicked a checkbox or the assistant
 * set it from a sentence.
 */
export function EventsFilterSidebar({
  filters,
  search,
  facets,
  resultCount,
  onFiltersChange,
  onSearchChange,
  onClear,
}: {
  filters: EventFilters;
  search: string;
  facets: EventFacets;
  resultCount: number;
  onFiltersChange: (next: EventFilters) => void;
  onSearchChange: (next: string) => void;
  onClear: () => void;
}) {
  const [openSection, setOpenSection] = useState<SectionKey | null>("regions");
  // Held locally so the comma-separated text stays editable mid-typing.
  const [keywordDraft, setKeywordDraft] = useState(filters.keywords.join(", "));

  useEffect(() => {
    setKeywordDraft(filters.keywords.join(", "));
  }, [filters.keywords]);

  const activePreset = matchDatePreset(filters);
  const isDirty = hasAnyEventFilter(filters) || search.trim().length > 0;

  const toggleValue = (key: EventFilterListKey, value: string) => {
    const current = filters[key];
    onFiltersChange({
      ...filters,
      [key]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };

  const commitKeywords = (raw: string) => {
    const keywords = raw
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
    onFiltersChange({ ...filters, keywords });
  };

  const summaryFor = (key: SectionKey): string | null => {
    if (key === "dates") return formatDateRange(filters.dateFrom, filters.dateTo) || null;
    return summarise(filters[key]);
  };

  return (
    <div className="flex h-full flex-col rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search events by name, city, or venue..."
          className="h-10 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-10 pr-9 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white dark:placeholder:text-slate-500"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {resultCount.toLocaleString()} matching
        </span>
        {isDirty ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-red-200 hover:text-red-600 dark:border-[#22304A] dark:text-slate-300 dark:hover:border-red-500/30 dark:hover:text-red-400"
          >
            <X className="size-3" />
            Clear all
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onFiltersChange({ ...filters, favouritesOnly: !filters.favouritesOnly })}
        className={cn(
          "mt-3 inline-flex h-10 w-full items-center gap-2 rounded-[10px] border px-3 text-[13px] font-semibold transition-all",
          filters.favouritesOnly
            ? "border-transparent bg-red-500 text-white shadow-lg shadow-red-500/20"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-red-300 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:border-red-500/50"
        )}
      >
        <Heart
          className={cn(
            "size-4 transition-transform",
            filters.favouritesOnly ? "scale-110 fill-white" : "text-red-500"
          )}
        />
        Favourites only
      </button>

      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {SECTIONS.map((section) => (
          <FilterAccordion
            key={section.key}
            label={section.label}
            isOpen={openSection === section.key}
            onToggle={() => setOpenSection(openSection === section.key ? null : section.key)}
            summary={summaryFor(section.key)}
          >
            {section.key === "dates" ? (
              <div className="space-y-3 p-1">
                <div className="grid grid-cols-2 gap-1.5">
                  {EVENT_DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        const range = dateRangeForPreset(preset.id);
                        onFiltersChange(
                          activePreset === preset.id
                            ? { ...filters, dateFrom: null, dateTo: null }
                            : { ...filters, ...range }
                        );
                      }}
                      className={cn(
                        "rounded-[9px] border px-2 py-2 text-[11px] font-semibold transition-colors",
                        activePreset === preset.id
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400/50 dark:bg-indigo-500/10 dark:text-indigo-300"
                          : "border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-[#22304A] dark:text-slate-300"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      From
                    </span>
                    <input
                      type="date"
                      value={filters.dateFrom ?? ""}
                      onChange={(event) =>
                        onFiltersChange({ ...filters, dateFrom: event.target.value || null })
                      }
                      className="h-9 w-full rounded-[9px] border border-slate-200 bg-slate-50 px-2 text-[12px] text-slate-900 outline-none focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      To
                    </span>
                    <input
                      type="date"
                      value={filters.dateTo ?? ""}
                      onChange={(event) =>
                        onFiltersChange({ ...filters, dateTo: event.target.value || null })
                      }
                      className="h-9 w-full rounded-[9px] border border-slate-200 bg-slate-50 px-2 text-[12px] text-slate-900 outline-none focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white"
                    />
                  </label>
                </div>
              </div>
            ) : section.key === "keywords" ? (
              <div className="space-y-2 p-1">
                <input
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onBlur={(event) => commitKeywords(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitKeywords(keywordDraft);
                    }
                  }}
                  placeholder="robotics, hydrogen, packaging"
                  className="h-9 w-full rounded-[9px] border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Comma separated. Every term must appear in the event.
                </p>
              </div>
            ) : (
              <FacetOptionList
                options={facets[section.key]}
                selected={filters[section.key]}
                onToggle={(value) => toggleValue(section.key as EventFilterListKey, value)}
                searchPlaceholder={
                  section.key === "regions" || section.key === "categories"
                    ? undefined
                    : `Search ${section.label.toLowerCase()}...`
                }
              />
            )}
          </FilterAccordion>
        ))}
      </div>
    </div>
  );
}
