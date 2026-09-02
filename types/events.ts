/**
 * Shared types for the Events Explorer (left filter rail + AI panel + results).
 *
 * `EventFilters` is the single source of truth for both the sidebar and the
 * assistant: /api/ai/event-query returns exactly this shape, the client writes
 * it into the URL query string, and the sidebar renders from it. That is what
 * makes the left panel visibly update when the assistant reads a question.
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
  /**
   * Calendar picker, kept separate from `dateFrom`/`dateTo` so the two never
   * overwrite each other: the rail can hold "every January" while a hand-typed
   * range narrows it further. 1-12, or null for "any month".
   */
  month: number | null;
  /** Four-digit year, or null for "any year". */
  year: number | null;
  favouritesOnly: boolean;
};

export type EventQueryResponse = {
  filters: EventFilters;
  explanation: string;
  suggestedFollowUps: string[];
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
    month: null,
    year: null,
    favouritesOnly: false,
  };
}

export function hasAnyEventFilter(filters: EventFilters): boolean {
  return (
    EVENT_FILTER_LIST_KEYS.some((key) => filters[key].length > 0) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.month) ||
    Boolean(filters.year) ||
    filters.favouritesOnly
  );
}

/** Month names indexed 0-11, so `EVENT_MONTH_LABELS[month - 1]` reads a 1-12 value. */
export const EVENT_MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type EventDatePresetId = 'next-30-days' | 'next-3-months' | 'next-6-months' | 'this-year';

export const EVENT_DATE_PRESETS: { id: EventDatePresetId; label: string }[] = [
  { id: 'next-30-days', label: 'Next 30 days' },
  { id: 'next-3-months', label: 'Next 3 months' },
  { id: 'next-6-months', label: 'Next 6 months' },
  { id: 'this-year', label: 'This year' },
];

/** One trimmed row handed to the answering model. Nothing else is sent. */
export type EventAnswerRow = {
  name: string;
  organizer: string;
  city: string;
  country: string;
  dates: string;
  category: string;
};

export type EventAnswerResponse = {
  answer: string;
};
