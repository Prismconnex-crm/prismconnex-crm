import { NextRequest } from 'next/server';
import { ApiError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';
import { validateBody } from '@/lib/http/validate';
import { eventAnswerRequestSchema } from '@/models/ai-event-query';
import { answerFromRows, isConfigured } from '@/services/ai-event-query.service';

/**
 * Answers the user's original question from the rows that were actually
 * matched. The client sends the top rows of its own result set, and the model
 * is told those rows are the entire evidence base — so the answer can restate
 * the catalog but never invent an event.
 *
 * Like /api/companies, this route is intentionally NOT tenant-scoped.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = validateBody(eventAnswerRequestSchema, body);

    // No key, no answer — the table below still renders, so this is a missing
    // nicety rather than a failure.
    if (!isConfigured()) {
      return jsonOk({ answer: null, degraded: true });
    }

    return jsonOk({ answer: await answerFromRows(input), degraded: false });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode < 500) {
      return jsonError(error);
    }

    console.error('[ai/event-answer]', error);
    return jsonOk({ answer: null, degraded: true });
  }
}
