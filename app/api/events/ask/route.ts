import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';
import { validateBody } from '@/lib/http/validate';
import { buildEventAnswer } from '@/lib/events/answer';
import { buildEventFilterChips } from '@/lib/events/chips';
import { filterEventList, isValidIsoDate } from '@/lib/events/filters';
import {
  MAX_EVENT_LIMIT,
  clampEventLimit,
  parseEventQuery,
  type EventAskQuery,
} from '@/lib/events/nl-query';
import { eventCoverage, eventVocabulary } from '@/lib/events/vocabulary';
import { findShowEvents } from '@/lib/find-shows/catalog';
import { emptyEventFilters } from '@/types/events';

export const dynamic = 'force-dynamic';

/**
 * Natural-language search for the Events Explorer's "Find anything" panel.
 *
 * Deterministic: the question is parsed by dictionary and regex
 * (lib/events/nl-query) and answered from the in-memory catalog. No model call,
 * so it works with no ANTHROPIC_API_KEY and costs one round trip.
 *
 * Intentionally NOT tenant-scoped — the trade-show catalog is shared reference
 * data, not workspace data, exactly like /api/events/search.
 *
 * `parsedQuery` comes back in the page's own `EventQueryState` shape (plural,
 * array-valued: `filters.regions`, `filters.countries`, ...) rather than a flat
 * singular one. That is the shape the left rail already renders from, and it is
 * a superset — the rail supports multi-select on every dimension, which a
 * single-value field would quietly throw away.
 */

const filtersSchema = z.object({
  regions: z.array(z.string().trim().min(1).max(60)).max(6).default([]),
  countries: z.array(z.string().trim().min(1).max(60)).max(6).default([]),
  cities: z.array(z.string().trim().min(1).max(80)).max(6).default([]),
  categories: z.array(z.string().trim().min(1).max(60)).max(6).default([]),
  organizers: z.array(z.string().trim().min(1).max(120)).max(6).default([]),
  keywords: z.array(z.string().trim().min(1).max(60)).max(6).default([]),
  dateFrom: z.string().refine(isValidIsoDate).nullable().default(null),
  dateTo: z.string().refine(isValidIsoDate).nullable().default(null),
  month: z.number().int().min(1).max(12).nullable().default(null),
  year: z.number().int().min(1990).max(2100).nullable().default(null),
  favouritesOnly: z.boolean().default(false),
});

const askSchema = z.object({
  q: z.string().trim().min(1).max(500),
  /**
   * Supplied instead of parsing `q` when the caller already holds the state —
   * a chip removal, a rail click, or a restored history entry. Without it, a
   * re-parse of the sentence would put back the filter just removed.
   */
  filters: filtersSchema.partial().optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(MAX_EVENT_LIMIT).optional(),
  sort: z.enum(['date', 'relevance', 'name']).optional(),
  page: z.number().int().min(1).max(1000).default(1),
  /**
   * Liked-event slugs. Favourites live in the browser's localStorage, so the
   * server can only honour `favouritesOnly` if the client sends the set.
   */
  favouriteSlugs: z.array(z.string().min(1).max(160)).max(2000).default([]),
});

/** Ordering. `date` is the catalog's own order; the others re-sort a copy. */
function sortEvents<T extends { name: string; startDate: string }>(
  events: readonly T[],
  sort: EventAskQuery['sort']
): readonly T[] {
  if (sort === 'name') return [...events].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'date') return [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));
  // 'relevance' keeps filterEventList's own ranking, which only orders when a
  // search term is present — re-sorting here would throw that away.
  return events;
}

export async function POST(request: NextRequest) {
  try {
    const body = validateBody(askSchema, await request.json());

    const parsedQuery: EventAskQuery = body.filters
      ? {
          filters: { ...emptyEventFilters(), ...filtersSchema.parse(body.filters) },
          search: body.search ?? '',
          limit: clampEventLimit(body.limit ?? 25),
          sort: body.sort ?? 'date',
        }
      : parseEventQuery(body.q, eventVocabulary);

    if (body.limit) parsedQuery.limit = clampEventLimit(body.limit);

    const favouriteSlugs = new Set(body.favouriteSlugs);
    const matched = filterEventList(
      findShowEvents,
      parsedQuery.filters,
      parsedQuery.search,
      favouriteSlugs
    );

    const ordered = sortEvents(matched, parsedQuery.sort);

    // Paged, never whole: the catalog is 11,635 events and the panel shows one
    // page of them.
    const offset = (body.page - 1) * parsedQuery.limit;
    const items = ordered.slice(offset, offset + parsedQuery.limit);

    return jsonOk({
      parsedQuery,
      chips: buildEventFilterChips(parsedQuery.filters, parsedQuery.search),
      answer: buildEventAnswer({
        question: body.q,
        state: { filters: parsedQuery.filters, search: parsedQuery.search },
        matches: items,
        total: ordered.length,
        coverage: eventCoverage,
      }),
      totalCount: ordered.length,
      items,
      page: body.page,
      pageSize: parsedQuery.limit,
      hasNextPage: offset + items.length < ordered.length,
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode < 500) return jsonError(error);
    console.error('[events/ask]', error);
    return jsonError(error);
  }
}
