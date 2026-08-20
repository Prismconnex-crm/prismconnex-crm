/**
 * Shared types for the Events Explorer (left filter rail + AI panel + results).
 *
 * `EventFilters` is the single source of truth for both the sidebar and the
 * assistant: the events adapter in `lib/assistant/adapters/events.ts` produces
 * exactly this shape, the client writes it into the URL query string, and the
 * sidebar renders from it. That is what makes the left panel visibly update
 * when the assistant reads a question.
 *
 * Distinct from the single-value `EventFilters` in `models/event-query.ts`,
 * which belongs to the Companies tab's "ask" flow and is left untouched.
 */

/** Every field is multi-select; empty array means "no constraint". */
export type EventFilters = {
  regions: string[];
  countries: string[];
  cities: string[];
  categories: string[];
  organizers: string[];
  /** Free-text terms matched against the event's searchText. */
  keywords: string[];
  /** Inclusive ISO YYYY-MM-DD bounds, matched against the event's run dates. */
  dateFrom: string | null;
  dateTo: string | null;
  favouritesOnly: boolean;
};

/** The array-valued keys, useful for generic chip/facet code. */
export type EventFilterListKey =
  | 'regions'
  | 'countries'
  | 'cities'
  | 'categories'
  | 'organizers'
  | 'keywords';

export const EVENT_FILTER_LIST_KEYS: EventFilterListKey[] = [
  'regions',
  'countries',
  'cities',
  'categories',
  'organizers',
  'keywords',
];

export function emptyEventFilters(): EventFilters {
  return {
    regions: [],
    countries: [],
    cities: [],
    categories: [],
    organizers: [],
    keywords: [],
    dateFrom: null,
    dateTo: null,
    favouritesOnly: false,
  };
}

export function hasAnyEventFilter(filters: EventFilters): boolean {
  return (
    EVENT_FILTER_LIST_KEYS.some((key) => filters[key].length > 0) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    filters.favouritesOnly
  );
}

export type EventDatePresetId = 'next-30-days' | 'next-3-months' | 'next-6-months' | 'this-year';

export const EVENT_DATE_PRESETS: { id: EventDatePresetId; label: string }[] = [
  { id: 'next-30-days', label: 'Next 30 days' },
  { id: 'next-3-months', label: 'Next 3 months' },
  { id: 'next-6-months', label: 'Next 6 months' },
  { id: 'this-year', label: 'This year' },
];
