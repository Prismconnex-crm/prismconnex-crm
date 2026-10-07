import { NextResponse } from 'next/server';
import { cleanParam } from '@/lib/companies/search';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

/**
 * Company names for the rail's "Company Name" picker.
 *
 * Deliberately NOT "every name": the discovery dataset holds 257,245 of them
 * and every one is distinct, so a full list is ~9.5 MB of JSON per page load
 * and a dropdown that needs virtualising. Instead the picker asks for the
 * first page A-Z and re-asks with `?q=` as the user types — the prefix search
 * is served by idx_discovery_name_lower_pattern, so it answers in
 * milliseconds and the list still feels like the whole catalog.
 *
 * Names come back RAW (with the seeded numeric suffix). The caller strips the
 * suffix for display and sends the raw value back as the filter, so the chip
 * reads like the rest of the UI while still matching exactly one row.
 *
 * Intentionally NOT tenant-scoped, like /api/companies — the discovery dataset
 * is shared reference data, not workspace data.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = cleanParam(searchParams.get('q'));
    const requested = Number.parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const limit = Number.isFinite(requested)
      ? Math.min(MAX_LIMIT, Math.max(1, requested))
      : DEFAULT_LIMIT;

    const { prisma } = await import('@/lib/db/prisma');

    // DISTINCT is deliberately absent: name is unique across the table
    // (257,245 rows, 257,245 distinct), so de-duplicating would cost a sort
    // over the whole table and remove nothing.
    //
    // The ~>=~ / ~<~ pattern operators and the matching ORDER BY are what keep
    // this on idx_discovery_name_lower_pattern — a text_pattern_ops index does
    // not serve collation-aware >= / <, and an unbounded ORDER BY lower(name)
    // would sort 257k rows per keystroke.
    const rows = query
      ? await (async () => {
          const lower = query.toLowerCase();
          const upperBound =
            lower.slice(0, -1) + String.fromCharCode(lower.charCodeAt(lower.length - 1) + 1);
          return prisma.$queryRawUnsafe<Array<{ name: string }>>(
            `SELECT name
             FROM "DiscoveryCompany"
             WHERE lower(name) ~>=~ $1 AND lower(name) ~<~ $2
             ORDER BY lower(name) USING ~<~
             LIMIT $3`,
            lower,
            upperBound,
            limit
          );
        })()
      : await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `SELECT name
           FROM "DiscoveryCompany"
           ORDER BY lower(name) USING ~<~
           LIMIT $1`,
          limit
        );

    return NextResponse.json({ names: rows.map((row) => row.name) });
  } catch (error) {
    console.error('Failed to fetch company names:', error);
    return NextResponse.json({ error: 'Failed to fetch company names' }, { status: 500 });
  }
}
