import { describe, expect, it } from 'vitest';
import { buildCompanyRow, companyCountry, domainFromWebsite, TRADE_SHOW_CATEGORY } from '@/lib/exhibitors/company-import';
import { exhibitorIdFromTags } from '@/lib/exhibitors/bett';
import { formatCompany, type CompanyRow } from '@/lib/companies/search';

const exhibitor = {
  id: 'cmexh123',
  eventSlug: '100-technobuild-yekaterinburg-2026-09-29',
  companyName: '23 PROJECTS',
  websiteUrl: 'http://www.23projects.net/ru',
  country: 'Russia',
  standNumber: 'B12',
  email: null,
  phone: null,
  description: null,
};
const show = { label: '100+ TECHNOBUILD 2026', city: 'Yekaterinburg', monthYear: 'September 2026' };

describe('buildCompanyRow', () => {
  it('makes a Trade Show Events company that names its exhibitor record', () => {
    const row = buildCompanyRow(exhibitor, show, 'cnew1');
    expect(row.category).toBe(TRADE_SHOW_CATEGORY);
    expect(row.name).toBe('23 PROJECTS');
    expect(row.domain).toBe('23projects.net/ru');
    expect(row.headquarters).toBe('Russia');
    expect(row.region).toBe('Europe');
    expect(row.highlights).toBe('100+ TECHNOBUILD 2026 stand B12');
    expect(row.insights).toBe('Exhibiting at 100+ TECHNOBUILD 2026, Yekaterinburg, September 2026');
    expect(exhibitorIdFromTags(row.tags)).toBe('cmexh123');
  });

  it('leaves country and region empty when the directory published none', () => {
    const row = buildCompanyRow({ ...exhibitor, country: null }, show, 'cnew2');
    expect(row.headquarters).toBeNull();
    expect(row.region).toBeNull();
  });

  it('keeps commas out of tags, which are a comma-separated list', () => {
    const row = buildCompanyRow({ ...exhibitor, standNumber: 'NE12, NK14' }, { ...show, label: 'SHOW, LIVE 2027' }, 'c3');
    expect(row.tags.split(',').map((t) => t.trim())).toEqual(['Trade Show Exhibitor', 'SHOW LIVE 2027 Exhibitor', 'Stand NE12 NK14', 'exhibitor:cmexh123']);
  });
});

describe('companyCountry', () => {
  it("uses the Country picker's spelling", () => {
    expect(companyCountry('Türkiye').headquarters).toBe('Turkey');
    expect(companyCountry('Czechia').headquarters).toBe('Czechia (Czech Republic)');
    expect(companyCountry('United States').region).toBe('Americas');
  });
});

describe('domainFromWebsite', () => {
  it('strips scheme, www and trailing slash', () => {
    expect(domainFromWebsite('https://www.acme.com/')).toBe('acme.com');
    expect(domainFromWebsite(null)).toBeNull();
  });
});

describe('formatCompany with an imported exhibitor row', () => {
  const base: CompanyRow = {
    rowCursor: 1, id: 'c1', name: 'Studio 54', category: 'trade show events', description: null, domain: null,
    website: null, founded: null, employeeRange: null, headquarters: null, region: null, revenueRange: null,
    engagementScore: 0, trustSignals: null, tags: 'Trade Show Exhibitor, SHOW 2026 Exhibitor, exhibitor:cmexh9',
    email: null, phone: null, highlights: null, insights: null,
  } as CompanyRow;

  it('returns the exhibitor id as a field and hides the id tag from the chips', () => {
    const c = formatCompany(base);
    expect(c.exhibitorId).toBe('cmexh9');
    expect(c.tags).toEqual(['Trade Show Exhibitor', 'SHOW 2026 Exhibitor']);
  });

  it('keeps a real trailing number in an exhibitor name', () => {
    expect(formatCompany(base).name).toBe('Studio 54');
  });

  it('still strips the seeded numeric suffix from ordinary rows', () => {
    const c = formatCompany({ ...base, name: 'Acme Corp 1234', tags: 'b2b' });
    expect(c.name).toBe('Acme Corp');
    expect(c.exhibitorId).toBeNull();
  });
});
