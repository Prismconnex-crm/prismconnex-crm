'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { FindShowCard } from '@/components/find-shows/find-show-card';
import { FindShowsEmptyState } from '@/components/find-shows/find-shows-empty-state';
import type { FindShowAsset, FindShowEvent } from '@/types/find-shows';

export function FindShowGrid({
  events,
  assets,
  getDetailHref,
  visibleCount,
  totalCount,
  onLoadMore,
  onClearFilters,
}: {
  events: FindShowEvent[];
  assets: Record<string, FindShowAsset>;
  getDetailHref: (slug: string) => string;
  visibleCount: number;
  totalCount: number;
  onLoadMore: () => void;
  onClearFilters: () => void;
}) {
  return (
    <>
      <AnimatePresence mode="wait">
        {events.length ? (
          <motion.div
            key={events.map((event) => event.slug).join('|')}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          >
            {events.map((event, index) => (
              <motion.div
                key={event.slug}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
              >
                <FindShowCard
                  event={event}
                  asset={assets[event.slug]}
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
            <FindShowsEmptyState onClear={onClearFilters} />
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
    </>
  );
}
