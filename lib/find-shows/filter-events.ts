import { findShowEvents } from './catalog';
import type { EventFilters, EventResult } from '@/models/event-query';
import type { FindShowEvent } from '@/types/find-shows';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

/**
 * Pure, dependency-free matching over the trade-show catalog. Kept separate
 * from event-query.service.ts so it stays testable without the Claude SDK.
 */
export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip combining accents
}

/**
 * Applies model-extracted filters to the in-memory catalog. Matching is
 * deliberately forgiving on city/country (substring, accent-insensitive) since
 * the model may return "Munich" where the seed data says "München".
 */
export function filterEvents(filters: EventFilters): {
  events: EventResult[];
  totalMatched: number;
} {
  const city = filters.city ? normalize(filters.city) : null;
  const country = filters.country ? normalize(filters.country) : null;
  const keyword = filters.keyword ? normalize(filters.keyword) : null;

  const matched = findShowEvents.filter((event: FindShowEvent) => {
    if (city && !normalize(event.city).includes(city)) return false;
    if (country && !normalize(event.country).includes(country)) return false;

    if (filters.region && filters.region !== 'All Regions' && event.region !== filters.region) {
      return false;
    }

    if (
      filters.category &&
      filters.category !== 'All Categories' &&
      !event.categories.includes(filters.category as FindShowEvent['primaryCategory'])
    ) {
      return false;
    }

    if (keyword && !normalize(event.searchText).includes(keyword)) return false;

    // startDate is an ISO YYYY-MM-DD string.
    const year = Number(event.startDate.slice(0, 4));
    const month = Number(event.startDate.slice(5, 7));

    if (filters.year && year !== filters.year) return false;

    if (filters.monthFrom) {
      const from = filters.monthFrom;
      const to = filters.monthTo ?? from;
      // A range like 11-2 wraps across the new year.
      const inRange = from <= to ? month >= from && month <= to : month >= from || month <= to;
      if (!inRange) return false;
    }

    return true;
  });

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(filters.offset ?? 0, 0);

  return {
    totalMatched: matched.length,
    events: matched.slice(offset, offset + limit).map((event) => ({
      slug: event.slug,
      name: event.name,
      city: event.city,
      country: event.country,
      venue: event.venue,
      organizer: event.organizer,
      displayDate: event.displayDate,
      startDate: event.startDate,
      website: event.website,
      primaryCategory: event.primaryCategory,
      logoUrl: event.seedAsset.logoUrl,
    })),
  };
}

/** One line of prose shown above the results list. */
export function describeResults(
  filters: EventFilters,
  totalMatched: number,
  shown: number
): string {
  const where = [filters.city, filters.country].filter(Boolean).join(', ');

  if (totalMatched === 0) {
    return `No trade shows found${where ? ` in ${where}` : ''} for that search.`;
  }

  const parts: string[] = [`Found ${totalMatched} trade show${totalMatched === 1 ? '' : 's'}`];

  if (filters.category && filters.category !== 'All Categories') {
    parts.push(`in ${filters.category}`);
  }
  if (where) parts.push(`in ${where}`);
  else if (filters.region && filters.region !== 'All Regions') parts.push(`in ${filters.region}`);

  const sentence = `${parts.join(' ')}.`;
  return shown < totalMatched ? `${sentence} Showing the first ${shown}.` : sentence;
}
