import { NextResponse } from 'next/server';
import {
  cleanParam,
  companyOrderBy,
  countCompanies,
  parseLimit,
  searchCompanies,
} from '@/lib/companies/search';
import { splitKeywords, type CompanySort } from '@/lib/companies/nl-query';

export const dynamic = 'force-dynamic';

const SORTS: CompanySort[] = ['relevance', 'top', 'name'];

function parseSort(value: string | null): CompanySort {
  return SORTS.includes(value as CompanySort) ? (value as CompanySort) : 'relevance';
}

/**
 * Intentionally NOT tenant-scoped: the discovery dataset is shared reference
 * data, not workspace data. Query construction lives in lib/companies/search.ts
 * so the assistant's companies adapter can reuse it without going over HTTP.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const cursor = Number.parseInt(searchParams.get('cursor') || '0', 10) || 0;

    const filters = {
      search: cleanParam(searchParams.get('search')),
      companyName: cleanParam(searchParams.get('companyName')),
      category: cleanParam(searchParams.get('category')),
      employeeRange: cleanParam(searchParams.get('employeeRange')),
      region: cleanParam(searchParams.get('location')),
      country: cleanParam(searchParams.get('country')),
      city: cleanParam(searchParams.get('city')),
      keywords: splitKeywords(searchParams.get('keywords')),
      sort: parseSort(searchParams.get('sort')),
    };

    /**
     * Cursor only when the caller actually supplies one.
     *
     * The numbered paginator jumps straight to page N, which a cursor cannot
     * express — cursors only walk forward from where you already are. So a
     * request that names a page is served by OFFSET, and the cursor path is
     * kept for callers that hand one back.
     */
    const { supportsCursor } = companyOrderBy(filters);
    const useCursor = supportsCursor && cursor > 0;

    /**
     * The count is opt-in. Only the numbered paginator needs a page count, and
     * it is a second round trip — callers that just want rows (the assistant,
     * the saved-company lookups) should not pay for it. Requested in parallel
     * so it costs the slower of the two, not their sum.
     */
    const withTotal = searchParams.get('withTotal') === '1';

    const [result, total] = await Promise.all([
      searchCompanies({
        filters,
        limit,
        cursor: useCursor ? cursor : 0,
        offset: useCursor ? 0 : (page - 1) * limit,
      }),
      withTotal ? countCompanies({ filters }) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ...result,
      // Stays null unless asked for — see the note on searchCompanies about
      // never reporting an absent count as zero.
      total: total ? total.count : null,
      totalCapped: total ? total.capped : false,
      pagination: useCursor ? 'cursor' : 'offset',
      page,
      limit,
    });
  } catch (error) {
    console.error('Failed to fetch companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}
