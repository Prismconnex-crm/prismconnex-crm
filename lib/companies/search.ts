import {
  MAX_COMPANY_LIMIT,
  expandEmployeeRange,
  type CompanySort,
} from '@/lib/companies/nl-query';

export const DEFAULT_LIMIT = 30;
// The assistant answers "list 500 companies in IT" by asking for one page of
// 500, so the ceiling is the panel's largest page size, not the rail's.
export const MAX_LIMIT = MAX_COMPANY_LIMIT;

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

export type CompanyRow = {
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

export type SqlParam = string | number;

export type CompanySearchFilters = {
  search: string | null;
  category: string | null;
  employeeRange: string | null;
  region: string | null;
  country: string | null;
  /** First comma-segment of `headquarters`, e.g. "Bengaluru". */
  city?: string | null;
  /** AND-ed free-text terms matched against name and tags. */
  keywords?: string[];
  sort?: CompanySort;
};

/** Injectable so tests can run with no database. */
export type CompanyRowSource = (sql: string, params: SqlParam[]) => Promise<CompanyRow[]>;

/**
 * Prisma is imported lazily, NOT at module scope.
 *
 * The assistant's adapter registry pulls this module into every test file's
 * import graph. A static `import { prisma }` would construct a PrismaClient
 * during collection and fail the whole suite on a machine with no reachable
 * DATABASE_URL — even for tests that never touch companies.
 */
const defaultRowSource: CompanyRowSource = async (sql, params) => {
  const { prisma } = await import('@/lib/db/prisma');
  return prisma.$queryRawUnsafe<CompanyRow[]>(sql, ...params);
};

export function splitList(value: string | null | undefined) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

export function cleanParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseLimit(value: string | null) {
  const requested = Number.parseInt(value || String(DEFAULT_LIMIT), 10);
  if (!Number.isFinite(requested)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, requested));
}

export function formatCompany(row: CompanyRow) {
  return {
    ...row,
    name: row.name.replace(/\s+\d+$/, ''),
    category: row.category ?? '',
    description: row.description ?? '',
    domain: row.domain ?? '',
    website: row.website ?? '',
    founded: row.founded ?? '',
    employeeRange: row.employeeRange ?? '',
    headquarters: row.headquarters ?? '',
    region: row.region ?? '',
    revenueRange: row.revenueRange ?? '',
    engagementScore: row.engagementScore ?? 0,
    trustSignals: row.trustSignals ?? '',
    tags: splitList(row.tags),
    email: row.email ?? '',
    phone: row.phone ?? '',
    highlights: splitList(row.highlights),
    insights: splitList(row.insights),
    events: [],
    deals: [],
    activity: [],
  };
}

export type FormattedCompany = ReturnType<typeof formatCompany>;

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
  'United States of America': ['USA', 'United States'],
  'United Kingdom': ['UK', 'United Kingdom'],
  // legacy short forms, still accepted from saved/shared URLs
  USA: ['USA', 'United States'],
  UK: ['UK', 'United Kingdom'],
};

// Each country lives in exactly one region; pinning it lets the query planner
// use the (category, region, ...) composite indexes instead of probing the
// whole table for the headquarters suffix.
// Only the countries actually present in the dataset need a region pin; any
// other country simply skips this optimisation.
const COUNTRY_REGION: Record<string, string> = {
  'United States of America': 'Americas',
  USA: 'Americas',
  Canada: 'Americas',
  'United Kingdom': 'Europe',
  UK: 'Europe',
  Germany: 'Europe',
  France: 'Europe',
  India: 'Asia-Pacific',
  Japan: 'Asia-Pacific',
  Singapore: 'Asia-Pacific',
  Australia: 'Asia-Pacific',
};

// `headquarters` is "City, [State,] Country", so the city is the first
// comma-segment. Matched by equality against the same expression the
// idx_discovery_city index is built on — a leading-wildcard LIKE could never
// use an index.
const CITY_EXPR = `trim(split_part(headquarters, ',', 1))`;

/**
 * Builds the WHERE clause shared by the list query and the count query.
 *
 * `p` is the caller's own placeholder allocator, so both queries can be built
 * from the same filters without their parameter numbering colliding.
 */
