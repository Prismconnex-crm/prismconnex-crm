"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Check, Heart, MapPin, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventFilters, EventResult } from "@/models/event-query";

export type EventCatalogPanelProps = {
  query: string;
  answer: string;
  filters: EventFilters;
  events: EventResult[];
  totalMatched: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onClear: () => void;
};

/** Chips describing how the query was interpreted, so a misread is obvious. */
function filterChips(filters: EventFilters): string[] {
  const chips: string[] = [];

  const where = [filters.city, filters.country].filter(Boolean).join(", ");
  if (where) chips.push(where);
  else if (filters.region && filters.region !== "All Regions") chips.push(filters.region);

  chips.push(
    filters.category && filters.category !== "All Categories"
      ? filters.category
      : "All Categories"
  );

  if (filters.monthFrom) {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const from = months[filters.monthFrom - 1];
    const to = months[(filters.monthTo ?? filters.monthFrom) - 1];
    chips.push(from === to ? from : `${from}–${to}`);
  }
  if (filters.year) chips.push(String(filters.year));
  if (filters.keyword) chips.push(`"${filters.keyword}"`);
  if (filters.limit) chips.push(`${filters.limit} requested`);

  return chips;
}

export function EventCatalogPanel({
  query,
  answer,
  filters,
  events,
  totalMatched,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onClear,
}: EventCatalogPanelProps) {
  const router = useRouter();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());

  // Same keys the Events page uses, so a like here shows up there.
  useEffect(() => {
    const savedLiked = localStorage.getItem("pc_liked_events");
    const savedTarget = localStorage.getItem("pc_target_events");
    if (savedLiked) {
      try {
        setLikedIds(new Set(JSON.parse(savedLiked)));
      } catch {
        setLikedIds(new Set());
      }
    }
    if (savedTarget) {
      try {
        setTargetIds(new Set(JSON.parse(savedTarget)));
      } catch {
        setTargetIds(new Set());
      }
    }
  }, []);

  const toggleLike = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("pc_liked_events", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleTarget = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("pc_target_events", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const firstShown = totalMatched === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = (page - 1) * pageSize + events.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]"
    >
      {/* Header: Claude's summary + how the query was interpreted */}
      <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#22304A]">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">{answer}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            Trade shows matching &ldquo;{query}&rdquo;
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {filterChips(filters).map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onClear}
          className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-[#16233A]"
        >
          <X className="size-3" />
          Clear
        </button>
      </div>

      {events.length === 0 && !isLoading ? (
        <div className="px-6 py-16 text-center">
          <Calendar className="mx-auto size-10 text-slate-400 dark:text-slate-500" />
          <p className="mt-3 text-[13px] font-bold text-slate-900 dark:text-white">
            No matching shows
          </p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            Try a broader location, or drop the date range.
          </p>
        </div>
      ) : (
        <div className={cn("overflow-x-auto", isLoading && "opacity-50")}>
          <table className="w-full text-left text-[12px]">
            <thead className="bg-slate-50 dark:bg-[#0B1220]">
              <tr className="border-b border-slate-200 text-slate-500 dark:border-[#22304A] dark:text-[#9CA3AF]">
                <th className="w-8 px-4 py-4 text-center text-[10px] font-black uppercase tracking-[0.1em]">❤️</th>
                <th className="w-16 px-4 py-4 text-center text-[10px] font-black uppercase tracking-[0.1em]">Logo</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em]">Event Details</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em]">Location</th>
                <th className="w-32 px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em]">Dates</th>
                <th className="hidden w-32 px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em] md:table-cell">Category</th>
                <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-[0.1em]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#22304A]">
              {events.map((event) => {
                const isLiked = likedIds.has(event.slug);
                const isTargeted = targetIds.has(event.slug);
                return (
                  <tr
                    key={event.slug}
                    onClick={() => router.push(`/app/events/${event.slug}`)}
                    className={cn(
                      "group cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-[#16233A]/40",
                      isTargeted && "bg-indigo-50/20 shadow-inner dark:bg-indigo-500/5"
                    )}
                  >
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={(e) => toggleLike(e, event.slug)}
                        className="group/heart relative p-1 transition-transform active:scale-75"
                        aria-label={isLiked ? "Unlike event" : "Like event"}
                      >
                        <Heart
                          className={cn(
                            "size-5 transition-all duration-300",
                            isLiked
                              ? "scale-110 fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                              : "text-slate-300 group-hover/heart:text-red-400 dark:text-[#22304A]"
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="mx-auto flex size-11 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 transition-transform group-hover:scale-105 dark:border-[#22304A] dark:bg-[#0B1220]">
                        {event.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={event.logoUrl} alt="" className="size-full object-contain" />
                        ) : (
                          <span className="text-[14px] font-black uppercase text-indigo-500/40">
                            {event.name.substring(0, 2)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="line-clamp-1 text-[14px] font-black text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                          {event.name}
                        </span>
                        {event.organizer && event.organizer !== "?" ? (
                          <span className="line-clamp-1 text-[11px] font-bold uppercase tracking-tight text-slate-500 dark:text-[#9CA3AF]">
                            {event.organizer}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-2 text-[12px] font-bold text-slate-600 dark:text-[#E5E7EB]">
                        <MapPin className="size-3.5 text-slate-400 transition-colors group-hover:text-indigo-500" />
                        {event.city}, {event.country}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-2 text-[12px] font-black text-slate-600 dark:text-[#E5E7EB]">
                        <Calendar className="size-3.5 text-indigo-500/60" />
                        {event.displayDate}
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 md:table-cell">
                      <span className="inline-flex rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-[#9CA3AF]">
                        {event.primaryCategory}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => toggleTarget(e, event.slug)}
                        className={cn(
                          "relative h-8 overflow-hidden rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.1em] transition-all",
                          isTargeted
                            ? "border border-indigo-200/50 bg-slate-100 text-indigo-600 dark:bg-[#0B1220] dark:text-indigo-400"
                            : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95"
                        )}
                      >
                        {isTargeted ? (
                          <span className="flex items-center gap-1.5 focus:outline-none">
                            <Check className="size-3" /> Targeted
                          </span>
                        ) : (
                          "Add To target events"
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer: counts + paging */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-[#22304A] dark:bg-[#0B1220]/50 dark:text-[#9CA3AF]">
        <span>
          Showing {firstShown}–{lastShown} of {totalMatched.toLocaleString()} events
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1 || isLoading}
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-[#E5E7EB] dark:hover:bg-[#16233A]"
          >
            Prev
          </button>
          <div className="flex items-center gap-2 text-[14px]">
            <span className="font-black text-indigo-600 dark:text-indigo-400">{page}</span>
            <span className="opacity-20">/</span>
            <span>{totalPages}</span>
          </div>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-[#E5E7EB] dark:hover:bg-[#16233A]"
          >
            Next
          </button>
        </div>
      </div>
    </motion.div>
  );
}
