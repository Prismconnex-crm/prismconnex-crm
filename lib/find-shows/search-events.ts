import type { FindShowEvent, FindShowFilters } from '@/types/find-shows';

/**
 * Free-text search over the trade-show catalog, kept pure and dependency-free
 * so it runs in the node test environment (the repo has no jsdom/RTL, so the
 * Find Shows behaviour is tested here rather than through the components).
 *
 * The searchable surface is deliberately the five fields the search box
 * advertises — name, industry, city, country and category — plus venue and
 * organizer, which the previous `event.searchText` match already covered. The
 * editorial `description` is left out on purpose: it is long prose, so short
 * tokens matched almost every event through it.
 */

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Lowercased, accent-stripped form used for every comparison. */
export function normalizeSearchValue(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/**
 * Splits a raw query into normalized tokens. Whitespace-separated so
 * "medical germany" narrows across two different fields instead of looking for
 * one literal phrase that no single field contains.
 */
export function tokenizeSearchQuery(query: string): string[] {
  const tokens = normalizeSearchValue(query).split(/\s+/).filter(Boolean);
  return tokens.filter((token, index) => tokens.indexOf(token) === index);
}

/** The raw (un-normalized) values a query is matched against. */
export function getSearchableValues(event: FindShowEvent): string[] {
  return [
    event.name,
    event.city,
    event.country,
    event.venue,
    event.organizer,
    ...event.rawCategories, // industry labels straight from the seed
    ...event.categories, // the catalog's mapped category buckets
  ].filter(Boolean);
}

type SearchIndex = {
  /** Normalized name/country/city, the three fields relevance scores. */
  name: string;
  country: string;
  city: string;
  /** Every normalized searchable value, including the three above. */
  haystack: string[];
};

// Normalizing seven fields per event on every keystroke is wasteful across
// ~11k events, and the catalog objects are stable module singletons, so the
// normalized form is cached against the event identity.
const searchIndexCache = new WeakMap<FindShowEvent, SearchIndex>();

function getSearchIndex(event: FindShowEvent): SearchIndex {
  const cached = searchIndexCache.get(event);
  if (cached) {
    return cached;
  }

  const index: SearchIndex = {
    name: normalizeSearchValue(event.name),
    country: normalizeSearchValue(event.country),
    city: normalizeSearchValue(event.city),
    haystack: getSearchableValues(event).map(normalizeSearchValue),
  };

  searchIndexCache.set(event, index);
  return index;
}

/**
 * True when every token in the query matches at least one searchable field.
 * An empty (or whitespace-only) query matches everything.
 */
export function matchesSearchQuery(event: FindShowEvent, query: string): boolean {
  const tokens = tokenizeSearchQuery(query);
  if (!tokens.length) {
    return true;
  }

  const { haystack } = getSearchIndex(event);
  return tokens.every((token) => haystack.some((value) => value.includes(token)));
}

/**
 * The single filtering pass behind the Find Shows grid: free-text search plus
 * the region/country/category/month filters, so the search box and the filter
 * bar always compose instead of overriding one another.
 */
export function filterFindShowEvents(
  events: FindShowEvent[],
  filters: FindShowFilters
): FindShowEvent[] {
  return events.filter((event) => {
    if (!matchesSearchQuery(event, filters.query)) {
      return false;
    }

    if (filters.region !== 'All Regions' && event.region !== filters.region) {
      return false;
    }

    if (filters.country && event.country !== filters.country) {
      return false;
    }

    if (filters.category !== 'All Categories' && !event.categories.includes(filters.category)) {
      return false;
    }

    if (filters.startMonth && event.startMonth < filters.startMonth) {
      return false;
    }

    if (filters.endMonth && event.startMonth > filters.endMonth) {
      return false;
    }

    return true;
  });
}

/**
 * Relevance tiers. A prefix hit outranks a substring hit, and within each kind
 * the event's own name outranks where it takes place — so typing "c" lists the
 * shows *called* C-something before every show in Canada or Chicago.
 */
export const SEARCH_SCORE = {
  nameStartsWith: 100,
  countryStartsWith: 90,
  cityStartsWith: 80,
  nameIncludes: 50,
  countryIncludes: 40,
  cityIncludes: 30,
  /**
   * The event matched the query only through a field that has no tier of its
   * own — industry, category, venue or organizer. It still belongs in the
   * results, but below every name/country/city match.
   */
  otherFieldMatch: 10,
  noMatch: 0,
} as const;

/** Best tier a single normalized term reaches against one event. */
function scoreSearchTerm(index: SearchIndex, term: string): number {
  if (index.name.startsWith(term)) return SEARCH_SCORE.nameStartsWith;
  if (index.country.startsWith(term)) return SEARCH_SCORE.countryStartsWith;
  if (index.city.startsWith(term)) return SEARCH_SCORE.cityStartsWith;
  if (index.name.includes(term)) return SEARCH_SCORE.nameIncludes;
  if (index.country.includes(term)) return SEARCH_SCORE.countryIncludes;
  if (index.city.includes(term)) return SEARCH_SCORE.cityIncludes;
  return SEARCH_SCORE.noMatch;
}

/**
 * Relevance of one event to the raw query, 0 when it does not match at all.
 *
 * A multi-word query is scored on its best term as well as on the whole
 * string, so "china food" still recognises "CHINA FOOD EXPO" as a name-prefix
 * hit rather than dropping to the substring tier.
 */
export function scoreEventForQuery(event: FindShowEvent, query: string): number {
  const tokens = tokenizeSearchQuery(query);
  if (!tokens.length) {
    return SEARCH_SCORE.noMatch;
  }

  const index = getSearchIndex(event);
  const wholeQuery = normalizeSearchValue(query).trim();
  const terms = tokens.length > 1 ? [wholeQuery, ...tokens] : [wholeQuery];

  const best = terms.reduce((highest, term) => Math.max(highest, scoreSearchTerm(index, term)), 0);
  if (best > SEARCH_SCORE.noMatch) {
    return best;
  }

  // Matched on industry/category/venue/organizer only — keep it, ranked last.
  return matchesSearchQuery(event, query)
    ? SEARCH_SCORE.otherFieldMatch
    : SEARCH_SCORE.noMatch;
}

/**
 * Orders events by relevance, highest score first. Ties keep a deterministic
 * A-Z name order rather than the catalog's chronological order, so the shows
 * inside one tier do not reshuffle as the query grows. An empty query is not a
 * ranking at all, so the catalog's default date order is returned untouched.
 */
export function rankFindShowEvents(events: FindShowEvent[], query: string): FindShowEvent[] {
  if (!tokenizeSearchQuery(query).length) {
    return events;
  }

  // Decorate-sort-undecorate: the score and the sort key are computed once per
  // event rather than on every comparison, which for the ~11k-event catalog is
  // the difference between ~11k and ~150k scoring passes.
  const ranked = events.map((event) => ({
    event,
    score: scoreEventForQuery(event, query),
    name: getSearchIndex(event).name,
  }));

  ranked.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.name === right.name) {
      return 0;
    }
    return left.name < right.name ? -1 : 1;
  });

  return ranked.map((entry) => entry.event);
}

