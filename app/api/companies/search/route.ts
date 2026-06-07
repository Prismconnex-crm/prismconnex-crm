/**
 * /api/companies/search
 * 
 * Prefix-first typeahead search endpoint.
 * 
 * When OpenSearch is configured (OPENSEARCH_URL env var):
 *   → Uses search_as_you_type with multi_match bool_prefix
 *   → Domain boost when query looks like a domain
 *   → search_after cursor pagination
 * 
 * When OpenSearch is NOT configured (dev fallback):
 *   → Uses SQLite with optimized prefix search via indexed name column
 *   → Still provides cursor pagination and fast results
 */

import { NextResponse } from "next/server";
import { getOpenSearchClient, COMPANIES_INDEX, isOpenSearchEnabled } from "@/lib/opensearch";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// ─── Types ───────────────────────────────────────────────────

interface SearchHit {
  id: string;
  name: string;
  nameKeyword: string;
  domainNorm: string;
  category: string;
  employeeRange: string;
  region: string;
  headquarters: string;
  description?: string;
  website?: string;
  founded?: string;
  revenueRange?: string;
  trustSignals?: string;
  tags?: string[];
  email?: string;
  phone?: string;
  highlights?: string;
  insights?: string;
  popularityScore: number;
}

interface SearchResponse {
  items: SearchHit[];
  nextCursor: string | null;
  tookMs: number;
  total: number;
  source: "opensearch" | "sqlite";
}

// ─── OpenSearch Search ───────────────────────────────────────

async function searchOpenSearch(
  q: string,
  filters: { category?: string; employeeRange?: string; region?: string },
  cursor: unknown[] | null,
  size: number
): Promise<SearchResponse> {
  const client = getOpenSearchClient();
  if (!client) throw new Error("OpenSearch client not available");

  const isDomainQuery = q.includes(".") && !q.includes(" ");

  // Build filter clauses — only include filters that are provided
  const filterClauses: Record<string, unknown>[] = [];
  if (filters.category) filterClauses.push({ term: { category: filters.category } });
  if (filters.employeeRange) filterClauses.push({ term: { employeeRange: filters.employeeRange } });
  if (filters.region) filterClauses.push({ term: { region: filters.region } });

  // Build query
  let query: Record<string, unknown>;

  if (isDomainQuery) {
    // Domain boost query
    query = {
      bool: {
        should: [
          { term: { domainNorm: { value: q.toLowerCase(), boost: 12 } } },
          {
            multi_match: {
              query: q,
              type: "bool_prefix",
              fields: ["name", "name._2gram", "name._3gram"],
              operator: "and",
              boost: 2,
            },
          },
        ],
        minimum_should_match: 1,
        ...(filterClauses.length > 0 ? { filter: filterClauses } : {}),
      },
    };
  } else {
    // Standard prefix-first typeahead
    query = {
      bool: {
        must: [
          {
            multi_match: {
              query: q,
              type: "bool_prefix",
              fields: ["name", "name._2gram", "name._3gram"],
              operator: "and",
            },
          },
        ],
        ...(filterClauses.length > 0 ? { filter: filterClauses } : {}),
      },
    };
  }

  // Build search body
  const searchBody: Record<string, unknown> = {
    size,
    track_total_hits: false,
    _source: [
      "id", "name", "nameKeyword", "domainNorm", "category",
      "employeeRange", "region", "headquarters", "popularityScore",
      "description", "website", "founded", "revenueRange",
      "trustSignals", "tags", "email", "phone", "highlights", "insights",
    ],
    query,
    sort: [
      { _score: "desc" },
      { popularityScore: { order: "desc", missing: 0 } },
      { nameKeyword: { order: "asc" } },
      { id: { order: "asc" } },
    ],
  };

  // Add cursor for pagination
  if (cursor) {
    searchBody.search_after = cursor;
  }

  const startMs = Date.now();
  const result = await client.search({
    index: COMPANIES_INDEX,
    body: searchBody,
  });
  const tookMs = Date.now() - startMs;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hits: any[] = result.body.hits.hits || [];
  const items: SearchHit[] = hits.map((hit: any) => hit._source as SearchHit);
  const lastHit = hits[hits.length - 1];
  const nextCursor = lastHit?.sort
    ? Buffer.from(JSON.stringify(lastHit.sort)).toString("base64")
    : null;

  const hitsTotal = result.body.hits.total;
  const totalCount = typeof hitsTotal === "number" ? hitsTotal : (hitsTotal?.value ?? items.length);

  return {
    items,
    nextCursor,
    tookMs,
    total: totalCount,
    source: "opensearch",
  };
}

