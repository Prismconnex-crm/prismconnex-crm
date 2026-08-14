import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Only select columns we actually need for the list view (faster I/O).
// rowCursor is bigint in Postgres; cast to int so JSON serialization works
// (max value ~36.5M fits comfortably).
const LIST_COLUMNS = `
  "rowCursor"::int AS "rowCursor",
  id,
  name,
  category,
  domain,
  founded,
  "employeeRange",
  headquarters,
  region,
  "engagementScore",
  tags,
  highlights,
  insights,
  email,
  phone
`;

type CompanyRow = {
  rowCursor: number;
  id: string;
  name: string;
  category: string | null;
  description?: string | null;
  domain: string | null;
  website?: string | null;
  founded: string | null;
  employeeRange: string | null;
  headquarters: string | null;
  region: string | null;
  revenueRange?: string | null;
  engagementScore: number | null;
  trustSignals?: string | null;
  tags: string | null;
  email?: string | null;
  phone?: string | null;
  highlights: string | null;
  insights: string | null;
};

type SqlParam = string | number;

function cleanParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseLimit(value: string | null) {
  const requested = Number.parseInt(value || String(DEFAULT_LIMIT), 10);
  if (!Number.isFinite(requested)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, requested));
}

function splitList(value: string | null) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function formatCompany(row: CompanyRow) {
  return {
    ...row,
    name: row.name.replace(/\s+\d+$/, ""),
    category: row.category ?? "",
    description: row.description ?? "",
    domain: row.domain ?? "",
    website: row.website ?? "",
    founded: row.founded ?? "",
    employeeRange: row.employeeRange ?? "",
    headquarters: row.headquarters ?? "",
    region: row.region ?? "",
    revenueRange: row.revenueRange ?? "",
    engagementScore: row.engagementScore ?? 0,
    trustSignals: row.trustSignals ?? "",
    tags: splitList(row.tags),
    email: row.email ?? "",
    phone: row.phone ?? "",
    highlights: splitList(row.highlights),
    insights: splitList(row.insights),
    events: [],
    deals: [],
    activity: [],
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const search = cleanParam(searchParams.get("search"));
    const category = cleanParam(searchParams.get("category"));
    const employeeRange = cleanParam(searchParams.get("employeeRange"));
    const region = cleanParam(searchParams.get("location"));
    const country = cleanParam(searchParams.get("country"));
    const afterRowid = Number.parseInt(searchParams.get("cursor") || "0", 10) || 0;

    const where: string[] = [];
    const params: SqlParam[] = [];
    // Postgres positional placeholders: push the value, use the returned $n.
    const p = (value: SqlParam) => {
      params.push(value);
      return `$${params.length}`;
    };

    // headquarters is stored as "City, Country" (occasionally "City, State,
    // Country"), so the country is the last comma-segment. Matching the extracted
    // country by equality (rather than a leading-wildcard `LIKE '%, X'`, which can
    // never use an index and full-scans 36M rows) lets the query hit
    // idx_discovery_cat_region_country_emp. The expression MUST match the index's
    // expression exactly. The dataset mixes short/long country names, so match both.
    const COUNTRY_EXPR = `trim(split_part(headquarters, ',', -1))`;
    // The picker shows full country names (see COMPANY_COUNTRIES); the dataset
    // stores shorter forms in `headquarters`. Map the ones that differ so the
    // filter still matches.
    const COUNTRY_ALIASES: Record<string, string[]> = {
      "United States of America": ["USA", "United States"],
      "United Kingdom": ["UK", "United Kingdom"],
      // legacy short forms, still accepted from saved/shared URLs
      USA: ["USA", "United States"],
      UK: ["UK", "United Kingdom"],
    };
    // Each country lives in exactly one region; pinning it lets the query
    // planner use the (category, region, ...) composite indexes instead
    // of probing the whole table for the headquarters suffix.
    // Only the countries actually present in the dataset need a region pin; any
    // other country simply skips this optimisation.
    const COUNTRY_REGION: Record<string, string> = {
      "United States of America": "Americas",
      USA: "Americas",
      Canada: "Americas",
      "United Kingdom": "Europe",
      UK: "Europe",
      Germany: "Europe",
      France: "Europe",
      India: "Asia-Pacific",
      Japan: "Asia-Pacific",
      Singapore: "Asia-Pacific",
      Australia: "Asia-Pacific",
    };
    // The dataset mixes coarse and fine-grained headcount bands; expand the
    // coarse ones so e.g. "51-200" also matches rows stored as "51-100"/"101-200".
    const EMPLOYEE_RANGE_EXPANSION: Record<string, string[]> = {
      "51-200": ["51-200", "51-100", "101-200"],
      "1001-5000": ["1001-5000", "1001-2000", "2001-5000"],
      "1001+": ["1001+", "1001-2000", "2001-5000", "1001-5000", "5001-10000", "10001+"],
    };
    const applyEmployeeFilter = () => {
      if (!employeeRange) return;
      const values = EMPLOYEE_RANGE_EXPANSION[employeeRange] ?? [employeeRange];
      where.push(`"employeeRange" IN (${values.map((v) => p(v)).join(",")})`);
    };
    const applyCountryFilter = () => {
      if (!country) return;
      const names = COUNTRY_ALIASES[country] ?? [country];
      where.push(`${COUNTRY_EXPR} IN (${names.map((n) => p(n)).join(",")})`);
      const inferredRegion = COUNTRY_REGION[country];
      if (inferredRegion && !region) {
        where.push(`region = ${p(inferredRegion)}`);
      }
    };

    // ── Search mode: case-insensitive prefix search via the lower(name) index ──
    // idx_discovery_name_lower_pattern is a text_pattern_ops index, which only
    // serves the pattern operators (~>=~ / ~<~), not collation-aware >= / < —
    // and unlike a parameterized LIKE it stays index-scannable with bound
    // parameters. ORDER BY must use the same operator ordering to stay sorted.
    if (search) {
      const lower = search.toLowerCase();
      const upperBound = lower.slice(0, -1) + String.fromCharCode(lower.charCodeAt(lower.length - 1) + 1);
      where.push(`lower(name) ~>=~ ${p(lower)} AND lower(name) ~<~ ${p(upperBound)}`);

      // Add other filters on top of search
      if (category) where.push(`category = ${p(category)}`);
      applyEmployeeFilter();
      if (region) where.push(`region = ${p(region)}`);
      applyCountryFilter();

      const sql = `
        SELECT ${LIST_COLUMNS}
        FROM "DiscoveryCompany"
        WHERE ${where.join(" AND ")}
        ORDER BY lower(name) USING ~<~
        LIMIT ${p(limit + 1)}
      `;

      const rows = await prisma.$queryRawUnsafe<CompanyRow[]>(sql, ...params);
      const pageRows = rows.slice(0, limit);
      const hasNextPage = rows.length > limit;

      return NextResponse.json({
        companies: pageRows.map(formatCompany),
        pagination: "cursor",
        nextCursor: hasNextPage ? String(pageRows[pageRows.length - 1]?.rowCursor ?? "") : null,
        hasNextPage,
        page,
        limit,
        total: null,
        totalPages: null,
      });
    }

    // ── Browse mode: use rowCursor for instant pagination ──
    // rowCursor DESC shows newest companies first (Indian MNCs were inserted
    // last = highest cursors; rowCursor mirrors the original SQLite rowid).
    if (category) where.push(`category = ${p(category)}`);
    applyEmployeeFilter();
    if (region) where.push(`region = ${p(region)}`);
    applyCountryFilter();

    // Cursor-based pagination using rowCursor
    if (afterRowid > 0) {
      where.push(`"rowCursor" < ${p(afterRowid)}`);
    }

    const whereClause = where.length > 0 ? where.join(" AND ") : "1 = 1";

    const sql = `
      SELECT ${LIST_COLUMNS}
      FROM "DiscoveryCompany"
      WHERE ${whereClause}
      ORDER BY "DiscoveryCompany"."rowCursor" DESC
      LIMIT ${p(limit + 1)}
    `;

    const rows = await prisma.$queryRawUnsafe<CompanyRow[]>(sql, ...params);
    const pageRows = rows.slice(0, limit);
    const hasNextPage = rows.length > limit;
    const lastRow = pageRows[pageRows.length - 1];

    return NextResponse.json({
      companies: pageRows.map(formatCompany),
      pagination: "cursor",
      nextCursor: hasNextPage ? String(lastRow?.rowCursor ?? "") : null,
      hasNextPage,
      page,
      limit,
      total: null,
      totalPages: null,
    });
  } catch (error) {
    console.error("Failed to fetch companies:", error);
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
  }
}
