import { NextResponse } from 'next/server';
import { cleanParam, parseLimit, searchCompanies } from '@/lib/companies/search';

export const dynamic = 'force-dynamic';

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

    const result = await searchCompanies({
      filters: {
        search: cleanParam(searchParams.get('search')),
        category: cleanParam(searchParams.get('category')),
        employeeRange: cleanParam(searchParams.get('employeeRange')),
        region: cleanParam(searchParams.get('location')),
        country: cleanParam(searchParams.get('country')),
      },
      limit,
      cursor,
    });

    return NextResponse.json({ ...result, pagination: 'cursor', page, limit });
  } catch (error) {
    console.error('Failed to fetch companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}
