"use client";

import { Heart, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FindShowEvent } from '@/types/find-shows';

/**
 * Compact event rows for a chat answer.
 *
 * Deliberately not EventsResultsTable: that component owns pagination, a chip
 * row and clear-all, all of which would duplicate what the message and the rail
 * already show.
 */
export function EventsInlineRows({
  events,
  likedIds,
  targetIds,
  onToggleLike,
  onToggleTarget,
}: {
  events: FindShowEvent[];
  likedIds: ReadonlySet<string>;
  targetIds: ReadonlySet<string>;
  onToggleLike: (slug: string) => void;
  onToggleTarget: (slug: string) => void;
}) {
  if (events.length === 0) {
    return (
      <p className="px-3 py-4 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
        No trade shows match — try widening the dates or dropping a category.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[#E2E8F0] dark:divide-[#22304A]">
      {events.map((event) => (
        <li key={event.slug} className="flex items-center gap-3 px-3 py-2.5">
          {event.seedAsset.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.seedAsset.logoUrl}
              alt=""
              className="h-7 w-7 shrink-0 rounded object-contain"
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#F1F5F9] text-[11px] font-semibold text-[#475569] dark:bg-[#1B2942] dark:text-[#94A3B8]">
              {event.name.slice(0, 2).toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[#0F172A] dark:text-[#E2E8F0]">
              {event.name}
            </p>
            <p className="truncate text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              {event.city}, {event.country} · {event.displayDate} · {event.primaryCategory}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleLike(event.slug)}
            aria-label={likedIds.has(event.slug) ? 'Unlike' : 'Like'}
            className="shrink-0 p-1"
          >
            <Heart
              className={cn(
                'h-4 w-4',
                likedIds.has(event.slug) ? 'fill-[#E11D48] text-[#E11D48]' : 'text-[#94A3B8]'
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => onToggleTarget(event.slug)}
            aria-label={targetIds.has(event.slug) ? 'Remove target' : 'Add target'}
            className="shrink-0 p-1"
          >
            <Target
              className={cn(
                'h-4 w-4',
                targetIds.has(event.slug) ? 'text-[#1B6DFF]' : 'text-[#94A3B8]'
              )}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
