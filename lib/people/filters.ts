import {
  BUYING_INTENTS,
  CONFIDENCE_THRESHOLDS,
  DATA_SOURCES,
  DEPARTMENTS,
  HEADCOUNT_BANDS,
  PEOPLE_FILTER_LIST_KEYS,
  SENIORITIES,
  VERIFICATION_STATUSES,
  emptyPeopleFilters,
  type ConfidenceThreshold,
  type PeopleFilterListKey,
  type PeopleFilters,
  type Person,
  type VerificationStatus,
} from '@/types/people';
import { normalizePeopleText } from '@/lib/people/vocabulary';

/**
 * Pure filtering, faceting and URL (de)serialisation for the People Explorer.
 *
 * Deliberately free of React and of the Claude SDK so the client rail and the
 * API routes can share it — the client filters instantly while typing, the
 * route applies the identical rules, and the two cannot drift.
 */

// ---------------------------------------------------------------------------
// URL <-> filters
// ---------------------------------------------------------------------------

const LIST_PARAM: Record<PeopleFilterListKey, string> = {
  titles: 'title',
  seniorities: 'seniority',
  departments: 'department',
  companies: 'company',
  locations: 'location',
  countries: 'country',
  headcounts: 'headcount',
  industries: 'industry',
  keywords: 'keyword',
  buyingIntents: 'intent',
  sources: 'source',
};

/**
 * Closed vocabularies are enforced here, at the parse boundary. Values arrive
 * from shared links and from the query parser, so neither source is trusted.
 * An open vocabulary (title, company, location, industry, keyword) accepts any
 * non-empty string — it is matched against the data, not against a list.
 */
const CLOSED_VOCABULARY: Partial<Record<PeopleFilterListKey, readonly string[]>> = {
  seniorities: SENIORITIES,
  departments: DEPARTMENTS,
  headcounts: HEADCOUNT_BANDS,
  buyingIntents: BUYING_INTENTS,
  sources: DATA_SOURCES,
};

/** One value that was not in its key's closed vocabulary, and so was ignored. */
export type DroppedFilterValue = { key: string; value: string };

export type ParsedPeopleFilters = {
  filters: PeopleFilters;
  /** Empty when every supplied value was accepted. */
  dropped: DroppedFilterValue[];
};

/**
 * Parses filters AND reports what it refused, for callers that must not fail
 * silently.
 *
 * Dropping an unrecognised value is the right behaviour for the rail and the
 * assistant binding: an invented value must never reach a query, and a stale
 * shared link must still render. It is the wrong behaviour for a machine
 * caller, because a dropped key reads downstream as NO constraint — so
 * `?verification=Verified` returns every person, verified or not, and nothing
 * says the filter was ignored.
 *
 * The two needs differ only in whether the caller is told. This function tells;
 * `paramsToFilters` does not. Nothing else about the parse differs, so the
 * filters returned here are always identical to the lenient ones.
 *
 * Only CLOSED vocabularies can drop. An unknown param name is not reported —
 * it was never a filter — and an open key (title, company, location, industry,
 * keyword) accepts any non-empty string by design.
 */
export function parsePeopleFilters(search: string | URLSearchParams): ParsedPeopleFilters {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const filters = emptyPeopleFilters();
  const dropped: DroppedFilterValue[] = [];

  for (const key of PEOPLE_FILTER_LIST_KEYS) {
    const values = params.getAll(LIST_PARAM[key]).filter(Boolean);
    const allowed = CLOSED_VOCABULARY[key];
    if (!allowed) {
      filters[key] = values;
      continue;
    }
    filters[key] = values.filter((value) => {
      if (allowed.includes(value)) return true;
      dropped.push({ key, value });
      return false;
    });
  }

  const verification = params.get('verification');
  if (verification && (VERIFICATION_STATUSES as readonly string[]).includes(verification)) {
    filters.verification = verification as VerificationStatus;
  } else {
    filters.verification = null;
    if (verification) dropped.push({ key: 'verification', value: verification });
  }

  // Read as a string first: the raw text is what a 400 has to quote back, and
  // Number('') is 0, which would report a missing param as a rejected one.
  const rawConfidence = params.get('minConfidence');
  const minConfidence = Number(rawConfidence);
  if ((CONFIDENCE_THRESHOLDS as readonly number[]).includes(minConfidence)) {
    filters.minConfidence = minConfidence as ConfidenceThreshold;
  } else {
    filters.minConfidence = null;
    if (rawConfidence) dropped.push({ key: 'minConfidence', value: rawConfidence });
  }

  filters.lookalikeSeedId = params.get('lookalike') || null;
  filters.search = params.get('q') ?? '';

  return { filters, dropped };
}

/**
 * The lenient parse. Unrecognised values are dropped without complaint.
 *
 * Kept as the default because both React callers parse during render, where a
 * throw would replace a slightly-wrong grid with a blank page.
 */
export function paramsToFilters(search: string | URLSearchParams): PeopleFilters {
  return parsePeopleFilters(search).filters;
}

export function filtersToParams(filters: PeopleFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of PEOPLE_FILTER_LIST_KEYS) {
    for (const value of filters[key]) params.append(LIST_PARAM[key], value);
  }
  if (filters.verification) params.set('verification', filters.verification);
  if (filters.minConfidence !== null) params.set('minConfidence', String(filters.minConfidence));
  if (filters.lookalikeSeedId) params.set('lookalike', filters.lookalikeSeedId);
  if (filters.search.trim()) params.set('q', filters.search.trim());

  return params;
}

