"use client";

import { motion } from "framer-motion";
import { Building2, CalendarDays, ExternalLink, MapPin, Sparkles, X } from "lucide-react";
import type { EventResult } from "@/models/event-query";

type EventResultsPanelProps = {
  query: string;
  answer: string;
  events: EventResult[];
  totalMatched: number;
  onClear: () => void;
};

function isUsableWebsite(website: string) {
  return /^https?:\/\//i.test(website.trim());
}

export function EventResultsPanel({
  query,
  answer,
  events,
  totalMatched,
  onClear,
}: EventResultsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]"
    >
      <div className="flex items-start gap-3 border-b border-slate-200 p-4 dark:border-[#22304A]">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-slate-900 dark:text-white">{answer}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            Trade shows matching &ldquo;{query}&rdquo;
          </p>
        </div>
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-[8px] border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-[#16233A]"
        >
          <X className="size-3" />
          Clear
        </button>
      </div>

      {events.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <CalendarDays className="mx-auto size-10 text-slate-400 dark:text-slate-500" />
          <p className="mt-3 text-[13px] font-semibold text-slate-900 dark:text-white">
            No matching shows
          </p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            Try a broader location, or drop the date range.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-[#22304A]">
          {events.map((event) => (
            <div
              key={event.slug}
              className="flex flex-col gap-2 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-[#16233A] sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                  {event.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {event.venue && event.venue !== "?" ? `${event.venue}, ` : ""}
                    {event.city}, {event.country}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {event.displayDate}
                  </span>
                  {event.organizer && event.organizer !== "?" ? (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="size-3" />
                      {event.organizer}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {event.primaryCategory}
                </span>
                {isUsableWebsite(event.website) ? (
                  <a
                    href={event.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-[8px] border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-[#0B1220]"
                  >
                    <ExternalLink className="size-3" />
                    Site
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalMatched > events.length ? (
        <div className="border-t border-slate-200 px-4 py-2.5 text-center text-[11px] text-slate-500 dark:border-[#22304A] dark:text-slate-400">
          Showing {events.length} of {totalMatched} matches — narrow the search for more specific
          results.
        </div>
      ) : null}
    </motion.div>
  );
}
