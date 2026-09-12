import { NextResponse } from 'next/server';
import { cleanParam, companyOrderBy, parseLimit, searchCompanies } from '@/lib/companies/search';
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
      category: cleanParam(searchParams.get('category')),
      employeeRange: cleanParam(searchParams.get('employeeRange')),
      region: cleanParam(searchParams.get('location')),
      country: cleanParam(searchParams.get('country')),
      city: cleanParam(searchParams.get('city')),
      keywords: splitKeywords(searchParams.get('keywords')),
      sort: parseSort(searchParams.get('sort')),
    };

    // A re-ordered result set has no stable cursor, so those pages walk by
    // offset instead. Cursor pagination stays the default path.
    const { supportsCursor } = companyOrderBy(filters);

    const result = await searchCompanies({
      filters,
      limit,
      cursor,
      offset: supportsCursor ? 0 : (page - 1) * limit,
    });

    return NextResponse.json({
      ...result,
      pagination: supportsCursor ? 'cursor' : 'offset',
      page,
      limit,
    });
  } catch (error) {
    console.error('Failed to fetch companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}
