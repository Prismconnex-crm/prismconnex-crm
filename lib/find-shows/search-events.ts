import type { FindShowEvent, FindShowFilters } from '@/types/find-shows';

/**
 * Free-text search over the trade-show catalog, kept pure and dependency-free
 * so it runs in the node test environment (the repo has no jsdom/RTL, so the
 * Find Shows behaviour is tested here rather than through the components).
 *
 * A query token matches an event when:
 *
 *  1. the event title contains it anywhere ("p" in "SHOP EXPO");
 *  2. a word of the organizer, city, country (plus aliases such as
 *     "usa"/"uk"), industry/category or venue starts with it. These fields are
 *     never matched mid-word, so "usa" does not match the city Lausanne;
 *  3. it is a whole word of the editorial description — long prose, where a
 *     prefix or substring would match almost every event;
 *  4. or, as a typo fallback when no catalog word even starts with it, it is
 *     within a small edit distance of a catalog word ("norwy" → "norway").
 *
 * Relevance then follows SEARCH_SCORE: title start, title word start, title
 * substring, organizer, city, country, category, venue, description.
 *
 * Every token must match (AND across fields), so "medical germany" narrows.
 */

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Lowercased, accent-stripped form used for every comparison. */
export function normalizeSearchValue(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** The normalized alphanumeric words of a value ("Cine Gear - ATL" → cine, gear, atl). */
function toWords(value: string): string[] {
  return normalizeSearchValue(value).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Connective words dropped from a multi-word query — they would otherwise have to match too. */
const QUERY_STOPWORDS = new Set(['and', 'the', 'of', 'in', 'for']);

/**
 * Splits a raw query into normalized, de-duplicated word tokens. Leading,
 * trailing and repeated whitespace and punctuation are ignored. Connectives are
 * dropped unless they are the whole query.
 */
export function tokenizeSearchQuery(query: string): string[] {
  const words = Array.from(new Set(toWords(query)));
  const meaningful = words.filter((word) => !QUERY_STOPWORDS.has(word));
  return meaningful.length ? meaningful : words;
}

/**
 * Other names people type for a catalog country. Matched like the country
 * itself, so "usa" finds every event in the United States, not only the ones
 * with USA in their name.
 */
const COUNTRY_ALIASES: Record<string, string[]> = {
  'United States': ['usa', 'us', 'america', 'united states of america'],
  'United Kingdom': ['uk', 'britain', 'great britain', 'england'],
  'United Arab Emirates': ['uae', 'emirates'],
  'South Korea': ['korea'],
  'Czech Republic': ['czechia'],
  Netherlands: ['holland'],
  Myanmar: ['burma'],
  'DR Congo': ['congo'],
  'Ivory Coast': ['cote d ivoire'],
  Turkey: ['turkiye'],
};

/** The raw (un-normalized) values a query is matched against. */
export function getSearchableValues(event: FindShowEvent): string[] {
  return [
    event.name,
    event.city,
    event.country,
    ...(COUNTRY_ALIASES[event.country] ?? []),
    event.venue,
    event.organizer,
    // Industry = the event's individual categories. The seed's legacy combined
    // labels (rawCategories) are left out: "engineering" would otherwise match
    // every show the old "Manufacturing & Engineering" bucket swept up.
    ...event.categories,
    event.description,
  ].filter(Boolean);
}

type SearchIndex = {
  /** Each field as its normalized words joined by single spaces. */
  name: string;
  organizer: string;
  city: string;
  /** The country and each alias, word-joined. */
  countryNames: string[];
  categories: string[];
  venue: string;
  /** Every distinct word of the fields above — what tokens prefix-match. */
  coreWords: string[];
  /** Description words, matched whole-word only. */
  descriptionWords: Set<string>;
};

const joinWords = (value: string) => toWords(value).join(' ');

// Normalizing every field per event on each keystroke is wasteful across ~11k
// events, and the catalog objects are stable module singletons, so the index is
// cached against the event identity.
const searchIndexCache = new WeakMap<FindShowEvent, SearchIndex>();

function getSearchIndex(event: FindShowEvent): SearchIndex {
  const cached = searchIndexCache.get(event);
  if (cached) {
    return cached;
  }

  const countryNames = [event.country, ...(COUNTRY_ALIASES[event.country] ?? [])]
    .map(joinWords)
    .filter(Boolean);
  const categories = event.categories.map(joinWords).filter(Boolean);
  const name = joinWords(event.name);
  const organizer = joinWords(event.organizer);
  const city = joinWords(event.city);
  const venue = joinWords(event.venue);

  const index: SearchIndex = {
    name,
    organizer,
    city,
    countryNames,
    categories,
    venue,
    coreWords: Array.from(
      new Set([name, organizer, city, ...countryNames, ...categories, venue].join(' ').split(' ').filter(Boolean))
    ),
    descriptionWords: new Set(toWords(event.description ?? '')),
  };

  searchIndexCache.set(event, index);
  return index;
}

// --- Typo tolerance ---------------------------------------------------------

/** Edits a token of this length may be away from a catalog word; 0 disables. */
function allowedTypos(token: string) {
  if (token.length >= 8) return 2;
  if (token.length >= 4) return 1;
  return 0;
}

/**
 * Optimal-string-alignment distance (Levenshtein plus adjacent swaps), or
 * `max + 1` as soon as it must exceed `max`.
 */
function editDistance(left: string, right: string, max: number): number {
  if (Math.abs(left.length - right.length) > max) return max + 1;

  let beforePrevious: number[] = [];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        value = Math.min(value, beforePrevious[j - 2] + 1);
      }
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    beforePrevious = previous;
    previous = current;
  }

  return previous[right.length];
}

