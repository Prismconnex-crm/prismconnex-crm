import { emptyEventFilters, type EventFilters } from '@/types/events';
import { isValidIsoDate, type EventQueryState } from '@/lib/events/filters';

/**
 * Deterministic natural-language parsing for the Events Explorer's
 * "Find anything" box.
 *
 * No model call: a question becomes filters by dictionary and regex alone, so
 * the panel answers at in-memory speed, works offline, and needs no
 * ANTHROPIC_API_KEY. Everything here is pure and takes its vocabularies as
 * arguments — the module must not import lib/find-shows/catalog, which pulls
 * the 10 MB seed JSON into every import graph that touches it.
 *
 * Produces the same `EventQueryState` the left rail already renders from, so a
 * parsed question and a rail click are the same state by construction.
 */

export type EventSort = 'date' | 'relevance' | 'name';

/** Everything the panel needs to run one search. */
export type EventAskQuery = EventQueryState & {
  /** Page size. Rows are paged, never loaded whole. */
  limit: number;
  sort: EventSort;
};

/**
 * The closed and open vocabularies the parser matches against. Regions and
 * categories are closed sets; countries, cities and organizers are derived
 * from the catalog by the caller.
 */
export type EventVocabulary = {
  regions: readonly string[];
  categories: readonly string[];
  countries: readonly string[];
  cities: readonly string[];
  organizers: readonly string[];
};

export const EVENT_LIMIT_OPTIONS = [25, 50, 100, 200] as const;
export const DEFAULT_EVENT_LIMIT = 25;
export const MAX_EVENT_LIMIT = 200;

export function emptyEventAskQuery(): EventAskQuery {
  return {
    filters: emptyEventFilters(),
    search: '',
    limit: DEFAULT_EVENT_LIMIT,
    sort: 'date',
  };
}

// ── Text helpers ────────────────────────────────────────────────────────────

/** Matches lib/events/filters.ts `normalize`, so both sides fold text alike. */
export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-phrase match on normalized text. Boundaries are non-alphanumeric
 * rather than `\b` so "Asia-Pacific" and "R&D" survive escaping.
 */