// ─── SQLite Fallback Search ──────────────────────────────────

async function searchSQLite(
  q: string,
  filters: { category?: string; employeeRange?: string; region?: string },
  cursor: string | null,
  size: number
): Promise<SearchResponse> {
  const startMs = Date.now();

  // Build WHERE clauses
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Prefix search on name (uses the @@index on name)
  if (q) {
    conditions.push("name LIKE ?");
    params.push(`${q}%`); // Prefix match — uses index!
  }

  if (filters.category) {
    conditions.push("category = ?");
    params.push(filters.category);
  }
  if (filters.employeeRange) {
    conditions.push("employeeRange = ?");
    params.push(filters.employeeRange);
  }
  if (filters.region) {
    conditions.push("region = ?");
    params.push(filters.region);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Cursor-based pagination using rowid
  let cursorClause = "";
  if (cursor) {
    try {
      const cursorData = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
      if (cursorData.lastRowId) {
        cursorClause = `AND rowid > ${Number(cursorData.lastRowId)}`;
      }
    } catch {
      // Invalid cursor, ignore
    }
  }

  const query = `
    SELECT rowid, id, name, domain, category, employeeRange, region, 
           headquarters, description, website, founded, revenueRange,
           engagementScore, trustSignals, tags, email, phone,
           highlights, insights
    FROM Company
    ${whereClause} ${cursorClause}
    ORDER BY engagementScore DESC, name ASC
    LIMIT ${size}
  `;

  const rows = await prisma.$queryRawUnsafe(query, ...params) as Array<Record<string, unknown>>;
  const tookMs = Date.now() - startMs;

  const items: SearchHit[] = rows.map((row) => ({
    id: String(row.id || ""),
    name: String(row.name || "").replace(/\s+\d+$/, ""),
    nameKeyword: String(row.name || "").replace(/\s+\d+$/, ""),
    domainNorm: String(row.domain || ""),
    category: String(row.category || ""),
    employeeRange: String(row.employeeRange || ""),
    region: String(row.region || ""),
    headquarters: String(row.headquarters || ""),
    description: String(row.description || ""),
    website: String(row.website || ""),
    founded: String(row.founded || ""),
    revenueRange: String(row.revenueRange || ""),
    trustSignals: String(row.trustSignals || ""),
    tags: row.tags ? String(row.tags).split(",").map((t: string) => t.trim()) : [],
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    highlights: String(row.highlights || ""),
    insights: String(row.insights || ""),
    popularityScore: Number(row.engagementScore) || 0,
  }));

  // Build next cursor from last row's rowid
  const lastRow = rows[rows.length - 1];
  const nextCursor = lastRow?.rowid
    ? Buffer.from(JSON.stringify({ lastRowId: Number(lastRow.rowid) })).toString("base64")
    : null;

  return {
    items,
    nextCursor,
    tookMs,
    total: items.length,
    source: "sqlite",
  };
}

// ─── Route Handler ───────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const q = (searchParams.get("q") || "").trim();
    const category = searchParams.get("category") || undefined;
    const employeeRange = searchParams.get("employeeRange") || undefined;
    const region = searchParams.get("region") || undefined;
    const cursorParam = searchParams.get("cursor") || null;
    const size = Math.min(50, Math.max(1, Number(searchParams.get("size") || "25")));

    if (!q && !category && !employeeRange && !region) {
      return NextResponse.json({
        items: [],
        nextCursor: null,
        tookMs: 0,
        total: 0,
        source: "none",
        message: "Provide at least q, category, employeeRange, or region",
      });
    }

    let result: SearchResponse;

    if (isOpenSearchEnabled()) {
      // Parse cursor for OpenSearch (search_after array)
      let cursor: unknown[] | null = null;
      if (cursorParam) {
        try {
          cursor = JSON.parse(Buffer.from(cursorParam, "base64").toString("utf-8"));
        } catch {
          cursor = null;
        }
      }
      result = await searchOpenSearch(q, { category, employeeRange, region }, cursor, size);
    } else {
      // SQLite fallback
      result = await searchSQLite(q, { category, employeeRange, region }, cursorParam, size);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { error: "Search failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
