import {
  EVENT_FILTER_LIST_KEYS,
  emptyEventFilters,
  type EventDatePresetId,
  type EventFilterListKey,
  type EventFilters,
} from '@/types/events';
import type { FindShowEvent } from '@/types/find-shows';

/**
 * Pure filtering, faceting and URL (de)serialisation for the Events Explorer.
 *
 * Deliberately free of React and of the Claude SDK so it can be unit-tested and
 * shared between the client rail and the API routes.
 */

export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ---------------------------------------------------------------------------
// URL <-> filters
// ---------------------------------------------------------------------------

/**
 * The sidebar's free-text box. Kept beside `EventFilters` rather than inside it
 * because the assistant only ever produces filters — it never echoes back a
 * raw search string.
 */
export type EventQueryState = {
  filters: EventFilters;
  search: string;
};

const LIST_PARAM: Record<EventFilterListKey, string> = {
  regions: 'region',
  countries: 'country',
  cities: 'city',
  categories: 'category',
  organizers: 'organizer',
  keywords: 'keyword',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shape *and* validity: the regex alone accepts "2026-13-99", which would then
 * sort outside every real date and silently disable the bound it was meant to
 * apply. Dates arrive from shared URLs and from the model, so neither source is
 * trusted to be well-formed.
 */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function parseEventQueryState(search: string): EventQueryState {
  const params = new URLSearchParams(search);
  const filters = emptyEventFilters();

  for (const key of EVENT_FILTER_LIST_KEYS) {
    filters[key] = params.getAll(LIST_PARAM[key]).filter(Boolean);
  }

  const from = params.get('from');
  const to = params.get('to');
  filters.dateFrom = from && isValidIsoDate(from) ? from : null;
  filters.dateTo = to && isValidIsoDate(to) ? to : null;
  filters.favouritesOnly = params.get('fav') === '1';

  return { filters, search: params.get('q') ?? '' };
}

/** Serialises to a leading-`?` string, or '' when nothing is applied. */
export function serializeEventQueryState(state: EventQueryState): string {
  const params = new URLSearchParams();

  for (const key of EVENT_FILTER_LIST_KEYS) {
    for (const value of state.filters[key]) params.append(LIST_PARAM[key], value);
  }
  if (state.filters.dateFrom) params.set('from', state.filters.dateFrom);
  if (state.filters.dateTo) params.set('to', state.filters.dateTo);
  if (state.filters.favouritesOnly) params.set('fav', '1');
  if (state.search.trim()) params.set('q', state.search.trim());

  const query = params.toString();
  return query ? `?${query}` : '';
}

// ---------------------------------------------------------------------------
// Date presets
// ---------------------------------------------------------------------------

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateRangeForPreset(
  preset: EventDatePresetId,
  today = new Date()
): { dateFrom: string; dateTo: string } {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  if (preset === 'this-year') {
    return {
      dateFrom: `${start.getUTCFullYear()}-01-01`,
      dateTo: `${start.getUTCFullYear()}-12-31`,
    };
  }

  const end = new Date(start);
  if (preset === 'next-30-days') end.setUTCDate(end.getUTCDate() + 30);
  if (preset === 'next-3-months') end.setUTCMonth(end.getUTCMonth() + 3);
  if (preset === 'next-6-months') end.setUTCMonth(end.getUTCMonth() + 6);

  return { dateFrom: iso(start), dateTo: iso(end) };
}

/** Which preset (if any) exactly describes the current range — for highlighting. */
export function matchDatePreset(
  filters: EventFilters,
  today = new Date()
): EventDatePresetId | null {
  if (!filters.dateFrom || !filters.dateTo) return null;
  const candidates: EventDatePresetId[] = [
    'next-30-days',
    'next-3-months',
    'next-6-months',
    'this-year',
  ];
  for (const preset of candidates) {
    const range = dateRangeForPreset(preset, today);
    if (range.dateFrom === filters.dateFrom && range.dateTo === filters.dateTo) return preset;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * One predicate per filter dimension, so faceting can re-run the match with a
 * single dimension held out (the standard "count as if this facet were open"
 * behaviour) without duplicating the matching rules.
 */
type Dimension = EventFilterListKey | 'dates' | 'favourites' | 'search';

function includesAny(haystack: string, needles: string[]): boolean {
  const value = normalize(haystack);
  return needles.some((needle) => value.includes(normalize(needle)));
}

function buildChecks(
  filters: EventFilters,
  search: string,
  favouriteSlugs: ReadonlySet<string>
): Record<Dimension, ((event: FindShowEvent) => boolean) | null> {
  const query = normalize(search);

  return {
    // Region/category are closed vocabularies, so exact membership is right.
    regions: filters.regions.length ? (e) => filters.regions.includes(e.region) : null,
    categories: filters.categories.length
      ? (e) => e.categories.some((category) => filters.categories.includes(category))
      : null,
    // Country/city/organizer come from scraped text and may be spelled slightly
    // differently by the model ("Munich" vs "München"), so match loosely.
    countries: filters.countries.length ? (e) => includesAny(e.country, filters.countries) : null,
    cities: filters.cities.length
      ? (e) => includesAny(e.city, filters.cities) || includesAny(e.venue, filters.cities)
      : null,
    organizers: filters.organizers.length
      ? (e) => includesAny(e.organizer, filters.organizers)
      : null,
    // Keywords are AND-ed: each term must appear somewhere in the event.
    keywords: filters.keywords.length
      ? (e) => filters.keywords.every((term) => normalize(e.searchText).includes(normalize(term)))
      : null,
    dates:
      filters.dateFrom || filters.dateTo
        ? (e) => {
            if (filters.dateTo && e.startDate > filters.dateTo) return false;
            if (filters.dateFrom && e.endDate < filters.dateFrom) return false;
            return true;
          }
        : null,
    favourites: filters.favouritesOnly ? (e) => favouriteSlugs.has(e.slug) : null,
    search: query ? (e) => e.searchText.includes(query) : null,
  };
}

export function filterEventList(
  events: readonly FindShowEvent[],
  filters: EventFilters,
  search: string,
  favouriteSlugs: ReadonlySet<string>
): FindShowEvent[] {
  const checks = buildChecks(filters, search, favouriteSlugs);
  const active = Object.values(checks).filter(Boolean) as ((e: FindShowEvent) => boolean)[];
  if (active.length === 0) return events as FindShowEvent[];
  return events.filter((event) => active.every((check) => check(event)));
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

export type FacetOption = { value: string; count: number };
export type EventFacets = Record<Exclude<EventFilterListKey, 'keywords'>, FacetOption[]>;

const FACET_DIMENSIONS: Exclude<EventFilterListKey, 'keywords'>[] = [
  'regions',
  'countries',
  'cities',
  'categories',
  'organizers',
];

function valuesFor(
  dimension: Exclude<EventFilterListKey, 'keywords'>,
  event: FindShowEvent
): string[] {
  switch (dimension) {
    case 'regions':
      return [event.region];
    case 'countries':
      return [event.country];
    case 'cities':
      return [event.city];
    case 'categories':
      return event.categories;
    case 'organizers':
      return event.organizer && event.organizer !== '?' ? [event.organizer] : [];
  }
}

/**
 * Counts each option against everything *except* its own dimension, so opening
 * "Country" still shows every country reachable under the other filters rather
 * than only the ones already selected.
 */
export function computeEventFacets(
  events: readonly FindShowEvent[],
  filters: EventFilters,
  search: string,
  favouriteSlugs: ReadonlySet<string>
): EventFacets {
  const checks = buildChecks(filters, search, favouriteSlugs);
  const facets = {} as EventFacets;

  for (const dimension of FACET_DIMENSIONS) {
    const others = (Object.keys(checks) as Dimension[])
      .filter((key) => key !== dimension)
      .map((key) => checks[key])
      .filter(Boolean) as ((e: FindShowEvent) => boolean)[];

    const counts = new Map<string, number>();
    for (const event of events) {
      if (!others.every((check) => check(event))) continue;
      for (const value of valuesFor(dimension, event)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }

    facets[dimension] = Array.from(counts, ([value, count]) => ({ value, count })).sort(
      (left, right) => right.count - left.count || left.value.localeCompare(right.value)
    );
  }

  return facets;
}
