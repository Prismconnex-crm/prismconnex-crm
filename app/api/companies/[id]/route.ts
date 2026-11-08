import { NextResponse } from 'next/server';
import { formatCompany, type CompanyRow } from '@/lib/companies/search';

export const dynamic = 'force-dynamic';

/**
 * One company from the discovery dataset, by id.
 *
 * The list route answers "which companies match these filters"; this answers
 * "show me this one". A profile page needs the second: the row has to survive
 * a refresh or a shared link, when nothing is held in client memory any more.
 *
 * Returns the same shape as a row from /api/companies — `formatCompany` is
 * shared, so the name arrives suffix-stripped and the list fields are split
 * the same way. A profile can therefore render a row handed to it by the table
 * or one fetched here without caring which it got.
 *
 * Intentionally NOT tenant-scoped, like /api/companies — the discovery dataset
 * is shared reference data, not workspace data.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { prisma } = await import('@/lib/db/prisma');

    // Parameterised despite $queryRawUnsafe: the id comes from the URL.
    const rows = await prisma.$queryRawUnsafe<CompanyRow[]>(
      // rowCursor is bigint in Postgres and JSON.stringify cannot serialize a
      // BigInt; ::int matches what the list query does (max ~36.5M fits).
      `SELECT "rowCursor"::int AS "rowCursor", id, name, category, description, domain, website, founded,
              "employeeRange", headquarters, region, "revenueRange", "engagementScore",
              "trustSignals", tags, email, phone, highlights, insights
         FROM "DiscoveryCompany"
        WHERE id = $1
        LIMIT 1`,
      id
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ company: formatCompany(rows[0]) });
  } catch (error) {
    console.error('Failed to fetch company:', error);
    return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 });
  }
}
