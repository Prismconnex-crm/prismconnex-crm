'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { BadgeCheck, Globe2 } from 'lucide-react';
import { FindShowsHero } from '@/components/find-shows/find-shows-hero';
import { FindShowsFilterBar } from '@/components/find-shows/find-shows-filter-bar';
import { FindShowGrid } from '@/components/find-shows/find-show-grid';
import { eventYears } from '@/lib/find-shows/date-range';
import { searchFindShowEvents } from '@/lib/find-shows/search-events';
import { localizePathname, stripLocaleFromPathname } from '@/lib/locale';
import { createResultsHistory, type ResultsHistory } from '@/lib/find-shows/results-history';
import { DEFAULT_FILTERS, PAGE_SIZE, scrollStorageKey } from '@/lib/find-shows/results-state';
import type { Locale } from '@/types';
import type {
  FindShowAsset,
  FindShowEvent,
  FindShowFilterOption,
  FindShowFilters,
  FindShowsCategory,
} from '@/types/find-shows';

const initialFilters: FindShowFilters = DEFAULT_FILTERS;


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
  const resultsRef = useRef<HTMLElement>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Where to scroll once the results read from the address are on screen; a new object each time, so
  // returning to the same position twice still scrolls.
  const [scrollTarget, setScrollTarget] = useState<{ top: number } | null>(null);
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

  const historyRef = useRef<ResultsHistory | null>(null);
  const resultsHistory = () => (historyRef.current ??= createResultsHistory(window));

  // A filter action is a navigation: it starts the grid again from its first page and becomes its own
  // history entry, so Back steps through Europe → Germany → … one state at a time.
  const changeFilters = (update: SetStateAction<FindShowFilters>) => {
    const nextFilters = typeof update === 'function' ? update(filters) : update;
    setFilters(nextFilters);
    setVisibleCount(PAGE_SIZE);
    resultsHistory().commit({ filters: nextFilters, visibleCount: PAGE_SIZE });
  };

  // Shows the results state in the address, scrolled to where the visitor left that address.
  const applyAddress = () => {
    const { pathname, search } = window.location;
    const state = resultsHistory().read();
    setFilters(state.filters);
    setVisibleCount(state.visibleCount);
    const savedScroll = Number(window.sessionStorage.getItem(scrollStorageKey(pathname, search)));
    setScrollTarget(savedScroll > 0 ? { top: savedScroll } : null);
  };

  // The address is the source of truth: read once mounted (a fresh load, a shared link, or Back from an
  // event page, which remounts this page) — like EventTabs, so the server render and hydration stay
  // identical — and again on every Back/Forward between results states, which keeps this page mounted.
  useEffect(() => {
    applyAddress();
    const onPopState = () => {
      if (stripLocaleFromPathname(window.location.pathname) === '/find-shows') applyAddress();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember how far down the results the visitor is, per address, for the restore above.
  useEffect(() => {
    const resultsPathname = window.location.pathname;
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // An event page's own scroll-to-top must not overwrite the results position.
        if (window.location.pathname !== resultsPathname) return;
        window.sessionStorage.setItem(
          scrollStorageKey(resultsPathname, window.location.search),
          String(Math.round(window.scrollY))
        );
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', save);
    };
  }, []);

  // deferredQuery keeps typing responsive across the ~11k event catalog: the
  // input updates on every keystroke while the grid re-filters and re-ranks at
  // React's pace.
  const { region, country, category, startMonth, endMonth } = filters;
  const filteredEvents = useMemo(
    () =>
      searchFindShowEvents(events, {
        query: deferredQuery,
        region,
        country,
        category,
        startMonth,
        endMonth,
      }),
    [events, deferredQuery, region, country, category, startMonth, endMonth]
  );

  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount]
  );

  // Scroll back once the restored results are on screen: the deferred query has caught up.
  useEffect(() => {
    if (!scrollTarget || deferredQuery !== filters.query) return;
    setScrollTarget(null);
    requestAnimationFrame(() => window.scrollTo({ top: scrollTarget.top }));
  }, [scrollTarget, deferredQuery, filters.query, visibleEvents]);

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
    Number(filters.category !== 'All Categories') +
    Number(Boolean(filters.startMonth || filters.endMonth));
  // Year choices for the Date Range filter: the years the catalog's events run in.
  const dateRangeYears = useMemo(() => eventYears(events), [events]);

  const displayedEventCount = Math.min(visibleCount, filteredEvents.length);
  // Locale-fixed on both server and client, so the formatted counts hydrate cleanly.
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const resultsKey = JSON.stringify([deferredQuery, region, country, category, startMonth, endMonth]);

  const heroStats = [
    { value: stats.totalEvents, suffix: '+', label: 'Trade Shows' },
    { value: stats.countries, suffix: '', label: 'Countries' },
    { value: stats.years, suffix: '', label: 'Event Years' },
    { value: 100, suffix: '%', label: 'Media Coverage' },
  ];

  return (
    <div className="relative min-h-screen">
      {/* Results already track the input live, so the search button and Enter
          run the same filter and just bring the grid back into view. */}
      <FindShowsHero
        searchQuery={filters.query}
        onSearchQueryChange={(value) => {
          // One typing burst is one history entry (see results-history.ts).
          const nextFilters = { ...filters, query: value };
          setFilters(nextFilters);
          setVisibleCount(PAGE_SIZE);
          resultsHistory().type({ filters: nextFilters, visibleCount: PAGE_SIZE });
        }}
        onSearchSubmit={() => {
          setVisibleCount(PAGE_SIZE);
          resultsHistory().update({ filters, visibleCount: PAGE_SIZE });
          resultsHistory().endTyping();
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        stats={heroStats}
      />

      <FindShowsFilterBar
        categories={categories}
        dateRangeYears={dateRangeYears}
        filters={filters}
        onFiltersChange={changeFilters}
        activeFilterCount={activeFilterCount}
        onClear={() => changeFilters(initialFilters)}
      />

      <section ref={resultsRef} className="scroll-mt-[132px] px-5 py-8 md:px-8 md:py-10 lg:px-6 xl:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p
                aria-live="polite"
                className="text-sm font-medium tabular-nums text-slate-500 dark:text-slate-400"
              >
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {numberFormat.format(filteredEvents.length)}{' '}
                  {filteredEvents.length === 1 ? 'event' : 'events'} found
                </span>
                {filteredEvents.length ? (
                  <> · showing {numberFormat.format(displayedEventCount)}</>
                ) : null}
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white md:text-3xl">
                Worldwide trade shows
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300">
                <Globe2 aria-hidden="true" className="size-3.5 text-indigo-500" />
                {numberFormat.format(stats.countries)} countries available
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300">
                <BadgeCheck aria-hidden="true" className="size-3.5 text-emerald-500" />
                {numberFormat.format(stats.totalEvents)}+ total events
              </span>
            </div>
          </motion.div>

          <FindShowGrid
            events={visibleEvents}
            assets={assets}
            searchQuery={deferredQuery}
            resultsKey={resultsKey}
            getDetailHref={(slug) => localizePathname(`/find-shows/${slug}`, locale)}
            visibleCount={displayedEventCount}
            totalCount={filteredEvents.length}
            onLoadMore={() => {
              // More of the same results, not a navigation: kept in the current entry for Back to restore.
              const nextCount = visibleCount + PAGE_SIZE;
              setVisibleCount(nextCount);
              resultsHistory().update({ filters, visibleCount: nextCount });
            }}
            onClearFilters={() => changeFilters(initialFilters)}
          />
        </div>
      </section>
    </div>
  );
}