/**
 * True when `token` is a misspelling of `word`. The first letter must agree:
 * people rarely mistype it, and without that rule "construction" would pass
 * for "reconstruction" and "states" for "estates".
 */
function isTypoOf(token: string, word: string, typos: number) {
  return token[0] === word[0] && editDistance(token, word, typos) <= typos;
}

/** Sorted distinct core words of an event list, cached per list. */
const vocabularyCache = new WeakMap<readonly FindShowEvent[], string[]>();

function getVocabulary(events: readonly FindShowEvent[]): string[] {
  const cached = vocabularyCache.get(events);
  if (cached) return cached;

  const words = new Set<string>();
  for (const event of events) {
    for (const word of getSearchIndex(event).coreWords) words.add(word);
  }
  const vocabulary = Array.from(words).sort();
  vocabularyCache.set(events, vocabulary);
  return vocabulary;
}

/** True when some vocabulary word equals or starts with `token` (binary search). */
function vocabularyHasPrefix(vocabulary: string[], token: string) {
  let low = 0;
  let high = vocabulary.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (vocabulary[mid] < token) low = mid + 1;
    else high = mid;
  }
  return low < vocabulary.length && vocabulary[low].startsWith(token);
}

type CompiledToken = {
  token: string;
  /** Catalog words standing in for a misspelt token; empty when the token matched as typed. */
  corrections: string[];
};

type CompiledQuery = {
  tokens: CompiledToken[];
  /** Whole query as words, for phrase-level relevance ("united states"). */
  phrase: string;
};

function compileQuery(query: string, vocabulary: string[]): CompiledQuery {
  const tokens = tokenizeSearchQuery(query).map((token) => {
    const typos = allowedTypos(token);
    if (!typos || vocabularyHasPrefix(vocabulary, token)) {
      return { token, corrections: [] };
    }
    return {
      token,
      corrections: vocabulary.filter((word) => isTypoOf(token, word, typos)),
    };
  });

  return { tokens, phrase: toWords(query).join(' ') };
}

// --- Matching ---------------------------------------------------------------

function tokenMatches(index: SearchIndex, { token, corrections }: CompiledToken): boolean {
  if (index.name.includes(token)) return true;
  if (index.coreWords.some((word) => word.startsWith(token))) return true;
  if (index.descriptionWords.has(token)) return true;
  return corrections.some((word) => index.coreWords.includes(word));
}

function matchesCompiled(index: SearchIndex, compiled: CompiledQuery): boolean {
  return compiled.tokens.every((token) => tokenMatches(index, token));
}

/**
 * True when every token in the query matches at least one searchable field.
 * An empty (or whitespace-only) query matches everything.
 */
