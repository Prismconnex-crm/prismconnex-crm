import {
  EVENT_FILTER_LIST_KEYS,
  EVENT_MONTH_LABELS,
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
  filters.month = parseMonthParam(params.get('month'));
  filters.year = parseYearParam(params.get('year'));
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
  if (state.filters.month) params.set('month', String(state.filters.month));
  if (state.filters.year) params.set('year', String(state.filters.year));
  if (state.filters.favouritesOnly) params.set('fav', '1');
  if (state.search.trim()) params.set('q', state.search.trim());

  const query = params.toString();
  return query ? `?${query}` : '';
}

// ---------------------------------------------------------------------------
// Calendar (month + year)
// ---------------------------------------------------------------------------

/**
 * The calendar picker's bounds. Shared URLs and model output are untrusted, so
 * an out-of-range or non-numeric value is dropped rather than clamped — a
 * clamped "month=99" would silently filter on December.
 */
export const MIN_EVENT_YEAR = 1990;
export const MAX_EVENT_YEAR = 2100;

export function parseMonthParam(value: string | null): number | null {
  if (!value) return null;
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

export function parseYearParam(value: string | null): number | null {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= MIN_EVENT_YEAR && year <= MAX_EVENT_YEAR ? year : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Inclusive ISO bounds of one calendar month, or of a whole year when month is null. */
export function calendarRange(year: number, month: number | null): { from: string; to: string } {
  if (month === null) return { from: `${year}-01-01`, to: `${year}-12-31` };
  // Day 0 of the next month is the last day of this one, so February gets its
  // leap day without a table.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(lastDay)}` };
}

/** Every 'YYYY-MM' an event runs through — one entry for a same-month show. */
function monthsCovered(event: FindShowEvent): string[] {
  const [startYear, startMonth] = event.startDate.split('-').map(Number);
  const [endYear, endMonth] = event.endDate.split('-').map(Number);
  if (!startYear || !startMonth) return [];

  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  // Guarded rather than open-ended: a scraped endDate before its startDate
  // would otherwise spin forever.
  const limit = Number.isFinite(endYear) && endYear >= startYear ? endYear * 12 + endMonth : 0;
  while (year * 12 + month <= limit && months.length < 24) {
    months.push(`${year}-${pad2(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months.length ? months : [`${startYear}-${pad2(startMonth)}`];
}

/**
 * Does the event's run touch the selected month/year?
 *
 * Month without a year is answered per-month rather than as a range, so
 * "January" means every January in the catalog.
 */
export function matchesCalendar(
  event: FindShowEvent,
  month: number | null,
  year: number | null
): boolean {
  if (month === null && year === null) return true;
  if (year !== null) {
    const { from, to } = calendarRange(year, month);
    return !(event.startDate > to || event.endDate < from);
  }
  const suffix = `-${pad2(month as number)}`;
  return monthsCovered(event).some((value) => value.endsWith(suffix));
}

/** "January 2026", "January", "2026" — or '' when nothing is picked. */
export function formatCalendarSelection(month: number | null, year: number | null): string {
  const label = month ? EVENT_MONTH_LABELS[month - 1] : '';
  if (label && year) return `${label} ${year}`;
  if (label) return label;
  return year ? String(year) : '';
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
type Dimension = EventFilterListKey | 'dates' | 'calendar' | 'favourites' | 'search';

function includesAny(haystack: string, needles: string[]): boolean {
  const value = normalize(haystack);
  return needles.some((needle) => value.includes(normalize(needle)));
}

/**
 * The fields the free-text box searches. Deliberately narrower than
 * `event.searchText`, which also folds in the description and the category
 * lists — see `matchesSearch`.
 */
function searchableFields(event: FindShowEvent): string[] {
  return [event.name, event.city, event.country, event.venue, event.organizer];
}

/** Splits normalized text into word tokens, so "BETT-Show" yields bett, show. */
function words(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Free-text match for the search box: every term the user typed must be the
 * *start of a word* in one of the event's searchable fields.
 *
 * This used to be `event.searchText.includes(query)` — a raw substring test
 * against a blob that concatenates name, city, country, venue, organizer,
 * description and every category. Two things went wrong with that. A letter
 * matched anywhere inside any word, and the description made almost every event
 * a match for almost every letter: against the live catalog, typing "b"
 * returned 10,870 of 11,635 events. The box only appeared to start working once
 * enough characters had been typed to make the substring rare, which is why a
 * whole event name found the event but its first letter did not.
 *
 * Word-prefix fixes both halves. "b" now returns events whose name, city,
 * country, venue or organizer *begins* with b, so every row visibly answers the
 * query. Terms are AND-ed and each may land in a different field, so "bett
 * london" matches BETT in London, and a multi-word name typed in full still
 * matches the way it did before.
 *
 * Description and categories are dropped from this path on purpose: prose is
 * what caused the flood, and categories already have their own facet filter.
 * The `keywords` dimension still matches the full blob — those come from the
 * assistant rather than a keystroke, where breadth is what's wanted.
 */
function matchesSearch(event: FindShowEvent, terms: string[]): boolean {
  const fieldWords = searchableFields(event).flatMap(words);
  return terms.every((term) => fieldWords.some((word) => word.startsWith(term)));
}

function buildChecks(
  filters: EventFilters,
  search: string,
  favouriteSlugs: ReadonlySet<string>
): Record<Dimension, ((event: FindShowEvent) => boolean) | null> {
  const terms = words(search);

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
    // Month/year is its own dimension so the calendar dropdowns and the
    // hand-typed range narrow each other instead of overwriting.
    calendar:
      filters.month || filters.year
        ? (e) => matchesCalendar(e, filters.month ?? null, filters.year ?? null)
        : null,
    favourites: filters.favouritesOnly ? (e) => favouriteSlugs.has(e.slug) : null,
    search: terms.length ? (e) => matchesSearch(e, terms) : null,
  };
}

/**
 * How well an event answers the typed query, lowest first:
 *
 *   0  its name begins with what was typed        — "bett" -> BETT SHOW
 *   1  its name contains the terms as word starts — "bett" -> BETT BRAZIL
 *   2  only a city/country/venue/organizer word   — "b"    -> ISPO BEIJING
 *
 * Matching alone leaves "b" returning several thousand events, because Beijing
 * and Boat Show are honest matches for it. Ranking is what makes the box feel
 * like a name search: the events actually *called* B-something come first, and
 * the location matches stay reachable underneath instead of being cut.
 */
function searchRank(event: FindShowEvent, terms: string[], query: string): number {
  const name = normalize(event.name);
  if (query && name.startsWith(query)) return 0;
  const nameWords = words(event.name);
  if (terms.every((term) => nameWords.some((word) => word.startsWith(term)))) return 1;
  return 2;
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
  const matched = events.filter((event) => active.every((check) => check(event)));

  const terms = words(search);
  if (terms.length === 0) return matched;

  // Only the search box orders results; with the box empty the catalog keeps
  // whatever order the caller gave it. Array.prototype.sort is stable, so
  // events of equal rank hold their catalog order.
  const query = normalize(search);
  return matched.sort((a, b) => searchRank(a, terms, query) - searchRank(b, terms, query));
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

// ---------------------------------------------------------------------------
// Calendar facets
// ---------------------------------------------------------------------------

export type MonthFacet = { month: number; label: string; count: number };
export type YearFacet = { year: number; count: number };
export type CalendarFacets = { months: MonthFacet[]; years: YearFacet[] };

/**
 * Counts for the Month and Year dropdowns, over the whole catalog rather than
 * the current page — 11.6k events is small enough to scan per keystroke, and
 * counting only the visible page would make the dropdown lie.
 *
 * Each dropdown is counted with its own choice held out but the *other* one
 * applied, which is what makes the pair read naturally: with 2026 picked, the
 * month list shows how many shows each month of 2026 holds, and with January
 * picked the year list shows how many Januaries each year holds.
 *
 * Months are always all twelve, including empty ones, so the list doesn't
 * reshuffle under the cursor as other filters change.
 */
export function computeCalendarFacets(
  events: readonly FindShowEvent[],
  filters: EventFilters,
  search: string,
  favouriteSlugs: ReadonlySet<string>
): CalendarFacets {
  const checks = buildChecks(filters, search, favouriteSlugs);
  const others = (Object.keys(checks) as Dimension[])
    .filter((key) => key !== 'calendar')
    .map((key) => checks[key])
    .filter(Boolean) as ((e: FindShowEvent) => boolean)[];

  const month = filters.month ?? null;
  const year = filters.year ?? null;

  const monthCounts = new Array<number>(12).fill(0);
  const yearCounts = new Map<number, number>();

  for (const event of events) {
    if (!others.every((check) => check(event))) continue;

    const covered = monthsCovered(event);
    const seenYears = new Set<number>();
    const seenMonths = new Set<number>();

    for (const value of covered) {
      const [eventYear, eventMonth] = value.split('-').map(Number);
      if (!eventYear || !eventMonth) continue;
      // A show running Dec 30 - Jan 2 belongs to both months and both years,
      // but must not be counted twice in either.
      if ((year === null || eventYear === year) && !seenMonths.has(eventMonth)) {
        seenMonths.add(eventMonth);
        monthCounts[eventMonth - 1] += 1;
      }
      if ((month === null || eventMonth === month) && !seenYears.has(eventYear)) {
        seenYears.add(eventYear);
        yearCounts.set(eventYear, (yearCounts.get(eventYear) ?? 0) + 1);
      }
    }
  }

  return {
    months: monthCounts.map((count, index) => ({
      month: index + 1,
      label: EVENT_MONTH_LABELS[index],
      count,
    })),
    years: Array.from(yearCounts, ([value, count]) => ({ year: value, count })).sort(
      (left, right) => left.year - right.year
    ),
  };
}
