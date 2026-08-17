import { buildPeopleAnswer } from '@/lib/people/answer';
import { buildPeopleFilterChips } from '@/lib/people/chips';
import { loadPeople } from '@/lib/people/data';
import { applyPeopleFilters } from '@/lib/people/filters';
import { parsePeopleQuery } from '@/lib/people/parse-query';
import { emptyPeopleFilters, type PeopleFilters } from '@/types/people';
import { ENTITY_SIGNALS } from '../signals';
import type { EntityAdapter, FilterChip } from '../types';

const PAGE_SIZE = 10;

/** Keys this entity accepts from another page's filters. Everything else is dropped. */
const CARRY_OVER_KEYS: Record<string, keyof PeopleFilters> = {
  country: 'countries',
  countries: 'countries',
  location: 'locations',
  locations: 'locations',
  city: 'locations',
  industry: 'industries',
  industries: 'industries',
  category: 'industries',
  company: 'companies',
  companies: 'companies',
  keyword: 'keywords',
  keywords: 'keywords',
};

function asList(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v);
  return [];
}

export const peopleAdapter: EntityAdapter<PeopleFilters> = {
  entity: 'people',
  signals: ENTITY_SIGNALS.people,

  filterSchema: {
    type: 'object',
    properties: {
      titles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Job titles, e.g. "Marketing Manager".',
      },
      seniorities: {
        type: 'array',
        items: { type: 'string' },
        description: 'e.g. "C-Level", "VP", "Director".',
      },
      departments: { type: 'array', items: { type: 'string' } },
      companies: { type: 'array', items: { type: 'string' } },
      locations: { type: 'array', items: { type: 'string' }, description: 'Cities or regions.' },
      countries: { type: 'array', items: { type: 'string' } },
      industries: { type: 'array', items: { type: 'string' } },
      keywords: { type: 'array', items: { type: 'string' } },
      verification: {
        type: ['string', 'null'],
        description: 'Only when the user asked for a verification state; otherwise null.',
      },
      search: { type: 'string', description: 'Free text that fits no other field.' },
    },
    required: [],
  },

  emptyFilters: emptyPeopleFilters,

  parseLocally(message, base) {
    return parsePeopleQuery(message, { base });
  },

  carryOver(foreign) {
    const filters: Partial<PeopleFilters> = {};
    const dropped: string[] = [];

    for (const [key, value] of Object.entries(foreign)) {
      const target = CARRY_OVER_KEYS[key];
      const values = asList(value);
      if (values.length === 0) continue;
      if (!target) {
        // Dropped, never guessed — a filter with no counterpart here would be
        // an invention, and the caller is told so it can say what it lost.
        dropped.push(key);
        continue;
      }
      const existing = (filters[target] as string[] | undefined) ?? [];
      (filters[target] as string[]) = Array.from(new Set(existing.concat(values)));
    }

    return { filters, dropped };
  },

  async search(filters, page) {
    const matches = applyPeopleFilters(loadPeople(), filters);
    const start = Math.max(0, (page - 1) * PAGE_SIZE);
    return { rows: matches.slice(start, start + PAGE_SIZE), total: matches.length };
  },

  chips(filters): FilterChip[] {
    return buildPeopleFilterChips(filters).map((chip) => ({
      key: chip.id,
      label: chip.label,
      value: chip.value,
    }));
  },

  /**
   * People can be counted cheaply, so a null total is recomputed rather than
   * treated as zero — passing 0 through would produce "No contacts match" for
   * a filter set that actually matches the whole dataset.
   */
  describe(filters, total) {
    const matches = applyPeopleFilters(loadPeople(), filters);
    return buildPeopleAnswer({
      question: '',
      filters,
      matches: matches.slice(0, PAGE_SIZE),
      total: total ?? matches.length,
    });
  },

  suggest(filters, total) {
    const items = ['Show me more'];
    if (total === null || total > PAGE_SIZE) items.push('Narrow to verified emails only');
    if (filters.countries.length === 0) items.push('Filter by country');
    if (filters.seniorities.length === 0) items.push('Only decision makers');
    return items.slice(0, 3);
  },
};
