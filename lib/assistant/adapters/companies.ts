import {
  searchCompanies,
  type CompanyRowSource,
  type CompanySearchFilters,
} from '@/lib/companies/search';
import { ENTITY_SIGNALS } from '../signals';
import type { EntityAdapter, FilterChip } from '../types';

const PAGE_SIZE = 10;

const CARRY_OVER_KEYS: Record<string, keyof CompanySearchFilters> = {
  country: 'country',
  countries: 'country',
  location: 'region',
  locations: 'region',
  region: 'region',
  industry: 'category',
  industries: 'category',
  category: 'category',
  keyword: 'search',
  keywords: 'search',
};

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const found = value.find((v) => typeof v === 'string' && v.trim());
    return typeof found === 'string' ? found.trim() : null;
  }
  return null;
}

export function createCompaniesAdapter(
  rowSource?: CompanyRowSource
): EntityAdapter<CompanySearchFilters> {
  return {
    entity: 'companies',
    signals: ENTITY_SIGNALS.companies,

    filterSchema: {
      type: 'object',
      properties: {
        search: {
          type: ['string', 'null'],
          description:
            'Company name PREFIX. Matching is prefix-only, so send a leading fragment, never a substring.',
        },
        category: { type: ['string', 'null'], description: 'Industry category.' },
        employeeRange: {
          type: ['string', 'null'],
          description: 'Headcount band, e.g. "51-200", "1001-5000", "1001+".',
        },
        region: {
          type: ['string', 'null'],
          description: 'e.g. "Europe", "Americas", "Asia-Pacific".',
        },
        country: { type: ['string', 'null'] },
      },
      required: [],
    },

    emptyFilters() {
      return { search: null, category: null, employeeRange: null, region: null, country: null };
    },

    parseLocally(message, base) {
      const trimmed = message.trim();
      return { ...base, search: trimmed || base.search };
    },

    carryOver(foreign) {
      const filters: Partial<CompanySearchFilters> = {};
      const dropped: string[] = [];

      for (const [key, value] of Object.entries(foreign)) {
        const single = firstString(value);
        if (!single) continue;
        const target = CARRY_OVER_KEYS[key];
        if (!target) {
          dropped.push(key);
          continue;
        }
        if (filters[target] == null) filters[target] = single;
      }

      return { filters, dropped };
    },

    async search(filters, page) {
      const result = await searchCompanies({
        filters,
        limit: PAGE_SIZE * page,
        // The route pages by rowCursor, but the assistant has no cursor to
        // replay on page 1, so later pages are served by over-fetching. Cursor
        // continuation belongs with the UI work in Spec 2.
        cursor: 0,
        rowSource,
      });
      const start = Math.max(0, (page - 1) * PAGE_SIZE);
      return { rows: result.companies.slice(start, start + PAGE_SIZE), total: null };
    },

    chips(filters): FilterChip[] {
      const labels: Array<[keyof CompanySearchFilters, string]> = [
        ['search', 'Name'],
        ['category', 'Industry'],
        ['employeeRange', 'Headcount'],
        ['region', 'Region'],
        ['country', 'Country'],
      ];
      return labels
        .filter(([key]) => Boolean(filters[key]))
        .map(([key, label]) => ({ key: String(key), label, value: String(filters[key]) }));
    },

    /**
     * `total` is ALWAYS null for companies. Prose must describe the filters
     * rather than report a count — saying "0 companies" when the count is
     * simply unavailable is worse than saying nothing about the number.
     */
    describe(filters) {
      const parts: string[] = [];
      if (filters.search) parts.push(`names starting with "${filters.search}"`);
      if (filters.category) parts.push(`in ${filters.category}`);
      if (filters.employeeRange) parts.push(`with ${filters.employeeRange} employees`);
      if (filters.country) parts.push(`based in ${filters.country}`);
      else if (filters.region) parts.push(`in ${filters.region}`);

      if (parts.length === 0) {
        return 'Showing companies from the discovery dataset. Add a filter to narrow the list.';
      }
      return `Showing companies ${parts.join(', ')}. The dataset is too large to count per query, so page through the results rather than reading a total.`;
    },

    suggest(filters) {
      const items = ['Show me more'];
      if (!filters.employeeRange) items.push('Filter by headcount');
      if (!filters.country) items.push('Narrow to one country');
      return items.slice(0, 3);
    },
  };
}

export const companiesAdapter = createCompaniesAdapter();
