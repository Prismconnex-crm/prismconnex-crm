import { NextRequest } from 'next/server';
import { filterEvents } from '@/lib/find-shows/filter-events';
import { ApiError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';
import { validateBody } from '@/lib/http/validate';
import { eventSearchSchema } from '@/models/event-query';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

/**
 * Pages through trade-show matches with NO model call. The client sends back
 * the filters `/api/companies/ask` already extracted, so only the first page
 * of a query costs an API call.
 *
 * Like /api/companies, this route is intentionally NOT tenant-scoped — the
 * trade-show catalog is a shared discovery dataset, not workspace data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filters, page } = validateBody(eventSearchSchema, body);

    const pageSize = Math.min(filters.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const { events, totalMatched } = filterEvents({
      ...filters,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return jsonOk({ events, totalMatched, page, pageSize });
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error);
    }
    console.error('[events/search]', error);
    return jsonError(error);
  }
}