/** Serialises to a leading-`?` string, or '' when nothing at all is set. */
export function serializePeopleQuery(
  filters: PeopleFilters,
  extra: Record<string, string> = {}
): string {
  const params = filtersToParams(filters);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

type Dimension = PeopleFilterListKey | 'verification' | 'confidence' | 'search';

function equalsAny(value: string, candidates: string[]): boolean {
  const normalized = normalizePeopleText(value);
  return candidates.some((candidate) => normalizePeopleText(candidate) === normalized);
}

function includesAny(value: string, candidates: string[]): boolean {
  const normalized = normalizePeopleText(value);
  return candidates.some((candidate) => normalized.includes(normalizePeopleText(candidate)));
}

function searchBlob(person: Person): string {
  return normalizePeopleText(
    [
      person.firstName,
      person.lastName,
      person.title,
      person.company,
      person.workEmail,
      person.location,
      person.industry,
    ].join(' ')
  );
}

/**
 * One predicate per dimension, so faceting can re-run the match with a single
 * dimension held out without duplicating the matching rules.
 */
function buildChecks(
  filters: PeopleFilters
): Record<Dimension, ((person: Person) => boolean) | null> {
  const query = normalizePeopleText(filters.search);

  return {
    // Open vocabularies match loosely — "marketing" should find "Marketing
    // Manager", and the model may return a partial title.
    titles: filters.titles.length ? (p) => includesAny(p.title, filters.titles) : null,
    industries: filters.industries.length ? (p) => includesAny(p.industry, filters.industries) : null,
    // Closed or exact-identity vocabularies match exactly.
    seniorities: filters.seniorities.length ? (p) => equalsAny(p.seniority, filters.seniorities) : null,
    departments: filters.departments.length
      ? (p) => equalsAny(p.department, filters.departments)
      : null,
    companies: filters.companies.length ? (p) => equalsAny(p.company, filters.companies) : null,
    locations: filters.locations.length ? (p) => equalsAny(p.location, filters.locations) : null,
    countries: filters.countries.length ? (p) => equalsAny(p.country, filters.countries) : null,
    headcounts: filters.headcounts.length
      ? (p) => equalsAny(p.companyHeadcount, filters.headcounts)
      : null,
    buyingIntents: filters.buyingIntents.length
      ? (p) => equalsAny(p.buyingIntent, filters.buyingIntents)
      : null,
    sources: filters.sources.length ? (p) => equalsAny(p.source, filters.sources) : null,
    // Keywords are OR-ed: a contact tagged with any selected term qualifies.
    keywords: filters.keywords.length
      ? (p) => p.keywords.some((keyword) => equalsAny(keyword, filters.keywords))
      : null,
    verification: filters.verification ? (p) => p.verification === filters.verification : null,
    confidence:
      filters.minConfidence !== null
        ? (p) => p.confidence >= (filters.minConfidence as number)
        : null,
    search: query ? (p) => searchBlob(p).includes(query) : null,
  };
}

export function applyPeopleFilters(
  people: readonly Person[],
  filters: PeopleFilters
): Person[] {
  const checks = buildChecks(filters);
  const active = Object.values(checks).filter(Boolean) as ((person: Person) => boolean)[];
  if (active.length === 0) return people as Person[];
  return people.filter((person) => active.every((check) => check(person)));
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

export type FacetOption = { value: string; count: number };
export type PeopleFacetKey = PeopleFilterListKey | 'verification';
export type PeopleFacets = Record<PeopleFacetKey, FacetOption[]>;

const FACET_KEYS: PeopleFacetKey[] = [...PEOPLE_FILTER_LIST_KEYS, 'verification'];

function valuesFor(dimension: PeopleFacetKey, person: Person): string[] {
  switch (dimension) {
    case 'titles':
      return [person.title];
    case 'seniorities':
      return [person.seniority];
    case 'departments':
      return [person.department];
    case 'companies':
      return [person.company];
    case 'locations':
      return [person.location];
    case 'countries':
      return [person.country];
    case 'headcounts':
      return [person.companyHeadcount];
    case 'industries':
      return [person.industry];
    case 'keywords':
      return person.keywords;
    case 'buyingIntents':
      return [person.buyingIntent];
    case 'sources':
      return [person.source];
    case 'verification':
      return [person.verification];
  }
}

/**
 * Counts each option against everything *except* its own dimension, so opening
 * "Country" still shows every country reachable under the other filters rather
 * than only the ones already selected.
 */
export function computePeopleFacets(
  people: readonly Person[],
  filters: PeopleFilters
): PeopleFacets {
  const checks = buildChecks(filters);
  const facets = {} as PeopleFacets;

  for (const dimension of FACET_KEYS) {
    const others = (Object.keys(checks) as Dimension[])
      .filter((key) => key !== dimension)
      .map((key) => checks[key])
      .filter(Boolean) as ((person: Person) => boolean)[];

    const counts = new Map<string, number>();
    for (const person of people) {
      if (!others.every((check) => check(person))) continue;
      for (const value of valuesFor(dimension, person)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }

    facets[dimension] = Array.from(counts, ([value, count]) => ({ value, count })).sort(
      (left, right) => right.count - left.count || left.value.localeCompare(right.value)
    );
  }

  return facets;
}
