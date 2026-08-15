import { validateBody } from '@/lib/http/validate';
import { jsonError, jsonOk } from '@/lib/http/response';
import { eventAnswerRequestSchema } from '@/models/ai-event-query';
import { answerFromRows, isConfigured } from '@/services/ai-event-query.service';

export const dynamic = 'force-dynamic';

/**
 * Writes the one-paragraph summary above the results. The rows are supplied by
 * the client from the set it already matched, and they are the model's entire
 * evidence base — nothing is read from the catalog here, so the summary cannot
 * describe an event that is not in the table underneath it.
 *
 * A null answer is a valid response: the caller renders the table regardless,
 * and treats a missing summary as nothing worth showing an error for.
 */
export async function POST(request: Request) {
  try {
    const body = validateBody(eventAnswerRequestSchema, await request.json());

    if (!isConfigured()) {
      return jsonOk({ answer: null, degraded: true, reason: 'missing_api_key' });
    }

    try {
      return jsonOk({ answer: await answerFromRows(body) });
    } catch (error) {
      console.error('[ai/event-answer] summary failed:', error);
      return jsonOk({ answer: null, degraded: true, reason: 'assistant_error' });
    }
  } catch (error) {
    return jsonError(error);
  }
}
