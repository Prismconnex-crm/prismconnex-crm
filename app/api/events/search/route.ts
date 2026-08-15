import { validateBody } from '@/lib/http/validate';
import { jsonError, jsonOk } from '@/lib/http/response';
import { eventSearchSchema } from '@/models/event-query';
import { filterEvents } from '@/lib/find-shows/filter-events';

export const dynamic = 'force-dynamic';

/**
 * Paging for a result set the assistant already produced. The client replays the
 * filters it was given, so Prev/Next costs no model call — and no API key, which
 * is why this route never touches the assistant.
 *
 * `filters.limit` doubles as the page size: the assistant sets it when the user
 * asks for "top 5", and the UI leaves it unset for the default page. Paging is
 * done with an offset derived from the page number rather than the client
 * sending a raw offset, so a page can't overlap the previous one.
 */
export async function POST(request: Request) {
  try {
    const { filters, page } = validateBody(eventSearchSchema, await request.json());

    // filterEvents clamps to MAX_LIMIT (50) internally; mirror the same default
    // here so the reported pageSize matches the rows actually returned.
    const pageSize = Math.min(filters.limit ?? 25, 50);
    const { events, totalMatched } = filterEvents({
      ...filters,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    // A page past the end is an empty page, not an error: the client may still
    // be holding a page number from a wider result set.
    return jsonOk({ events, totalMatched, page, pageSize });
  } catch (error) {
    return jsonError(error);
  }
}
