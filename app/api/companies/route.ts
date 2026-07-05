import { NextResponse } from "next/server";
import { ensureSQLiteReadPragmas, prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Only select columns we actually need for the list view (faster I/O)
const LIST_COLUMNS = `
  rowid AS rowCursor,
  id,
  name,
  category,
  domain,
  founded,
  employeeRange,
  headquarters,
  region,
  engagementScore,
  tags,
  highlights,
  insights
`;

// Full columns for detail view (when needed)
const DETAIL_COLUMNS = `
  rowid AS rowCursor,
  id,
  name,
  category,
  description,
  domain,
  website,
  founded,
  employeeRange,
  headquarters,
  region,
  revenueRange,
  engagementScore,
  trustSignals,
  tags,
  email,
  phone,
  highlights,
  insights
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
    await ensureSQLiteReadPragmas();

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const search = cleanParam(searchParams.get("search"));
    const category = cleanParam(searchParams.get("category"));
    const employeeRange = cleanParam(searchParams.get("employeeRange"));
    const region = cleanParam(searchParams.get("location"));
    const afterRowid = Number.parseInt(searchParams.get("cursor") || "0", 10) || 0;

    const where: string[] = [];
    const params: SqlParam[] = [];

    // ── Search mode: case-insensitive prefix search via the NOCASE name index ──
    if (search) {
      const upperBound = search.slice(0, -1) + String.fromCharCode(search.charCodeAt(search.length - 1) + 1);
      where.push("name >= ? COLLATE NOCASE AND name < ? COLLATE NOCASE");
      params.push(search, upperBound);

      // Add other filters on top of search
      if (category) { where.push("category = ?"); params.push(category); }
      if (employeeRange) { where.push("employeeRange = ?"); params.push(employeeRange); }
      if (region) { where.push("region = ?"); params.push(region); }

      const sql = `
        SELECT ${LIST_COLUMNS}
        FROM Company
        WHERE ${where.join(" AND ")}
        ORDER BY name COLLATE NOCASE ASC
        LIMIT ?
      `;

      const rows = await prisma.$queryRawUnsafe<CompanyRow[]>(sql, ...params, limit + 1);
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

    // ── Browse mode: use rowid for instant pagination ──
    // rowid DESC shows newest companies first (Indian MNCs were inserted last = highest rowids)
    if (category) { where.push("category = ?"); params.push(category); }
    if (employeeRange) { where.push("employeeRange = ?"); params.push(employeeRange); }
    if (region) { where.push("region = ?"); params.push(region); }

    // Cursor-based pagination using rowid
    if (afterRowid > 0) {
      where.push("rowid < ?");
      params.push(afterRowid);
    }

    const whereClause = where.length > 0 ? where.join(" AND ") : "1 = 1";

    const sql = `
      SELECT ${LIST_COLUMNS}
      FROM Company
      WHERE ${whereClause}
      ORDER BY rowid DESC
      LIMIT ?
    `;

    const rows = await prisma.$queryRawUnsafe<CompanyRow[]>(sql, ...params, limit + 1);
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
