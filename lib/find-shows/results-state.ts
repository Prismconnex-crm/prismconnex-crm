import type { FindShowFilters, FindShowsCategory, FindShowsRegion } from '@/types/find-shows';

/**
 * The Find Shows results in the page address, so browser Back from an event page lands on the same
 * search, filters and "Load more" depth instead of a blank first page:
 *
 *   /en-US/find-shows?q=bett&region=Europe&country=Germany&category=…&from=2026-01&to=2026-06&shown=36
 *
 * Only values that differ from the defaults are written, so an untouched page keeps its bare address.
 * Scroll position is not part of the address; it is kept per address in sessionStorage.
 */
export const PAGE_SIZE = 12;

export const DEFAULT_FILTERS: FindShowFilters = {
  query: '',
  region: 'All Regions',
  country: '',
  category: 'All Categories',
  startMonth: '',
  endMonth: '',
};

export type FindShowsResultsState = { filters: FindShowFilters; visibleCount: number };

/** Reads the results state from an address's search string; anything missing or malformed falls back to the default. */
export function parseResultsState(search: string): FindShowsResultsState {
  const params = new URLSearchParams(search);
  const shown = Number.parseInt(params.get('shown') ?? '', 10);
  return {
    filters: {
      query: params.get('q') ?? DEFAULT_FILTERS.query,
      region: (params.get('region') || DEFAULT_FILTERS.region) as FindShowsRegion,
      country: params.get('country') ?? DEFAULT_FILTERS.country,
      category: (params.get('category') || DEFAULT_FILTERS.category) as FindShowsCategory,
      startMonth: params.get('from') ?? DEFAULT_FILTERS.startMonth,
      endMonth: params.get('to') ?? DEFAULT_FILTERS.endMonth,
    },
    // Whole pages only, so a hand-edited ?shown= never asks for a partial or negative page.
    visibleCount: Number.isFinite(shown) && shown > PAGE_SIZE ? Math.ceil(shown / PAGE_SIZE) * PAGE_SIZE : PAGE_SIZE,
  };
}

/** The search string ("" or "?…") for a results state; parameters other than ours are kept. */
export function resultsSearch(state: FindShowsResultsState, currentSearch = ''): string {
  const params = new URLSearchParams(currentSearch);
  const { filters, visibleCount } = state;
  const entries: [string, string, string][] = [
    ['q', filters.query.trim() ? filters.query : '', DEFAULT_FILTERS.query],
    ['region', filters.region, DEFAULT_FILTERS.region],
    ['country', filters.country, DEFAULT_FILTERS.country],
    ['category', filters.category, DEFAULT_FILTERS.category],
    ['from', filters.startMonth, DEFAULT_FILTERS.startMonth],
    ['to', filters.endMonth, DEFAULT_FILTERS.endMonth],
    ['shown', String(visibleCount), String(PAGE_SIZE)],
  ];
  for (const [key, value, fallback] of entries) {
    if (value && value !== fallback) params.set(key, value);
    else params.delete(key);
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** sessionStorage key for the scroll position of one results address. */
export function scrollStorageKey(pathname: string, search: string) {
  return `find-shows:scroll:${pathname}${search}`;
}