/**
 * What the Find Shows grid renders: the filter pass, then the relevance sort.
 * Filtering first means Region/Category never lose to relevance — an event the
 * filters exclude cannot be ranked back in.
 */
export function searchFindShowEvents(
  events: FindShowEvent[],
  filters: FindShowFilters
): FindShowEvent[] {
  return rankFindShowEvents(filterFindShowEvents(events, filters), filters.query);
}

export type HighlightSegment = {
  text: string;
  match: boolean;
};

/**
 * Normalizes `text` while recording, for each normalized character, the index
 * of the original character it came from. Accent stripping and lowercasing can
 * both change length, so a match found in the normalized string is mapped back
 * through this table to slice the *original* text for display.
 */
function normalizeWithIndexMap(text: string): { normalized: string; indexMap: number[] } {
  let normalized = '';
  const indexMap: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const normalizedChar = normalizeSearchValue(text[index]);
    normalized += normalizedChar;
    for (let offset = 0; offset < normalizedChar.length; offset += 1) {
      indexMap.push(index);
    }
  }

  return { normalized, indexMap };
}

/**
 * Splits `text` into alternating plain and matching segments so the UI can wrap
 * the matches in <mark>. Overlapping token hits are merged, and the original
 * casing/accents of the text are preserved.
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const tokens = tokenizeSearchQuery(query);
  if (!text || !tokens.length) {
    return text ? [{ text, match: false }] : [];
  }

  const { normalized, indexMap } = normalizeWithIndexMap(text);
  const ranges: Array<[number, number]> = [];

  for (const token of tokens) {
    let from = normalized.indexOf(token);
    while (from !== -1) {
      const start = indexMap[from];
      const end = indexMap[from + token.length - 1] + 1;
      ranges.push([start, end]);
      from = normalized.indexOf(token, from + token.length);
    }
  }

  if (!ranges.length) {
    return [{ text, match: false }];
  }

  ranges.sort((left, right) => left[0] - right[0] || left[1] - right[1]);

  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range[0] <= previous[1]) {
      previous[1] = Math.max(previous[1], range[1]);
    } else {
      merged.push([...range] as [number, number]);
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), match: false });
    }
    segments.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments;
}
