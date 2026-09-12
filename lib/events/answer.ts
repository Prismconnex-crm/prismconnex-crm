import { EVENT_FILTER_LIST_KEYS, type EventFilters } from '@/types/events';
import type { FindShowEvent } from '@/types/find-shows';
import { formatDateRange } from '@/lib/events/chips';
import type { EventQueryState } from '@/lib/events/filters';

/**
 * Templated prose over real counts.
 *
 * This is the baseline answer, not a fallback: the panel must answer with no
 * ANTHROPIC_API_KEY configured. When a working key is present the LLM replaces
 * this text, but the wire format is identical, so the client never branches.
 *
 * Mirrors lib/people/answer.ts.
 */

function topValues(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value || value === '?') continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
    .slice(0, limit)
    .map((entry) => entry.value);
}

const MONTH_SHORT = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-08-14" -> "August 2026". */
function monthYear(iso: string): string {
  const [year, month] = iso.split('-');
  return `${MONTH_SHORT[Number(month) - 1] ?? month} ${year}`;
}

function listPhrase(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Where the filters point, in the order a person would say it. */
function placePhrase(filters: EventFilters): string {
  const places = [...filters.cities, ...filters.countries, ...filters.regions];
  return places.length > 0 ? ` in ${listPhrase(places)}` : '';
}

export function buildEventAnswer(input: {
  question: string;
  state: EventQueryState;
  matches: readonly FindShowEvent[];
  total: number;
  /**
   * The catalog's own date span, as ISO bounds. Supplied by the caller so this
   * module stays free of the 10 MB seed import; without it the message falls
   * back to the vaguer wording.
   */
  coverage?: { from: string; to: string } | null;
}): string {
  const { state, matches, total, coverage } = input;
  const filters = state.filters;

  if (total === 0) {
    const anyDate = Boolean(filters.dateFrom || filters.dateTo || filters.month || filters.year);
    if (anyDate) {
      // Naming the real window beats "a few years out": the usual cause of an
      // empty date search is asking outside the range entirely, and a reader
      // cannot correct for that without being told what the range is.
      const span = coverage ? ` The catalog covers ${monthYear(coverage.from)} to ${monthYear(coverage.to)}.` : '';
      return (
        `No trade shows match in that period.${span} Try widening the dates, ` +
        'or drop them and filter by place instead.'
      );
    }
    const anyList = EVENT_FILTER_LIST_KEYS.some((key) => filters[key].length > 0);
    if (anyList) {
      return (
        'No trade shows match those filters. Category and city are the two that ' +
        'most often empty a result set; relaxing either normally brings rows back.'
      );
    }
    return 'No trade shows match that search. Try a broader term, or filter by country instead.';
  }

  const parts: string[] = [
    `Found ${total} trade show${total === 1 ? '' : 's'}${placePhrase(filters)}`,
  ];

  const dates = formatDateRange(filters.dateFrom, filters.dateTo);
  if (dates) parts.push(`between ${dates}`);

  const sentence = `${parts.join(' ')}.`;

  const categories = topValues(
    matches.map((event) => event.primaryCategory),
    3
  );
  if (categories.length > 0) {
    return `${sentence} Mostly ${listPhrase(categories)}.`;
  }

  const organizers = topValues(
    matches.map((event) => event.organizer),
    2
  );
  if (organizers.length > 0) {
    return `${sentence} Run mainly by ${listPhrase(organizers)}.`;
  }

  return sentence;
}
