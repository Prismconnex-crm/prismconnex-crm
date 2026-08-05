import { NextRequest } from 'next/server';
import { ApiError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';
import { validateBody } from '@/lib/http/validate';
import { askQuerySchema } from '@/models/event-query';
import {
  askAboutCompaniesOrEvents,
  describeAssistantFailure,
  isConfigured,
} from '@/services/event-query.service';

/**
 * Natural-language search for the Companies tab.
 *
 * Like /api/companies, this route is intentionally NOT tenant-scoped — the
 * trade-show catalog is a shared discovery dataset, not workspace data.
 */
export async function POST(request: NextRequest) {
  let query = '';

  try {
    if (!isConfigured()) {
      // Surfaced in the UI rather than silently falling back: a dormant
      // feature with no explanation is indistinguishable from a broken one.
      return jsonOk(
        { intent: 'unavailable' as const, reason: 'missing_api_key' as const },
        503
      );
    }

    const body = await request.json();
    const { q } = validateBody(askQuerySchema, body);
    query = q;

    return jsonOk(await askAboutCompaniesOrEvents(q));
  } catch (error) {
    // A bad request body is the caller's problem and should surface as a 4xx.
    if (error instanceof ApiError && error.statusCode < 500) {
      return jsonError(error);
    }

    console.error('[companies/ask]', error);

    // Nothing was validated yet, so there is no query to fall back on.
    if (!query) return jsonError(error);

    const failure = describeAssistantFailure(error);
    if (failure.kind === 'unavailable') {
      return jsonOk({ intent: 'unavailable' as const, reason: failure.reason }, 503);
    }

    // Rate limit, overload, network, or an answer we couldn't use: hand the
    // raw query back so the client's prefix search takes over silently.
    return jsonOk({
      intent: 'companies' as const,
      name: query,
      degraded: true,
      reason: failure.reason,
    });
  }
}
