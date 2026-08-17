import { describeResults, filterEvents } from '@/lib/find-shows/filter-events';
import { eventFiltersSchema, type EventFilters as AskEventFilters } from '@/models/event-query';
import { ENTITY_SIGNALS } from '../signals';
import type { EntityAdapter, FilterChip } from '../types';

export type { AskEventFilters };

const PAGE_SIZE = 10;

/**
 * Keys this entity accepts from another page's filters.
 *
 * Note this is the SINGLE-VALUED EventFilters from models/event-query.ts (the
 * one filterEvents consumes), not the array-valued type of the same name in
 * types/events.ts that drives the Explorer sidebar.
 */
/** Only the string-valued keys are carry-over targets; months and year are not. */
type EventStringKey = 'city' | 'country' | 'region' | 'category' | 'keyword';

const CARRY_OVER_KEYS: Record<string, EventStringKey> = {
  country: 'country',
  countries: 'country',
  location: 'city',
  locations: 'city',
  city: 'city',
  region: 'region',
  industry: 'category',
  industries: 'category',
  category: 'category',
  keyword: 'keyword',
  keywords: 'keyword',
};

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const found = value.find((v) => typeof v === 'string' && v.trim());
    return typeof found === 'string' ? found.trim() : null;
  }
  return null;
}

export const eventsAdapter: EntityAdapter<AskEventFilters> = {
  entity: 'events',
  signals: ENTITY_SIGNALS.events,

  filterSchema: {
    type: 'object',
    properties: {
      city: { type: ['string', 'null'], description: 'City the show runs in.' },
      country: { type: ['string', 'null'] },
      region: { type: ['string', 'null'] },
      category: { type: ['string', 'null'], description: 'Industry category of the show.' },
      keyword: {
        type: ['string', 'null'],
        description: 'Free text matched against the show name.',
      },
      monthFrom: { type: ['integer', 'null'], minimum: 1, maximum: 12 },
      monthTo: { type: ['integer', 'null'], minimum: 1, maximum: 12 },
      year: { type: ['integer', 'null'], minimum: 2020, maximum: 2100 },
    },
    required: [],
  },

  emptyFilters() {
    return {
      city: null,
      country: null,
      region: null,
      category: null,
      keyword: null,
      monthFrom: null,
      monthTo: null,
      year: null,
      limit: null,
      offset: null,
    };
  },

  /**
   * No natural-language event parser exists outside the model path, so the
   * local fallback puts the whole message in `keyword`. filterEvents matches
   * that against the catalog's searchText, which is a weak but honest read —
   * and it never invents a filter the user did not ask for.
   */
  parseLocally(message, base) {
    const keyword = message.trim();
    return { ...base, keyword: keyword || base.keyword };
  },

  carryOver(foreign) {
    const filters: Partial<AskEventFilters> = {};
    const dropped: string[] = [];

    for (const [key, value] of Object.entries(foreign)) {
      const single = firstString(value);
      if (!single) continue;
      const target = CARRY_OVER_KEYS[key];
      if (!target) {
        dropped.push(key);
        continue;
      }
      if (filters[target] == null) {
        filters[target] = single;
      }
    }

    return { filters, dropped };
  },

  async search(filters, page) {
    const parsed = eventFiltersSchema.parse({
      ...filters,
      limit: PAGE_SIZE,
      offset: Math.max(0, (page - 1) * PAGE_SIZE),
    });
    const { events, totalMatched } = filterEvents(parsed);
    return { rows: events, total: totalMatched };
  },

  chips(filters): FilterChip[] {
    const labels: Array<[keyof AskEventFilters, string]> = [
      ['city', 'City'],
      ['country', 'Country'],
      ['region', 'Region'],
      ['category', 'Category'],
      ['keyword', 'Keyword'],
    ];
    return labels
      .filter(([key]) => Boolean(filters[key]))
      .map(([key, label]) => ({ key: String(key), label, value: String(filters[key]) }));
  },

  /**
   * Events can be counted cheaply, so a null total is recomputed rather than
   * reported as zero — "No trade shows found" for an uncounted filter set
   * would be a confident falsehood.
   */
  describe(filters, total) {
    const count = total ?? filterEvents(eventFiltersSchema.parse({ ...filters })).totalMatched;
    return describeResults(filters, count, Math.min(count, PAGE_SIZE));
  },

  suggest(filters, total) {
    const items: string[] = [];
    if (total === null || total > PAGE_SIZE) items.push('Show me more');
    if (!filters.category) items.push('Filter by industry category');
    if (!filters.country && !filters.city) items.push('Narrow to one country');
    items.push('Companies exhibiting at these events');
    return items.slice(0, 3);
  },
};
