import { describe, expect, it } from 'vitest';
import { buildCompanyQuery, formatCompany, searchCompanies } from '@/lib/companies/search';

const EMPTY = {
  search: null,
  category: null,
  employeeRange: null,
  region: null,
  country: null,
};

describe('buildCompanyQuery', () => {
  it('uses the pattern operators for prefix search so the index is usable', () => {
    const { sql, params } = buildCompanyQuery({ ...EMPTY, search: 'acme' }, 30, 0);
    expect(sql).toContain('lower(name) ~>=~');
    expect(sql).toContain('lower(name) ~<~');
    expect(sql).toContain('ORDER BY lower(name) USING ~<~');
    expect(params).toContain('acme');
    expect(params).toContain('acmf'); // upper bound: last char incremented
  });

  it('orders by rowCursor when browsing', () => {
    const { sql } = buildCompanyQuery(EMPTY, 30, 0);
    expect(sql).toContain('ORDER BY "DiscoveryCompany"."rowCursor" DESC');
  });

  it('applies the cursor as a rowCursor bound', () => {
    const { sql, params } = buildCompanyQuery(EMPTY, 30, 500);
    expect(sql).toContain('"rowCursor" <');
    expect(params).toContain(500);
  });

  it('expands coarse employee bands', () => {
    const { params } = buildCompanyQuery({ ...EMPTY, employeeRange: '51-200' }, 30, 0);
    expect(params).toEqual(expect.arrayContaining(['51-200', '51-100', '101-200']));
  });

  it('expands country aliases and infers the region', () => {
    const { params } = buildCompanyQuery({ ...EMPTY, country: 'USA' }, 30, 0);
    expect(params).toEqual(expect.arrayContaining(['USA', 'United States', 'Americas']));
  });

  it('does not infer a region when one was given explicitly', () => {
    const { params } = buildCompanyQuery({ ...EMPTY, country: 'USA', region: 'Europe' }, 30, 0);
    expect(params).toContain('Europe');
    expect(params).not.toContain('Americas');
  });
});

describe('formatCompany', () => {
  it('strips the trailing numeric suffix from seeded names', () => {
    expect(formatCompany({ rowCursor: 1, id: 'a', name: 'Acme 42' } as never).name).toBe('Acme');
  });

  it('splits comma lists and defaults nulls', () => {
    const out = formatCompany({
      rowCursor: 1,
      id: 'a',
      name: 'Acme',
      tags: 'saas,b2b',
      category: null,
    } as never);
    expect(out.tags).toEqual(['saas', 'b2b']);
    expect(out.category).toBe('');
    expect(out.highlights).toEqual([]);
  });
});

describe('searchCompanies', () => {
  const rows = Array.from({ length: 31 }, (_, i) => ({
    rowCursor: 100 - i,
    id: `c${i}`,
    name: `Company ${i}`,
  })) as never[];

  it('returns total and totalPages as null — counting is too slow to do per request', async () => {
    const out = await searchCompanies({
      filters: EMPTY,
      limit: 30,
      cursor: 0,
      rowSource: async () => rows,
    });
    expect(out.total).toBeNull();
    expect(out.totalPages).toBeNull();
  });

  it('trims the over-fetched row and reports the next cursor', async () => {
    const out = await searchCompanies({
      filters: EMPTY,
      limit: 30,
      cursor: 0,
      rowSource: async () => rows,
    });
    expect(out.companies).toHaveLength(30);
    expect(out.hasNextPage).toBe(true);
    expect(out.nextCursor).toBe('71');
  });

  it('reports no next page when the source returns a short page', async () => {
    const out = await searchCompanies({
      filters: EMPTY,
      limit: 30,
      cursor: 0,
      rowSource: async () => rows.slice(0, 5),
    });
    expect(out.hasNextPage).toBe(false);
    expect(out.nextCursor).toBeNull();
  });
});