export function matchesSearchQuery(event: FindShowEvent, query: string): boolean {
  const compiled = compileQuery(query, getVocabulary([event]));
  return !compiled.tokens.length || matchesCompiled(getSearchIndex(event), compiled);
}

function filterCompiled(
  events: FindShowEvent[],
  filters: FindShowFilters,
  compiled: CompiledQuery
): FindShowEvent[] {
  return events.filter((event) => {
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

    // Cheapest checks first; the text match runs only on what the filters kept.
    return !compiled.tokens.length || matchesCompiled(getSearchIndex(event), compiled);
  });
}

/**
 * The single filtering pass behind the Find Shows grid: free-text search plus
 * the region/country/category/month filters, so the search box and the filter
 * bar always compose (intersect) instead of overriding one another.
 */
export function filterFindShowEvents(
  events: FindShowEvent[],
  filters: FindShowFilters
): FindShowEvent[] {
  return filterCompiled(events, filters, compileQuery(filters.query, getVocabulary(events)));
}

// --- Relevance --------------------------------------------------------------

/**
 * Relevance tiers, highest first. Within one tier events are ordered by date
 * (soonest first), then by name.
 */
export const SEARCH_SCORE = {
  /** 1. The title starts with the term: "PACKAGING INNOVATIONS" for "p". */
  titleStartsWith: 100,
  /** 2. A later word of the title starts with it: "CINE GEAR EXPO - ATLANTA" for "expo". */
  titleWordStartsWith: 90,
  /** 3. The title contains it anywhere: "SHOP EXPO" for "p". */
  titleContains: 80,
  /** 4. An organizer word starts with it. */
  organizerMatch: 70,
  /** 5. A city word starts with it. */
  cityMatch: 60,
  /** 6. A country word (or alias: "usa") starts with it. */
  countryMatch: 50,
  /** 7. An industry/category word starts with it. */
  categoryMatch: 40,
  /** A venue word starts with it — not in the priority list, so it sits just below categories. */
  venueMatch: 35,
  /** 8. A whole word of the description. */
  descriptionMatch: 30,
  noMatch: 0,
} as const;

/** True when some word of the word-joined `field` starts with `term` (a phrase may span words). */
function hasWordStartingWith(field: string, term: string) {
  return !!field && !!term && ` ${field}`.includes(` ${term}`);
}

/** Best tier a single normalized term reaches against one event. */
function scoreTerm(index: SearchIndex, term: string): number {
  if (!term) return SEARCH_SCORE.noMatch;
  if (index.name.startsWith(term)) return SEARCH_SCORE.titleStartsWith;
  if (hasWordStartingWith(index.name, term)) return SEARCH_SCORE.titleWordStartsWith;
  if (index.name.includes(term)) return SEARCH_SCORE.titleContains;
  if (hasWordStartingWith(index.organizer, term)) return SEARCH_SCORE.organizerMatch;
  if (hasWordStartingWith(index.city, term)) return SEARCH_SCORE.cityMatch;
  if (index.countryNames.some((country) => hasWordStartingWith(country, term))) return SEARCH_SCORE.countryMatch;
  if (index.categories.some((category) => hasWordStartingWith(category, term))) return SEARCH_SCORE.categoryMatch;
  if (hasWordStartingWith(index.venue, term)) return SEARCH_SCORE.venueMatch;
  return SEARCH_SCORE.noMatch;
}

function scoreCompiled(index: SearchIndex, compiled: CompiledQuery): number {
  if (!compiled.tokens.length || !matchesCompiled(index, compiled)) {
    return SEARCH_SCORE.noMatch;
  }

  // The whole query as typed is tried first: "cine gear" is a title start.
  const phrase = scoreTerm(index, compiled.phrase);
  if (compiled.tokens.length === 1) {
    const [{ token, corrections }] = compiled.tokens;
    return Math.max(
      phrase,
      SEARCH_SCORE.descriptionMatch,
      ...[token, ...corrections].map((term) => scoreTerm(index, term))
    );
  }

  // Several words that do not land as one phrase: each word scores its best
  // form (as typed, or a typo correction; a description-only word scores that
  // floor), and the event gets the average, so every word counts.
  const tokenScores = compiled.tokens.map(({ token, corrections }) =>
    Math.max(
      SEARCH_SCORE.descriptionMatch,
      ...[token, ...corrections].map((term) => scoreTerm(index, term))
    )
  );
  const average = tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
  return Math.max(phrase, Math.round(average));
}

