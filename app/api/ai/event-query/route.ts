import { validateBody } from '@/lib/http/validate';
import { jsonError, jsonOk } from '@/lib/http/response';
import { eventQueryRequestSchema } from '@/models/ai-event-query';
import { extractEventFilters, isConfigured, keywordFallback } from '@/services/ai-event-query.service';

export const dynamic = 'force-dynamic';

/**
 * Turns the question typed into the Events search box into catalog filters.
 *
 * This route always answers 200 with a usable filter set. The Events page has
 * no other way to run a search, so a missing key or a bad minute upstream must
 * degrade to a keyword search rather than leave the box dead — `degraded` and
 * `reason` tell the UI which notice to show. Only a malformed body is a 4xx.
 */
export async function POST(request: Request) {
  try {
    const { prompt, currentFilters } = validateBody(eventQueryRequestSchema, await request.json());

    if (!isConfigured()) {
      return jsonOk({ ...keywordFallback(prompt), degraded: true, reason: 'missing_api_key' });
    }

    try {
      return jsonOk(await extractEventFilters({ prompt, currentFilters }));
    } catch (error) {
      console.error('[ai/event-query] extraction failed:', error);
      return jsonOk({ ...keywordFallback(prompt), degraded: true, reason: 'assistant_error' });
    }
  } catch (error) {
    return jsonError(error);
  }
}
