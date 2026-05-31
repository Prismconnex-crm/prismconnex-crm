'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { BadgeCheck, Globe2, ImageIcon } from 'lucide-react';
import { FindShowsHero } from '@/components/find-shows/find-shows-hero';
import { FindShowsFilterBar } from '@/components/find-shows/find-shows-filter-bar';
import { FindShowGrid } from '@/components/find-shows/find-show-grid';
import { localizePathname } from '@/lib/locale';
import type { Locale } from '@/types';
import type {
  FindShowAsset,
  FindShowEvent,
  FindShowFilterOption,
  FindShowFilters,
  FindShowsCategory,
} from '@/types/find-shows';

const initialFilters: FindShowFilters = {
  query: '',
  region: 'All Regions',
  country: '',
  category: 'All Categories',
  startMonth: '',
  endMonth: '',
};


function buildSeedAssetMap(events: FindShowEvent[]) {
  return Object.fromEntries(
    events
      .filter(
        (event) =>
          event.seedAsset.eventseyeUrl || event.seedAsset.bannerUrl || event.seedAsset.logoUrl
      )
      .map((event) => [event.slug, event.seedAsset])
  ) as Record<string, FindShowAsset>;
}

export function FindShowsPage({
  events,
  categories,
  stats,
}: {
  events: FindShowEvent[];
  categories: FindShowFilterOption<FindShowsCategory>[];
  stats: {
    totalEvents: number;
    countries: number;
    years: number;
  };
}) {
  const locale = useLocale() as Locale;
  const [filters, setFilters] = useState(initialFilters);
  const [visibleCount, setVisibleCount] = useState(12);
  const [likedEventSlugs, setLikedEventSlugs] = useState<string[]>([]);
  const [likesLoaded, setLikesLoaded] = useState(false);
  const [assets, setAssets] = useState<Record<string, FindShowAsset>>(() =>
    buildSeedAssetMap(events)
  );
  const deferredQuery = useDeferredValue(filters.query);

  useEffect(() => {
    const storedValue = window.localStorage.getItem('likedEvents');
    if (!storedValue) {
      setLikesLoaded(true);
      return;
    }

    try {
      const parsedValue = JSON.parse(storedValue);
      if (Array.isArray(parsedValue)) {
        setLikedEventSlugs(parsedValue.filter((item): item is string => typeof item === 'string'));
      }
    } catch {
      window.localStorage.removeItem('likedEvents');
    }

    setLikesLoaded(true);
  }, []);

  useEffect(() => {
    if (!likesLoaded) {
      return;
    }

    window.localStorage.setItem('likedEvents', JSON.stringify(likedEventSlugs));
  }, [likedEventSlugs, likesLoaded]);

  useEffect(() => {
    setVisibleCount(12);
  }, [
    deferredQuery,
    filters.region,
    filters.country,
    filters.category,
    filters.startMonth,
    filters.endMonth,
  ]);

  const filteredEvents = events.filter((event) => {
    if (deferredQuery.trim() && !event.searchText.includes(deferredQuery.trim().toLowerCase())) {
      return false;
    }

    if (filters.region !== 'All Regions' && event.region !== filters.region) {
      return false;
    }

    if (filters.country && event.country !== filters.country) {
      return false;
    }

    if (filters.country && event.country !== filters.country) {
      return false;
    }

    if (filters.category !== 'All Categories' && !event.categories.includes(filters.category)) {
      return false;
    }

    if (filters.startMonth && event.startMonth < filters.startMonth) {
      return false;
    }

    if (filters.endMonth && event.startMonth > filters.endMonth) {
      return false;
    }

    return true;
  });

  const visibleEvents = filteredEvents.slice(0, visibleCount);

  useEffect(() => {
    const pendingSlugs = visibleEvents.map((event) => event.slug).filter((slug) => !assets[slug]);

    if (!pendingSlugs.length) {
      return;
    }

    const controller = new AbortController();

    fetch('/api/find-shows/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs: pendingSlugs }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch live Eventseye assets.');
        }
        return response.json();
      })
      .then((payload: Record<string, FindShowAsset>) => {
        setAssets((currentAssets) => ({
          ...currentAssets,
          ...payload,
        }));
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') {
          console.error(error);
        }
      });

    return () => controller.abort();
  }, [assets, visibleEvents]);

  const activeFilterCount =
    Number(filters.region !== 'All Regions') +
    Number(Boolean(filters.country)) +
    Number(filters.category !== 'All Categories');

  const displayedEventCount = Math.min(visibleCount, filteredEvents.length);

  const heroStats = [
    { value: stats.totalEvents, suffix: '+', label: 'Trade Shows' },
    { value: stats.countries, suffix: '', label: 'Countries' },
    { value: stats.years, suffix: '', label: 'Event Years' },
    { value: 100, suffix: '%', label: 'Media Coverage' },
  ];

  return (
    <div className="relative min-h-screen">
      <FindShowsHero
        searchQuery={filters.query}
        onSearchQueryChange={(value) =>
          setFilters((currentFilters) => ({ ...currentFilters, query: value }))
        }
        stats={heroStats}
      />

      <FindShowsFilterBar
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
        activeFilterCount={activeFilterCount}
        onClear={() => setFilters(initialFilters)}
      />

      <section className="px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Showing {displayedEventCount} of {filteredEvents.length} events
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white md:text-3xl">
                Worldwide trade shows
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300">
                <Globe2 className="size-3.5 text-indigo-500" />
                {stats.countries} countries available
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300">
                <BadgeCheck className="size-3.5 text-emerald-500" />
                {stats.totalEvents}+ total events
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300">
                <ImageIcon className="size-3.5 text-cyan-500" />
                Eventseye media + fallbacks
              </span>
            </div>
          </motion.div>

          <FindShowGrid
            events={visibleEvents}
            assets={assets}
            getDetailHref={(slug) => localizePathname(`/find-shows/${slug}`, locale)}
            visibleCount={displayedEventCount}
            totalCount={filteredEvents.length}
            onLoadMore={() => setVisibleCount((currentCount) => currentCount + 12)}
            onClearFilters={() => setFilters(initialFilters)}
          />
        </div>
      </section>
    </div>
  );
}
