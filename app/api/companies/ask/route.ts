import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';
import { validateBody } from '@/lib/http/validate';
import { askQuerySchema } from '@/models/event-query';
import {
  askAboutCompaniesOrEvents,
  describeAssistantFailure,
  isConfigured,
} from '@/services/event-query.service';
import {
  MAX_COMPANY_LIMIT,
  buildCompanyFilterChips,
  clampCompanyLimit,
  companyQueryToFilters,
  describeCompanyQuery,
  emptyCompanyQuery,
  parseCompanyQuery,
  type CompanyQueryState,
} from '@/lib/companies/nl-query';
import { companyOrderBy, countCompanies, searchCompanies } from '@/lib/companies/search';

/**
 * Natural-language search for the Companies tab.
 *
 * Two modes, told apart by the request body:
 *
 * - `mode: "structured"` — the "Find anything" panel. Deterministic: the
 *   question is parsed by dictionary and regex (lib/companies/nl-query) and
 *   answered straight from the discovery dataset. No model call, so it works
 *   with no ANTHROPIC_API_KEY and costs one round trip.
 * - no mode — the legacy rail search box, which asks the model whether the
 *   question is about companies or trade shows. Unchanged.
 *
 * Like /api/companies, this route is intentionally NOT tenant-scoped — the
 * discovery dataset is shared reference data, not workspace data.
 */

const queryStateSchema = z.object({
  search: z.string().trim().min(1).max(200).nullable().default(null),
  category: z.string().trim().min(1).max(120).nullable().default(null),
  region: z.string().trim().min(1).max(120).nullable().default(null),
  country: z.string().trim().min(1).max(120).nullable().default(null),
  city: z.string().trim().min(1).max(120).nullable().default(null),
  employeeRange: z.string().trim().min(1).max(40).nullable().default(null),
  keywords: z.array(z.string().trim().min(1).max(60)).max(4).default([]),
  limit: z.number().int().min(1).max(MAX_COMPANY_LIMIT).default(25),
  sort: z.enum(['relevance', 'top', 'name']).default('relevance'),
});

const structuredSchema = z.object({
  q: z.string().trim().min(1).max(500),
  mode: z.literal('structured'),
  /**
   * Supplied instead of parsing `q` when the caller already holds the state —
   * a chip removal, a rail click, or a restored history entry. Keeps the
   * answer and the count in step with the list without re-reading the
   * sentence, which could otherwise re-add the filter just removed.
   */
  filters: queryStateSchema.partial().optional(),
  page: z.number().int().min(1).max(1000).optional(),
});

async function answerStructured(body: unknown) {
  const { q, filters, page } = validateBody(structuredSchema, body);

  const state: CompanyQueryState = filters
    ? { ...emptyCompanyQuery(), ...queryStateSchema.parse(filters) }
    : parseCompanyQuery(q);
  state.limit = clampCompanyLimit(state.limit);

  const searchFilters = companyQueryToFilters(state);
  const { supportsCursor } = companyOrderBy(searchFilters);
  const offset = supportsCursor ? 0 : ((page ?? 1) - 1) * state.limit;

  // The count is bounded (see countCompanies) and runs alongside the page, so
  // the panel's summary costs no extra latency over the rows themselves.
  const [list, total] = await Promise.all([
    searchCompanies({ filters: searchFilters, limit: state.limit, cursor: 0, offset }),
    countCompanies({ filters: searchFilters }),
  ]);

  return jsonOk({
    parsedQuery: state,
    chips: buildCompanyFilterChips(state),
    answer: describeCompanyQuery({
      state,
      total: total.count,
      capped: total.capped,
      shown: list.companies.length,
    }),
    totalCount: total.count,
    totalCountCapped: total.capped,
    companies: list.companies,
    hasNextPage: list.hasNextPage,
    nextCursor: list.nextCursor,
  });
}

export async function POST(request: NextRequest) {
  let query = '';

  try {
    const body = await request.json();

    if (body?.mode === 'structured') {
      return await answerStructured(body);
    }

    if (!isConfigured()) {
      // Surfaced in the UI rather than silently falling back: a dormant
      // feature with no explanation is indistinguishable from a broken one.
      return jsonOk(
        { intent: 'unavailable' as const, reason: 'missing_api_key' as const },
        503
      );
    }

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