/**
 * Relevance of one event to the raw query, 0 when it does not match at all.
 *
 * A multi-word query is scored on its best term as well as on the whole
 * string, so "china food" still recognises "CHINA FOOD EXPO" as a name-start
 * hit.
 */
export function scoreEventForQuery(event: FindShowEvent, query: string): number {
  return scoreCompiled(getSearchIndex(event), compileQuery(query, getVocabulary([event])));
}

function rankCompiled(events: FindShowEvent[], compiled: CompiledQuery): FindShowEvent[] {
  if (!compiled.tokens.length) {
    return events;
  }

  // Decorate-sort-undecorate: the score and the sort key are computed once per
  // event rather than on every comparison.
  const ranked = events.map((event) => {
    const index = getSearchIndex(event);
    return { event, score: scoreCompiled(index, compiled), date: event.startDate, name: index.name };
  });

  // Score first, then soonest date, then name A-Z.
  ranked.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.date !== right.date) {
      return left.date < right.date ? -1 : 1;
    }
    if (left.name === right.name) {
      return 0;
    }
    return left.name < right.name ? -1 : 1;
  });

  return ranked.map((entry) => entry.event);
}

/**
 * Orders events by relevance, highest score first; ties go to the soonest
 * event, then A-Z by name. An empty query is not a ranking at all, so the
 * catalog's default date order is returned untouched.
 */
export function rankFindShowEvents(events: FindShowEvent[], query: string): FindShowEvent[] {
  return rankCompiled(events, compileQuery(query, getVocabulary(events)));
}

/**
 * What the Find Shows grid renders: the filter pass, then the relevance sort.
 * Filtering first means Region/Country/Category never lose to relevance — an
 * event the filters exclude cannot be ranked back in. The query is compiled
 * once against the whole catalog, so typo corrections do not depend on which
 * filters happen to be active.
 */
export function searchFindShowEvents(
  events: FindShowEvent[],
  filters: FindShowFilters
): FindShowEvent[] {
  const compiled = compileQuery(filters.query, getVocabulary(events));
  return rankCompiled(filterCompiled(events, filters, compiled), compiled);
}

// --- Highlighting -----------------------------------------------------------

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

const isWordChar = (char: string | undefined) => !!char && /[a-z0-9]/.test(char);

/**
 * Splits `text` into alternating plain and matching segments so the UI can wrap
 * the matches in <mark>. Mirrors the matcher: a token is highlighted where a
 * word starts with it — or anywhere, with `anywhere`, which is how titles
 * match — and a misspelt token highlights the words of `text` it is a typo
 * of. Overlapping hits are merged; original casing/accents are kept.
 */
export function highlightSegments(
  text: string,
  query: string,
  { anywhere = false }: { anywhere?: boolean } = {}
): HighlightSegment[] {
  const tokens = tokenizeSearchQuery(query);
  if (!text || !tokens.length) {
    return text ? [{ text, match: false }] : [];
  }

  const { normalized, indexMap } = normalizeWithIndexMap(text);
  const ranges: Array<[number, number]> = [];
  const addRange = (from: number, length: number) =>
    ranges.push([indexMap[from], indexMap[from + length - 1] + 1]);

  for (const token of tokens) {
    let found = false;
    let from = normalized.indexOf(token);
    while (from !== -1) {
      if (anywhere || !isWordChar(normalized[from - 1])) {
        addRange(from, token.length);
        found = true;
      }
      from = normalized.indexOf(token, from + 1);
    }

    const typos = allowedTypos(token);
    if (!found && typos) {
      const wordPattern = /[a-z0-9]+/g;
      let word: RegExpExecArray | null;
      while ((word = wordPattern.exec(normalized))) {
        if (isTypoOf(token, word[0], typos)) addRange(word.index, word[0].length);
      }
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