function hasPhrase(haystack: string, phrase: string): boolean {
  const needle = normalize(phrase);
  if (!needle) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:$|[^a-z0-9])`).test(haystack);
}

/**
 * Every vocabulary entry present in the text, longest first so "United
 * Kingdom" wins over "Kingdom" and the shorter one is not also reported.
 */
function matchVocabulary(text: string, vocabulary: readonly string[], max: number): string[] {
  const sorted = [...vocabulary].sort((left, right) => right.length - left.length);
  const found: string[] = [];
  let remaining = text;

  for (const entry of sorted) {
    if (found.length >= max) break;
    // "All Regions" / "All Categories" are UI placeholders, not real values.
    if (/^all /i.test(entry)) continue;
    if (!hasPhrase(remaining, entry)) continue;
    found.push(entry);
    // Blank the match so a contained shorter entry cannot also fire.
    remaining = remaining.replace(new RegExp(escapeRegExp(normalize(entry)), 'g'), ' ');
  }

  return found;
}

// ── Industry aliases ────────────────────────────────────────────────────────

/**
 * Everyday words mapped onto the catalog's 13 categories. The category names
 * themselves are matched first, so this only covers what a person would type
 * instead of the official label.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  medical: 'Medical & Healthcare',
  healthcare: 'Medical & Healthcare',
  health: 'Medical & Healthcare',
  pharma: 'Medical & Healthcare',
  pharmaceutical: 'Medical & Healthcare',
  hospital: 'Medical & Healthcare',
  dental: 'Medical & Healthcare',
  manufacturing: 'Manufacturing & Engineering',
  engineering: 'Manufacturing & Engineering',
  industrial: 'Manufacturing & Engineering',
  machinery: 'Manufacturing & Engineering',
  machine: 'Manufacturing & Engineering',
  plastics: 'Plastics & Rubber',
  plastic: 'Plastics & Rubber',
  rubber: 'Plastics & Rubber',
  polymer: 'Plastics & Rubber',
  food: 'Food & Beverage',
  beverage: 'Food & Beverage',
  drink: 'Food & Beverage',
  catering: 'Food & Beverage',
  hospitality: 'Food & Beverage',
  tech: 'Technology & Electronics',
  technology: 'Technology & Electronics',
  electronics: 'Technology & Electronics',
  electronic: 'Technology & Electronics',
  it: 'Technology & Electronics',
  software: 'Technology & Electronics',
  semiconductor: 'Technology & Electronics',
  construction: 'Construction & Building',
  building: 'Construction & Building',
  architecture: 'Construction & Building',
  interiors: 'Construction & Building',
  energy: 'Energy & Environment',
  environment: 'Energy & Environment',
  environmental: 'Energy & Environment',
  solar: 'Energy & Environment',
  renewable: 'Energy & Environment',
  water: 'Energy & Environment',
  waste: 'Energy & Environment',
  automotive: 'Automotive',
  auto: 'Automotive',
  car: 'Automotive',
  cars: 'Automotive',
  vehicle: 'Automotive',
  mobility: 'Automotive',
  packaging: 'Packaging',
  packing: 'Packaging',
  print: 'Packaging',
  printing: 'Packaging',
  label: 'Packaging',
  textiles: 'Textiles & Fashion',
  textile: 'Textiles & Fashion',
  fashion: 'Textiles & Fashion',
  apparel: 'Textiles & Fashion',
  garment: 'Textiles & Fashion',
  agriculture: 'Agriculture',
  agri: 'Agriculture',
  farming: 'Agriculture',
  farm: 'Agriculture',
  livestock: 'Agriculture',
  horticulture: 'Agriculture',
  security: 'Security & Safety',
  safety: 'Security & Safety',
  defence: 'Security & Safety',
  defense: 'Security & Safety',
  fire: 'Security & Safety',
};

const REGION_ALIASES: Record<string, string> = {
  apac: 'Asia-Pacific',
  asia: 'Asia-Pacific',
  'asia pacific': 'Asia-Pacific',
  'south east asia': 'Asia-Pacific',
  'southeast asia': 'Asia-Pacific',
  oceania: 'Asia-Pacific',
  europe: 'Europe',
  european: 'Europe',
  eu: 'Europe',
  emea: 'Europe',
  americas: 'Americas',
  america: 'Americas',
  'north america': 'Americas',
  'south america': 'Americas',
  latam: 'Americas',
  'latin america': 'Americas',
  usa: 'Americas',
  africa: 'Africa & Middle East',
  'middle east': 'Africa & Middle East',
  mena: 'Africa & Middle East',
  gulf: 'Africa & Middle East',
};

/** Country spellings people type that differ from the catalog's. */
const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'United Kingdom',
  britain: 'United Kingdom',
  england: 'United Kingdom',
  usa: 'USA',
  'united states': 'USA',
  'u.s.a.': 'USA',
  america: 'USA',
  uae: 'United Arab Emirates',
  holland: 'Netherlands',
  deutschland: 'Germany',
};

const CITY_ALIASES: Record<string, string> = {
  munich: 'München',
  cologne: 'Köln',
  nuremberg: 'Nürnberg',
  frankfurt: 'Frankfurt',
  dusseldorf: 'Düsseldorf',
  vienna: 'Wien',
  milan: 'Milano',
  rome: 'Roma',
  bangalore: 'Bengaluru',
  bombay: 'Mumbai',
  canton: 'Guangzhou',
};

// ── Calendar ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const MONTH_ABBREVIATIONS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

/** Northern-hemisphere seasons, as month spans. */
const SEASONS: Record<string, [number, number]> = {
  spring: [3, 5],
  summer: [6, 8],
  autumn: [9, 11],
  fall: [9, 11],
  winter: [12, 2],
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseMonth(text: string): number | null {
  for (let index = 0; index < MONTH_NAMES.length; index += 1) {
    if (hasPhrase(text, MONTH_NAMES[index])) return index + 1;
  }
  for (let index = 0; index < MONTH_ABBREVIATIONS.length; index += 1) {
    // "may" is both an abbreviation and a full name; "mar"/"sep" are not words
    // people use for anything else here, so an abbreviation match is safe.
    if (hasPhrase(text, MONTH_ABBREVIATIONS[index])) return index + 1;
  }
  return null;
}

function parseYear(text: string): number | null {
  const match = text.match(/(?:^|[^0-9])((?:19|20)\d{2})(?:$|[^0-9])/);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * "next spring", "this summer" — resolved against `today` so the answer is
 * stable for a given clock rather than drifting mid-session.
 *
 * Winter wraps the year end, so its range is expressed as December-to-February
 * and the end year is bumped.
 */
function parseSeason(text: string, today: Date): { dateFrom: string; dateTo: string } | null {
  for (const [name, [startMonth, endMonth]] of Object.entries(SEASONS)) {
    if (!hasPhrase(text, name)) continue;

    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth() + 1;
    const isNext = /\bnext\b/.test(text);
    const isThis = /\bthis\b/.test(text);

    let year = currentYear;
    if (isNext) year = currentYear + 1;
    // Unqualified, or "this": if the season has already passed, mean the next one.
    else if (!isThis && endMonth < currentMonth && startMonth <= endMonth) year = currentYear + 1;

    const endYear = startMonth > endMonth ? year + 1 : year;
    return {
      dateFrom: `${year}-${pad2(startMonth)}-01`,
      dateTo: `${endYear}-${pad2(endMonth)}-${pad2(lastDayOfMonth(endYear, endMonth))}`,
    };
  }
  return null;
}

/** Explicit ISO range: "from 2026-03-01 to 2026-06-30", "2026-03-01..2026-06-30". */
function parseIsoRange(raw: string): { dateFrom: string | null; dateTo: string | null } {
  const both = raw.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:-|–|to|until|through|\.\.)\s*(\d{4}-\d{2}-\d{2})/i
  );
  if (both && isValidIsoDate(both[1]) && isValidIsoDate(both[2])) {
    return { dateFrom: both[1], dateTo: both[2] };
  }

  const after = raw.match(/\b(?:from|after|since|on\s+or\s+after)\s+(\d{4}-\d{2}-\d{2})/i);
  const before = raw.match(/\b(?:to|until|before|through|by)\s+(\d{4}-\d{2}-\d{2})/i);
  return {
    dateFrom: after && isValidIsoDate(after[1]) ? after[1] : null,
    dateTo: before && isValidIsoDate(before[1]) ? before[1] : null,
  };
}

// ── Organizer ───────────────────────────────────────────────────────────────

/**
 * "by organizer Messe Frankfurt", "organised by Koelnmesse", "run by RX".
 *
 * The catalog's organizer list is thousands of entries and matching it wholesale
 * would be slow and noisy, so the phrase is read out of the sentence first and
 * only then snapped to a real organizer when one matches. An unmatched name is
 * still returned — `filterEventList` matches organizers loosely.
 */
function parseOrganizer(
  raw: string,
  organizers: readonly string[]
): { value: string; phrase: string } | null {
  /**
   * Most specific pattern first. A bare "by" is last on purpose: with it ahead
   * of "organizer <name>", "by organizer Messe Frankfurt" captured the literal
   * word "organizer" as part of the company name.
   */
  const patterns = [
    /\b(?:organi[sz]ed|organi[sz]er|run|hosted|held)\s+by\s+([A-Za-zÀ-ÿ0-9&.\-' ]{3,60})/i,
    /\borgani[sz]er\s*:?\s+([A-Za-zÀ-ÿ0-9&.\-' ]{3,60})/i,
    /\bby\s+([A-Za-zÀ-ÿ0-9&.\-' ]{3,60})/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;

    // Trim trailing clause words the greedy capture swallowed ("... in 2027").
    const candidate = match[1]
      .replace(
        /\b(?:in|on|during|for|at|from|to|next|this|year|month|events?|shows?|expos?|exhibitions?|fairs?)\b.*$/i,
        ''
      )
      .replace(/[.,;]+$/, '')
      .trim();
    if (candidate.length < 3) continue;

    const normalized = normalize(candidate);
    const exact = organizers.find((entry) => normalize(entry) === normalized);
    if (exact) return { value: exact, phrase: candidate };

    // Prefer the shortest catalog organizer that contains what was typed, so
    // "Messe Düsseldorf" beats a longer subsidiary that also contains it.
    const partial = organizers
      .filter((entry) => normalize(entry).includes(normalized))
      .sort((left, right) => left.length - right.length)[0];
    return { value: partial ?? candidate, phrase: candidate };
  }

  return null;
}

// ── Limit & sort ────────────────────────────────────────────────────────────

export function clampEventLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EVENT_LIMIT;
  return Math.min(MAX_EVENT_LIMIT, Math.max(1, Math.trunc(value)));
}

function parseLimit(text: string): number | null {
  const beforeNoun = text.match(
    /(?:^|[^0-9])(\d{1,4})\s+(?:[a-z&,'-]+\s+){0,4}?(?:events?|shows?|expos?|exhibitions?|fairs?|results?)(?:$|[^a-z])/
  );
  if (beforeNoun) return clampEventLimit(Number(beforeNoun[1]));

  const afterVerb = text.match(
    /\b(?:top|first|list|show|give|find|get|fetch)(?:\s+me)?\s+(\d{1,4})(?:$|[^0-9])/
  );
  if (afterVerb) return clampEventLimit(Number(afterVerb[1]));

  return null;
}

function parseSort(text: string): EventSort {
  if (/\b(?:alphabetical(?:ly)?|a-z|by\s+name)\b/.test(text)) return 'name';
  if (/\b(?:most\s+relevant|best\s+match|relevance)\b/.test(text)) return 'relevance';
  return 'date';
}

// ── Leftover text -> keywords ───────────────────────────────────────────────

/**
 * Words that carry no filtering meaning. Whatever survives after the dictionary
 * passes have consumed their matches becomes the free-text search, so this list
 * is what stops "Can I get events related to..." from being searched for.
 */
const STOPWORDS = new Set([
  'a', 'about', 'all', 'an', 'and', 'any', 'are', 'around', 'at', 'available',
  'by', 'can', 'conference', 'conferences', 'coming', 'during', 'event',
  'events', 'exhibition', 'exhibitions', 'expo', 'expos', 'fair', 'fairs',
  'find', 'for', 'from', 'get', 'give', 'happening', 'have', 'held', 'i',
  'in', 'is', 'held', 'list', 'looking', 'me', 'my', 'near', 'next', 'of',
  'on', 'or', 'organised', 'organized', 'organiser', 'organizer', 'please',
  'related', 'run', 'search', 'see', 'show', 'shows', 'some', 'sort', 'that',
  'the', 'their', 'there', 'these', 'this', 'to', 'top', 'trade', 'tradeshow',
  'tradeshows', 'want', 'what', 'when', 'where', 'which', 'with', 'within',
  'year', 'years', 'month', 'months', 'season', 'you',
]);

/** Quoted phrases are taken verbatim as keywords. */
function collectQuoted(raw: string): string[] {
  const out: string[] = [];
  const regex = /["'“”‘’]([^"'“”‘’]{2,40})["'“”‘’]/g;
  let match = regex.exec(raw);
  while (match) {
    out.push(match[1].trim());
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
    match = regex.exec(raw);
  }
  return out;
}

// ── Parse ───────────────────────────────────────────────────────────────────

/**
 * Reads a question into the Events Explorer's search state.
 *
 * Never throws and never comes back empty-handed: with nothing recognised the
 * remaining words become the free-text search, which is what the rail's box
 * would have done with the same sentence.
 */
export function parseEventQuery(
  raw: string,
  vocabulary: EventVocabulary,
  today = new Date()
): EventAskQuery {
  const query = emptyEventAskQuery();
  const filters: EventFilters = query.filters;

  query.limit = parseLimit(normalize(raw)) ?? DEFAULT_EVENT_LIMIT;
  query.sort = parseSort(normalize(raw));

  // Track what the dictionaries consumed, so it is not searched for again as
  // free text. Values are normalized phrases.
  const consumed: string[] = [];
  const consume = (values: string[]) => {
    for (const value of values) consumed.push(normalize(value));
  };

  /**
   * Organizer is read first, and its phrase is blanked out of the text before
   * anything else runs. Company names are full of place names — "Messe
   * Frankfurt" would otherwise be filed as the city Frankfurt, and the rest of
   * the name would leak into the free-text search.
   */
  let text = normalize(raw);
  const organizer = parseOrganizer(raw, vocabulary.organizers);
  if (organizer) {
    filters.organizers = [organizer.value];
    text = text.replace(new RegExp(escapeRegExp(normalize(organizer.phrase)), 'g'), ' ');
  }

  // ── Place ──
  filters.regions = matchVocabulary(text, vocabulary.regions, 4);
  for (const [alias, region] of Object.entries(REGION_ALIASES)) {
    if (filters.regions.length >= 4) break;
    if (hasPhrase(text, alias) && !filters.regions.includes(region)) {
      filters.regions.push(region);
      consumed.push(normalize(alias));
    }
  }
  consume(filters.regions);

  filters.countries = matchVocabulary(text, vocabulary.countries, 3);
  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    if (filters.countries.length >= 3) break;
    if (hasPhrase(text, alias) && !filters.countries.includes(country)) {
      filters.countries.push(country);
      consumed.push(normalize(alias));
    }
  }
  consume(filters.countries);

  filters.cities = matchVocabulary(text, vocabulary.cities, 3);
  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    if (filters.cities.length >= 3) break;
    if (hasPhrase(text, alias) && !filters.cities.includes(city)) {
      filters.cities.push(city);
      consumed.push(normalize(alias));
    }
  }
  consume(filters.cities);

  // ── Industry ──
  filters.categories = matchVocabulary(text, vocabulary.categories, 3);
  consume(filters.categories);
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (filters.categories.length >= 3) break;
    if (hasPhrase(text, alias) && !filters.categories.includes(category)) {
      filters.categories.push(category);
      consumed.push(normalize(alias));
    }
  }

  // ── Calendar ──
  // An explicit ISO range wins over a month/year, which wins over a season:
  // the more precise the user was, the more precisely it is honoured.
  const isoRange = parseIsoRange(raw);
  if (isoRange.dateFrom || isoRange.dateTo) {
    filters.dateFrom = isoRange.dateFrom;
    filters.dateTo = isoRange.dateTo;
  } else {
    const month = parseMonth(text);
    const year = parseYear(text);
    if (month !== null || year !== null) {
      filters.month = month;
      filters.year = year;
      if (month !== null) consumed.push(MONTH_NAMES[month - 1], MONTH_ABBREVIATIONS[month - 1]);
      if (year !== null) consumed.push(String(year));
    } else {
      const season = parseSeason(text, today);
      if (season) {
        filters.dateFrom = season.dateFrom;
        filters.dateTo = season.dateTo;
        for (const name of Object.keys(SEASONS)) consumed.push(name);
      }
    }
  }

  // ── Keywords & leftover free text ──
  const quoted = collectQuoted(raw);
  if (quoted.length > 0) {
    filters.keywords = quoted.slice(0, 4);
    consume(filters.keywords);
  }

  let leftover = text;
  for (const phrase of consumed) {
    if (!phrase) continue;
    leftover = leftover.replace(new RegExp(escapeRegExp(phrase), 'g'), ' ');
  }
  const residual = leftover
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word) && !/^\d+$/.test(word));

  // Residual words become the search box, not keywords: the box ranks by name
  // match, which is what someone typing a show's name expects. Keywords are
  // AND-ed against the whole blob and would silently empty the result set.
  if (residual.length > 0) query.search = residual.join(' ');

  return query;
}

/** True when the parse found something to filter on. */
export function hasEventCriteria(query: EventAskQuery): boolean {
  const { filters, search } = query;
  return Boolean(
    search.trim() ||
      filters.regions.length ||
      filters.countries.length ||
      filters.cities.length ||
      filters.categories.length ||
      filters.organizers.length ||
      filters.keywords.length ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.month ||
      filters.year ||
      filters.favouritesOnly
  );
}
