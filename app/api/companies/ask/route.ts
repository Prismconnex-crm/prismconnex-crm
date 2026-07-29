import { NextRequest } from 'next/server';
import { ApiError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';
import { validateBody } from '@/lib/http/validate';
import { askQuerySchema } from '@/models/event-query';
import { askAboutCompaniesOrEvents, isConfigured } from '@/services/event-query.service';

/**
 * Natural-language search for the Companies tab.
 *
 * Like /api/companies, this route is intentionally NOT tenant-scoped — the
 * trade-show catalog is a shared discovery dataset, not workspace data.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isConfigured()) {
      // No API key configured: tell the UI to fall back to plain prefix search
      // rather than surfacing an error to the user.
      return jsonOk({ intent: 'unavailable' as const }, 503);
    }

    const body = await request.json();
    const { q } = validateBody(askQuerySchema, body);

    const result = await askAboutCompaniesOrEvents(q);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error);
    }
    // Upstream failures (rate limit, overload, network) shouldn't break the
    // search box — the client falls back to prefix search on a non-200.
    console.error('[companies/ask]', error);
    return jsonError(error);
  }
}