function buildCompanyWhere(
  filters: CompanySearchFilters,
  p: (value: SqlParam) => string
): string[] {
  const { search, category, employeeRange, region, country, city } = filters;
  const keywords = filters.keywords ?? [];
  const where: string[] = [];

  /**
   * The dataset stores a category in two spellings: the bulk rows are
   * lowercase ("financial services"), while the real-company import used
   * title case ("Financial Services"). The rail always sends the lowercase
   * vocabulary from lib/company-classification, so a plain equality silently
   * dropped the title-cased rows — "Financial Services" + Europe returned an
   * empty page while 41 matching companies sat in the table.
   *
   * IN (...) over the spelling variants rather than lower(category) = $1:
   * an expression comparison cannot use idx_discovery_cat_region_cursor, and
   * a sequential scan over the whole table is not an option here.
   */
  if (category) {
    const lower = category.toLowerCase();
    const titleCase = lower.replace(
      /(^|[\s&/,-]+)([a-z])/g,
      (_, prefix, letter) => prefix + letter.toUpperCase()
    );
    const variants = Array.from(new Set([category, lower, titleCase]));
    where.push(`category IN (${variants.map((value) => p(value)).join(',')})`);
  }

  // A band the rail picked ("51-200") and one the assistant read out of a
  // question ("200-500") expand the same way — into the stored buckets the
  // request fully covers.
  if (employeeRange) {
    const values = expandEmployeeRange(employeeRange);
    where.push(`"employeeRange" IN (${values.map((value) => p(value)).join(',')})`);
  }

  if (region) where.push(`region = ${p(region)}`);

  if (country) {
    const names = COUNTRY_ALIASES[country] ?? [country];
    where.push(`${COUNTRY_EXPR} IN (${names.map((name) => p(name)).join(',')})`);
    const inferredRegion = COUNTRY_REGION[country];
    if (inferredRegion && !region) {
      where.push(`region = ${p(inferredRegion)}`);
    }
  }

  if (city) where.push(`${CITY_EXPR} = ${p(city)}`);

  // Keywords are AND-ed (every term must appear) but OR-ed across the two
  // columns. Deliberately not `description`: it has no trigram index, and
  // including it turns each keyword into a sequential scan.
  for (const keyword of keywords) {
    const pattern = `%${keyword.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
    where.push(`(name ILIKE ${p(pattern)} OR tags ILIKE ${p(pattern)})`);
  }

  // ── Search mode: case-insensitive prefix search via the lower(name) index ──
  // idx_discovery_name_lower_pattern is a text_pattern_ops index, which only
  // serves the pattern operators (~>=~ / ~<~), not collation-aware >= / < —
  // and unlike a parameterized LIKE it stays index-scannable with bound
  // parameters. ORDER BY must use the same operator ordering to stay sorted.
  if (search) {
    const lower = search.toLowerCase();
    const upperBound =
      lower.slice(0, -1) + String.fromCharCode(lower.charCodeAt(lower.length - 1) + 1);
    where.push(`lower(name) ~>=~ ${p(lower)} AND lower(name) ~<~ ${p(upperBound)}`);
  }

  return where;
}

/**
 * Page ordering, and whether it can be paged by cursor.
 *
 * Only the default order (rowCursor DESC — newest first, since the Indian MNC
 * import went in last) is stable enough for a cursor. `top` and `name`
 * re-order the whole result set, so those page by OFFSET. Name ordering uses
 * the same pattern operator as the prefix filter so it stays served by
 * idx_discovery_name_lower_pattern.
 */
export function companyOrderBy(filters: CompanySearchFilters): {
  clause: string;
  supportsCursor: boolean;
} {
  const sort = filters.sort ?? 'relevance';
  if (sort === 'name' || (sort === 'relevance' && filters.search)) {
    return { clause: 'ORDER BY lower(name) USING ~<~', supportsCursor: false };
  }
  if (sort === 'top') {
    return {
      clause: 'ORDER BY "engagementScore" DESC NULLS LAST, "DiscoveryCompany"."rowCursor" DESC',
      supportsCursor: false,
    };
  }
  return { clause: 'ORDER BY "DiscoveryCompany"."rowCursor" DESC', supportsCursor: true };
}

export function buildCompanyQuery(
  filters: CompanySearchFilters,
  limit: number,
  cursor: number,
  offset = 0
): { sql: string; params: SqlParam[] } {
  const params: SqlParam[] = [];
  // Postgres positional placeholders: push the value, use the returned $n.
  const p = (value: SqlParam) => {
    params.push(value);
    return `$${params.length}`;
  };

  const where = buildCompanyWhere(filters, p);
  const { clause, supportsCursor } = companyOrderBy(filters);

  if (supportsCursor && cursor > 0) where.push(`"rowCursor" < ${p(cursor)}`);

  const whereClause = where.length > 0 ? where.join(' AND ') : '1 = 1';
  const offsetClause = !supportsCursor && offset > 0 ? ` OFFSET ${p(offset)}` : '';

  return {
    sql: `
      SELECT ${LIST_COLUMNS}
      FROM "DiscoveryCompany"
      WHERE ${whereClause}
      ${clause}
      LIMIT ${p(limit + 1)}${offsetClause}
    `,
    params,
  };
}

/** Above this the count stops early and is reported as "N+". */
export const COUNT_CEILING = 5000;

export function buildCompanyCountQuery(
  filters: CompanySearchFilters,
  ceiling = COUNT_CEILING
): { sql: string; params: SqlParam[] } {
  const params: SqlParam[] = [];
  const p = (value: SqlParam) => {
    params.push(value);
    return `$${params.length}`;
  };

  const where = buildCompanyWhere(filters, p);
  const whereClause = where.length > 0 ? where.join(' AND ') : '1 = 1';

  // Bounded, not exact: an unrestricted COUNT(*) walks every matching row,
  // which is seconds on a broad filter. Stopping at the ceiling keeps the
  // answer inside a page load; the caller renders a capped figure as "N+".
  return {
    sql: `
      SELECT count(*)::int AS count
      FROM (
        SELECT 1
        FROM "DiscoveryCompany"
        WHERE ${whereClause}
        LIMIT ${p(ceiling + 1)}
      ) AS bounded
    `,
    params,
  };
}

/**
 * `total` and `totalPages` are deliberately null: counting the discovery
 * dataset per request is too slow, so the UI pages by cursor instead. Callers
 * must render an absent count rather than reporting zero — `countCompanies`
 * is the (bounded) way to get a figure.
 */
export async function searchCompanies(input: {
  filters: CompanySearchFilters;
  limit: number;
  cursor: number;
  /** Row offset, used only by the sorts that cannot page by cursor. */
  offset?: number;
  rowSource?: CompanyRowSource;
}): Promise<{
  companies: FormattedCompany[];
  nextCursor: string | null;
  hasNextPage: boolean;
  total: null;
  totalPages: null;
}> {
  const { sql, params } = buildCompanyQuery(
    input.filters,
    input.limit,
    input.cursor,
    input.offset ?? 0
  );
  const rows = await (input.rowSource ?? defaultRowSource)(sql, params);

  // One row is over-fetched purely to detect a next page.
  const pageRows = rows.slice(0, input.limit);
  const hasNextPage = rows.length > input.limit;
  const lastRow = pageRows[pageRows.length - 1];

  return {
    companies: pageRows.map(formatCompany),
    nextCursor: hasNextPage ? String(lastRow?.rowCursor ?? '') : null,
    hasNextPage,
    total: null,
    totalPages: null,
  };
}

/**
 * Bounded match count. `capped` means the real total is higher than `count` —
 * present it as "N+", never as an exact figure.
 */
export async function countCompanies(input: {
  filters: CompanySearchFilters;
  ceiling?: number;
  /** Injectable so tests can run with no database. */
  countSource?: (sql: string, params: SqlParam[]) => Promise<Array<{ count: number }>>;
}): Promise<{ count: number; capped: boolean }> {
  const ceiling = input.ceiling ?? COUNT_CEILING;
  const { sql, params } = buildCompanyCountQuery(input.filters, ceiling);
  const source =
    input.countSource ??
    (async (query: string, values: SqlParam[]) => {
      const { prisma } = await import('@/lib/db/prisma');
      return prisma.$queryRawUnsafe<Array<{ count: number }>>(query, ...values);
    });

  const rows = await source(sql, params);
  const raw = Number(rows[0]?.count ?? 0);
  return raw > ceiling ? { count: ceiling, capped: true } : { count: raw, capped: false };
}
