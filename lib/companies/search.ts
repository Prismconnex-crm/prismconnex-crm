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
  /** Exact catalog name (raw, suffix included), from the rail's Company Name picker. */
  companyName?: string | null;
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
async function runQuery<T>(sql: string, params: SqlParam[]): Promise<T[]> {
  const { prisma } = await import('@/lib/db/prisma');
  return prisma.$queryRawUnsafe<T[]>(sql, ...params);
}

const defaultRowSource: CompanyRowSource = (sql, params) => runQuery<CompanyRow>(sql, params);

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
 * The company name with its spaces removed, so a query typed without spaces
 * can still find a name that has them ("canvaeducation" -> "Canva Education").
 * Must stay character-identical to the expression in
 * prisma/migrations/20260929120000_add_discovery_name_squashed_index — the
 * planner only uses idx_discovery_name_squashed_pattern on an exact match.
 */
const SQUASHED_NAME_EXPR = `replace(lower(name), ' ', '')`;

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
  const companyName = filters.companyName ?? null;
  const keywords = filters.keywords ?? [];
  const where: string[] = [];

  /**
   * Exact company. Compared as lower(name) rather than name so the equality is
   * served by idx_discovery_name_lower_pattern — text_pattern_ops covers `=`
   * as well as the range operators, and there is no plain btree on name.
   */
  if (companyName) where.push(`lower(name) = ${p(companyName.toLowerCase())}`);

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
    // Search is space-insensitive in both directions: the term and the name
    // both have their spaces removed before comparing, so "canvaeducation",
    // "canva education" and "Canva Education" all meet in the middle, and
    // "4 matrix" reaches "4Matrix".
    //
    // One range against the squashed expression, not a second range OR-ed
    // against lower(name): the squashed form already matches everything the
    // as-typed form would, and an OR across the two indexed expressions
    // measured far worse. With ORDER BY on lower(name), the planner preferred
    // walking idx_discovery_name_lower_pattern in order and filtering — 257,555
    // rows discarded, 1.2 s for one hit. Matching the ORDER BY to this
    // expression (see companyOrderBy) keeps filter and sort on the one index:
    // 0.4-4 ms with no filter step, even for a single-letter prefix.
    const squashed = search.trim().toLowerCase().replace(/\s+/g, '');
    if (squashed) {
      const upperBound =
        squashed.slice(0, -1) + String.fromCharCode(squashed.charCodeAt(squashed.length - 1) + 1);
      where.push(
        `${SQUASHED_NAME_EXPR} ~>=~ ${p(squashed)} AND ${SQUASHED_NAME_EXPR} ~<~ ${p(upperBound)}`
      );
    }
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
  // A search orders by the same squashed expression it filters on, so one
  // index scan does both. Ordering by lower(name) instead makes the planner
  // walk that index in order and filter every row against the squashed range
  // — a full pass over the table for a single match. Sort order is otherwise
  // the same, since removing spaces only reorders names that differ by them.
  if (sort === 'relevance' && filters.search) {
    return { clause: `ORDER BY ${SQUASHED_NAME_EXPR} USING ~<~`, supportsCursor: false };
  }
  if (sort === 'name') {
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

  /**
   * A cursor is only actually in play when the caller handed one over. Gating
   * OFFSET on `!supportsCursor` instead meant a cursor-capable ordering
   * silently dropped the offset, so every numbered page re-served page one.
   */
  const cursorApplied = supportsCursor && cursor > 0;
  if (cursorApplied) where.push(`"rowCursor" < ${p(cursor)}`);

  const whereClause = where.length > 0 ? where.join(' AND ') : '1 = 1';
  const offsetClause = !cursorApplied && offset > 0 ? ` OFFSET ${p(offset)}` : '';

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
  // Goes through the same `runQuery` helper as the row fetch. A second inline
  // `await import('@/lib/db/prisma')` here resolved to the real client while
  // the row fetch resolved to the test double, so the suite silently opened a
  // database connection — one import site keeps both on the same module.
  const source = input.countSource ?? ((query: string, values: SqlParam[]) =>
    runQuery<{ count: number }>(query, values));

  const rows = await source(sql, params);
  const raw = Number(rows[0]?.count ?? 0);
  return raw > ceiling ? { count: ceiling, capped: true } : { count: raw, capped: false };
}
