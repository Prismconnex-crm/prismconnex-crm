'use client';

import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { FindShowCard } from '@/components/find-shows/find-show-card';
import { FindShowsEmptyState } from '@/components/find-shows/find-shows-empty-state';
import type { FindShowAsset, FindShowEvent } from '@/types/find-shows';

export function FindShowGrid({
  events,
  assets,
  searchQuery,
  resultsKey,
  getDetailHref,
  visibleCount,
  totalCount,
  onLoadMore,
  onClearFilters,
}: {
  events: FindShowEvent[];
  assets: Record<string, FindShowAsset>;
  /** Active free-text query, highlighted inside each card. */
  searchQuery: string;
  /**
   * Identifies the current result set (query + filters). The grid re-enters
   * only when it changes, so Load More appends cards instead of remounting and
   * re-animating the ones already on screen.
   */
  resultsKey: string;
  getDetailHref: (slug: string) => string;
  visibleCount: number;
  totalCount: number;
  onLoadMore: () => void;
  onClearFilters: () => void;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {events.length ? (
          <motion.div
            key={resultsKey}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
          >
            {events.map((event, index) => (
              <motion.div
                key={event.slug}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                // Stagger within each page of 12 so appended cards don't wait
                // behind the ones already shown.
                transition={{ duration: 0.3, delay: (index % 12) * 0.04 }}
                className="h-full"
              >
                <FindShowCard
                  event={event}
                  asset={assets[event.slug]}
                  searchQuery={searchQuery}
                  detailHref={getDetailHref(event.slug)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <FindShowsEmptyState searchQuery={searchQuery} onClear={onClearFilters} />
          </motion.div>
        )}
      </AnimatePresence>

      {events.length && visibleCount < totalCount ? (
        <div className="mt-10 flex justify-center">
          <Button size="lg" className="w-full max-w-xs rounded-full" onClick={onLoadMore}>
            Load More
          </Button>
        </div>
      ) : null}
    </MotionConfig>
  );
}
