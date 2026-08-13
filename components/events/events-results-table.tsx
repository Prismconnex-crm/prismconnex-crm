"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Check, Heart, MapPin, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/search/filter-chips";
import type { EventFilterChip } from "@/lib/events/chips";
import type { FindShowEvent } from "@/types/find-shows";

/**
 * Results table for the Events Explorer. Same seven columns and same row markup
 * the page has always had; the empty state shows the applied filters as chips
 * so a dead end can be undone in one click instead of a hunt through the rail.
 *
 * It renders flush — no card of its own — because it now sits inside the
 * right-hand search panel, under the pinned bar and chips row.
 */
export function EventsResultsTable({
  events,
  totalMatched,
  page,
  pageSize,
  onPageChange,
  likedIds,
  targetIds,
  onToggleLike,
  onToggleTarget,
  chips,
  onRemoveChip,
  onClearAll,
}: {
  events: FindShowEvent[];
  totalMatched: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  likedIds: ReadonlySet<string>;
  targetIds: ReadonlySet<string>;
  onToggleLike: (slug: string) => void;
  onToggleTarget: (slug: string) => void;
  chips: EventFilterChip[];
  onRemoveChip: (chipId: string) => void;
  onClearAll: () => void;
}) {
  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const firstShown = totalMatched === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = (page - 1) * pageSize + events.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex min-h-0 flex-col"
    >
      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <SearchX className="size-10 text-slate-400 dark:text-slate-500" />
          <div className="space-y-1">
            <p className="text-[15px] font-bold text-slate-900 dark:text-white">
              No events match these filters
            </p>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              Remove one of the filters below to widen the search.
            </p>
          </div>
          <FilterChips
            chips={chips}
            onRemove={(chip) => onRemoveChip(chip.id)}
            className="justify-center"
            emptyLabel="No filters are applied — the catalog itself is empty."
          />
          {chips.length > 0 ? (
            <button
              type="button"
              onClick={onClearAll}
              className="mt-1 inline-flex h-9 items-center rounded-[10px] bg-indigo-600 px-4 text-[12px] font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
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
                        type="button"
                        aria-label={isLiked ? "Unlike event" : "Like event"}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onToggleLike(event.slug);
                        }}
                        className="group/heart relative p-1 transition-transform active:scale-75"
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
                        {event.seedAsset.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={event.seedAsset.logoUrl} alt="" className="size-full object-contain" />
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
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onToggleTarget(event.slug);
                        }}
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

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-[#22304A] dark:bg-[#0B1220]/50 dark:text-[#9CA3AF]">
        <span>
          Showing {firstShown}–{lastShown} of {totalMatched.toLocaleString()} events
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
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
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-[#E5E7EB] dark:hover:bg-[#16233A]"
          >
            Next
          </button>
        </div>
      </div>
    </motion.div>
  );
}
