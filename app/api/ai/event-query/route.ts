import { NextRequest } from 'next/server';
import { ApiError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';
import { validateBody } from '@/lib/http/validate';
import { eventQueryRequestSchema } from '@/models/ai-event-query';
import { extractEventFilters, isConfigured, keywordFallback } from '@/services/ai-event-query.service';

/**
 * Natural-language search for the Events Explorer: turns a sentence into the
 * same `EventFilters` shape the left rail renders from, so the sidebar visibly
 * updates to show how the question was read.
 *
 * Like /api/companies, this route is intentionally NOT tenant-scoped — the
 * trade-show catalog is a shared discovery dataset, not workspace data.
 *
 * Never returns a non-2xx for an assistant problem: a missing key, a rate
 * limit or a model that keeps returning junk all degrade to a keyword search
 * on the raw prompt, flagged with `degraded` so the UI can say so quietly.
 */
export async function POST(request: NextRequest) {
  let prompt = '';

  try {
    const body = await request.json();
    const input = validateBody(eventQueryRequestSchema, body);
    prompt = input.prompt;

    if (!isConfigured()) {
      return jsonOk({ ...keywordFallback(prompt), degraded: true, reason: 'missing_api_key' });
    }

    return jsonOk(await extractEventFilters(input));
  } catch (error) {
    // A bad request body is the caller's problem and should surface as a 4xx.
    if (error instanceof ApiError && error.statusCode < 500) {
      return jsonError(error);
    }

    console.error('[ai/event-query]', error);

    if (!prompt) return jsonError(error);
    return jsonOk({ ...keywordFallback(prompt), degraded: true, reason: 'assistant_error' });
  }
}
