import { findShowEvents } from '@/lib/find-shows/catalog';
import { buildEventFilterChips } from '@/lib/events/chips';
import { filterEventList, type EventQueryState } from '@/lib/events/filters';
import { buildEventAnswer } from '@/lib/events/answer';
import { emptyEventFilters, type EventFilterListKey } from '@/types/events';
import { ENTITY_SIGNALS } from '../signals';
import type { EntityAdapter, FilterChip } from '../types';

const PAGE_SIZE = 10;

/**
 * The server has no access to the browser's liked-events list, which is where
 * favourites live (localStorage `pc_liked_events`). So `favouritesOnly` can
 * never match here — which is exactly why it is absent from `filterSchema`
 * below rather than offered to the model as a filter that does nothing.
 */
const EMPTY_FAVOURITES: ReadonlySet<string> = new Set<string>();

/** Keys this entity accepts from another page's filters, mapped to list keys. */
const CARRY_OVER_KEYS: Record<string, EventFilterListKey> = {
  country: 'countries',
  countries: 'countries',
  location: 'cities',
  locations: 'cities',
  city: 'cities',
  cities: 'cities',
  region: 'regions',
  regions: 'regions',
  industry: 'categories',
  industries: 'categories',
  category: 'categories',
  categories: 'categories',
  keyword: 'keywords',
  keywords: 'keywords',
};

function asList(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v);
  return [];
}

export const eventsAdapter: EntityAdapter<EventQueryState> = {
  entity: 'events',
  signals: ENTITY_SIGNALS.events,

  filterSchema: {
    type: 'object',
    properties: {
      cities: { type: 'array', items: { type: 'string' }, description: 'Cities the show runs in.' },
      countries: { type: 'array', items: { type: 'string' } },
      regions: {
        type: 'array',
        items: { type: 'string' },
        description: 'e.g. "Europe", "Americas", "Asia-Pacific".',
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Industry categories of the show.',
      },
      organizers: { type: 'array', items: { type: 'string' } },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Free text matched against the show name and description.',
      },
      dateFrom: {
        type: ['string', 'null'],
        description: 'Inclusive ISO YYYY-MM-DD lower bound on the run dates.',
      },
      dateTo: {
        type: ['string', 'null'],
        description: 'Inclusive ISO YYYY-MM-DD upper bound on the run dates.',
      },
      search: { type: 'string', description: 'Free text that fits no other field.' },
    },
    required: [],
  },

  emptyFilters() {
    return { filters: emptyEventFilters(), search: '' };
  },

  /**
   * No natural-language event parser exists outside the model path, so the
   * local fallback puts the whole message in `search` — which filterEventList
   * matches against the catalog's searchText. Weak but honest: it never invents
   * a filter the user did not ask for.
   */
  parseLocally(message, base) {
    const search = message.trim();
    return { ...base, search: search || base.search };
  },

  carryOver(foreign) {
    const filters = emptyEventFilters();
    const dropped: string[] = [];
    let touched = false;

    for (const [key, value] of Object.entries(foreign)) {
      const values = asList(value);
      if (values.length === 0) continue;
      const target = CARRY_OVER_KEYS[key];
      if (!target) {
        // Dropped, never guessed — the caller is told so it can say what it lost.
        dropped.push(key);
        continue;
      }
      filters[target] = Array.from(new Set(filters[target].concat(values)));
      touched = true;
    }

    return { filters: touched ? { filters } : {}, dropped };
  },

  async search(state, page) {
    const matches = filterEventList(findShowEvents, state.filters, state.search, EMPTY_FAVOURITES);
    const start = Math.max(0, (page - 1) * PAGE_SIZE);
    return { rows: matches.slice(start, start + PAGE_SIZE), total: matches.length };
  },

  chips(state): FilterChip[] {
    return buildEventFilterChips(state.filters, state.search).map((chip) => ({
      key: chip.id,
      label: chip.label,
      value: chip.value,
    }));
  },

  /**
   * Events can be counted cheaply, so a null total is recomputed rather than
   * reported as zero — "No trade shows found" for an uncounted filter set
   * would be a confident falsehood.
   */
  describe(state, total) {
    const matches = filterEventList(findShowEvents, state.filters, state.search, EMPTY_FAVOURITES);
    return buildEventAnswer({
      question: '',
      state,
      matches: matches.slice(0, PAGE_SIZE),
      total: total ?? matches.length,
    });
  },

  suggest(state, total) {
    const items: string[] = [];
    if (total === null || total > PAGE_SIZE) items.push('Show me more');
    if (state.filters.categories.length === 0) items.push('Filter by industry category');
    if (state.filters.countries.length === 0 && state.filters.cities.length === 0) {
      items.push('Narrow to one country');
    }
    if (items.length < 3) items.push('Companies exhibiting at these events');
    return items.slice(0, 3);
  },
};
