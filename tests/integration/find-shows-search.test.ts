import { describe, expect, it } from 'vitest';
import {
  filterFindShowEvents,
  getSearchableValues,
  highlightSegments,
  matchesSearchQuery,
  normalizeSearchValue,
  rankFindShowEvents,
  scoreEventForQuery,
  searchFindShowEvents,
  SEARCH_SCORE,
  tokenizeSearchQuery,
} from '../../lib/find-shows/search-events';
import type { FindShowEvent, FindShowFilters } from '../../types/find-shows';

function makeEvent(overrides: Partial<FindShowEvent> = {}): FindShowEvent {
  return {
    slug: 'medica-dusseldorf-2026-11-16',
    name: 'MEDICA',
    dates: 'Nov. 16 - 19, 2026',
    city: 'Düsseldorf',
    country: 'Germany',
    region: 'Europe',
    venue: 'Messe Düsseldorf',
    organizer: 'Messe Düsseldorf GmbH',
    frequency: 'annual',
    website: 'https://medica.de',
    email: 'info@medica.de',
    rawCategories: ['Medical & Healthcare', 'Hospital Equipment'],
    categories: ['Medical & Healthcare'],
    primaryCategory: 'Medical & Healthcare',
    startDate: '2026-11-16',
    endDate: '2026-11-19',
    startMonth: '2026-11',
    endMonth: '2026-11',
    displayDate: '16 - 19 Nov 2026',
    searchText: '',
    seedAsset: { bannerUrl: null, logoUrl: null, eventseyeUrl: null },
    description: 'World forum for medicine.',
    seedCity: 'Düsseldorf (Germany)',
    monthYear: 'November 2026',
    duration: '4 days',
    ...overrides,
  };
}

const plastics = makeEvent({
  slug: 'plastec-west-anaheim-2027-02-09',
  name: 'PLASTEC West',
  city: 'Anaheim',
  country: 'United States',
  region: 'Americas',
  venue: 'Anaheim Convention Center',
  organizer: 'Informa Markets',
  rawCategories: ['Plastics & Rubber'],
  categories: ['Plastics & Rubber'],
  primaryCategory: 'Plastics & Rubber',
  startDate: '2027-02-09',
  startMonth: '2027-02',
  description: 'Plastics engineering show.',
});

const baseFilters: FindShowFilters = {
  query: '',
  region: 'All Regions',
  country: '',
  category: 'All Categories',
  startMonth: '',
  endMonth: '',
};

describe('find shows search — normalization', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeSearchValue('Düsseldorf')).toBe('dusseldorf');
    expect(normalizeSearchValue('MEDICA')).toBe('medica');
  });

  it('splits a query into deduplicated tokens', () => {
    expect(tokenizeSearchQuery('  Medical   GERMANY medical ')).toEqual(['medical', 'germany']);
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });
});

describe('find shows search — matching', () => {
  const event = makeEvent();

  it('searches name, industry, city, country and category, case-insensitively', () => {
    expect(matchesSearchQuery(event, 'medica')).toBe(true); // name
    expect(matchesSearchQuery(event, 'MEDICA')).toBe(true);
    expect(matchesSearchQuery(event, 'hospital equipment')).toBe(true); // industry
    expect(matchesSearchQuery(event, 'dusseldorf')).toBe(true); // city, accent-insensitive
    expect(matchesSearchQuery(event, 'Düsseldorf')).toBe(true);
    expect(matchesSearchQuery(event, 'germany')).toBe(true); // country
    expect(matchesSearchQuery(event, 'healthcare')).toBe(true); // category
  });

  it('matches an empty or whitespace-only query against everything', () => {
    expect(matchesSearchQuery(event, '')).toBe(true);
    expect(matchesSearchQuery(event, '   ')).toBe(true);
  });

  it('requires every token to match, possibly across different fields', () => {
    expect(matchesSearchQuery(event, 'medical germany')).toBe(true);
    expect(matchesSearchQuery(event, 'medical france')).toBe(false);
  });

  it('returns false when nothing matches', () => {
    expect(matchesSearchQuery(event, 'zzzz')).toBe(false);
  });

  it('does not search the editorial description', () => {
    expect(matchesSearchQuery(event, 'forum')).toBe(false);
    expect(getSearchableValues(event)).not.toContain(event.description);
  });
});

describe('find shows search — composition with the filter bar', () => {
  const events = [makeEvent(), plastics];

  it('returns every event when the query is empty', () => {
    expect(filterFindShowEvents(events, baseFilters)).toHaveLength(2);
  });

  it('applies the query together with the region filter', () => {
    expect(
      filterFindShowEvents(events, { ...baseFilters, query: 'plastec', region: 'Americas' })
    ).toEqual([plastics]);

    // Same query, contradictory region — the filters must intersect, not override.
    expect(
      filterFindShowEvents(events, { ...baseFilters, query: 'plastec', region: 'Europe' })
    ).toEqual([]);
  });

  it('applies the query together with the category filter', () => {
    expect(
      filterFindShowEvents(events, {
        ...baseFilters,
        query: 'germany',
        category: 'Medical & Healthcare',
      })
    ).toHaveLength(1);

    expect(
      filterFindShowEvents(events, {
        ...baseFilters,
        query: 'germany',
        category: 'Plastics & Rubber',
      })
    ).toEqual([]);
  });

  it('still honours the country and month filters', () => {
    expect(
      filterFindShowEvents(events, { ...baseFilters, country: 'United States' })
    ).toEqual([plastics]);
    expect(
      filterFindShowEvents(events, { ...baseFilters, startMonth: '2027-01' })
    ).toEqual([plastics]);
    expect(
      filterFindShowEvents(events, { ...baseFilters, endMonth: '2026-12' })
    ).toHaveLength(1);
  });
});

describe('find shows search — relevance scoring', () => {
  const cafeShowChina = makeEvent({
    slug: 'cafe-show-china',
    name: 'CAFE SHOW CHINA',
    city: 'Beijing',
    country: 'China',
    region: 'Asia-Pacific',
    rawCategories: ['Food & Beverage'],
    categories: ['Food & Beverage'],
    primaryCategory: 'Food & Beverage',
  });
  const chicagoCollective = makeEvent({
    slug: 'chicago-collective',
    name: "CHICAGO COLLECTIVE - MEN'S EDITION",
    city: 'Chicago',
    country: 'United States',
    region: 'Americas',
    rawCategories: ['Textiles & Fashion'],
    categories: ['Textiles & Fashion'],
    primaryCategory: 'Textiles & Fashion',
  });
  const inCanada = makeEvent({
    slug: 'toronto-show',
    name: 'TORONTO GIFT FAIR',
    city: 'Toronto',
    country: 'Canada',
    region: 'Americas',
  });
  const inChicago = makeEvent({
    slug: 'auto-show-chicago',
    name: 'AUTO SHOW',
    city: 'Chicago',
    country: 'United States',
    region: 'Americas',
  });
  const nameContains = makeEvent({
    slug: 'techcon',
    name: 'TECHCON',
    city: 'Berlin',
    country: 'Germany',
  });
  // "France" holds a 'c' without starting with one; neither its name nor its
  // city may contain a 'c', or a higher tier would claim the event.
  const countryContains = makeEvent({
    slug: 'norden-expo',
    name: 'NORDEN EXPO',
    city: 'Paris',
    country: 'France',
  });
  const cityContains = makeEvent({
    slug: 'lancaster-fair',
    name: 'NORDEN FAIR',
    city: 'Lancaster',
    country: 'United Kingdom',
  });

  it('scores each tier exactly as specified', () => {
    expect(scoreEventForQuery(cafeShowChina, 'c')).toBe(SEARCH_SCORE.nameStartsWith); // 100
    expect(scoreEventForQuery(inCanada, 'c')).toBe(SEARCH_SCORE.countryStartsWith); // 90
    expect(scoreEventForQuery(inChicago, 'c')).toBe(SEARCH_SCORE.cityStartsWith); // 80
    expect(scoreEventForQuery(nameContains, 'c')).toBe(SEARCH_SCORE.nameIncludes); // 50
    expect(scoreEventForQuery(countryContains, 'c')).toBe(SEARCH_SCORE.countryIncludes); // 40
    expect(scoreEventForQuery(cityContains, 'c')).toBe(SEARCH_SCORE.cityIncludes); // 30
  });

  it('scores case-insensitively', () => {
    expect(scoreEventForQuery(cafeShowChina, 'CAFE')).toBe(SEARCH_SCORE.nameStartsWith);
    expect(scoreEventForQuery(cafeShowChina, 'cafe')).toBe(SEARCH_SCORE.nameStartsWith);
  });

  it('ranks an industry/category-only match below every name, country or city match', () => {
    const industryOnly = makeEvent({
      slug: 'widget-fair',
      name: 'WIDGET FAIR',
      city: 'Osaka',
      country: 'Japan',
      rawCategories: ['Packaging'],
      categories: ['Packaging'],
      primaryCategory: 'Packaging',
    });

    expect(scoreEventForQuery(industryOnly, 'packaging')).toBe(SEARCH_SCORE.otherFieldMatch);
    expect(scoreEventForQuery(industryOnly, 'zzzz')).toBe(SEARCH_SCORE.noMatch);
  });

  it('puts every startsWith match ahead of partial matches, name-first', () => {
    const ranked = rankFindShowEvents(
      [cityContains, countryContains, nameContains, inChicago, inCanada, chicagoCollective, cafeShowChina],
      'c'
    );

    expect(ranked.map((event) => event.slug)).toEqual([
      'cafe-show-china', // 100 name startsWith
      'chicago-collective', // 100 name startsWith, A-Z after CAFE
      'toronto-show', // 90 country startsWith (Canada)
      'auto-show-chicago', // 80 city startsWith (Chicago)
      'techcon', // 50 name includes
      'norden-expo', // 40 country includes (France)
      'lancaster-fair', // 30 city includes (Lancaster)
    ]);
  });

  it('breaks ties alphabetically by name', () => {
    const ranked = rankFindShowEvents([chicagoCollective, cafeShowChina], 'c');
    expect(ranked.map((event) => event.name)).toEqual([
      'CAFE SHOW CHINA',
      "CHICAGO COLLECTIVE - MEN'S EDITION",
    ]);
  });

  it('leaves the default date order alone when the query is empty', () => {
    const events = [makeEvent(), plastics];
    expect(rankFindShowEvents(events, '')).toBe(events);
    expect(rankFindShowEvents(events, '   ')).toBe(events);
  });

  it('scores a multi-word query on its best term as well as the whole string', () => {
    const chinaFood = makeEvent({ slug: 'china-food', name: 'CHINA FOOD EXPO', country: 'China' });
    expect(scoreEventForQuery(chinaFood, 'china food')).toBe(SEARCH_SCORE.nameStartsWith);
  });

  it('ranks only what the Region and Category filters kept', () => {
    const events = [cafeShowChina, chicagoCollective, inCanada, inChicago];

    // Region wins over relevance: the 100-score CAFE SHOW CHINA is in
    // Asia-Pacific, so an Americas search must not rank it back in.
    expect(
      searchFindShowEvents(events, { ...baseFilters, query: 'c', region: 'Americas' }).map(
        (event) => event.slug
      )
    ).toEqual(['chicago-collective', 'toronto-show', 'auto-show-chicago']);

    expect(
      searchFindShowEvents(events, {
        ...baseFilters,
        query: 'c',
        category: 'Food & Beverage',
      }).map((event) => event.slug)
    ).toEqual(['cafe-show-china']);
  });
});

describe('find shows search — highlighting', () => {
  it('marks the matching run and preserves the original casing', () => {
    expect(highlightSegments('PLASTEC West', 'plastec')).toEqual([
      { text: 'PLASTEC', match: true },
      { text: ' West', match: false },
    ]);
  });

  it('highlights an accented match typed without accents', () => {
    expect(highlightSegments('Düsseldorf', 'dussel')).toEqual([
      { text: 'Düssel', match: true },
      { text: 'dorf', match: false },
    ]);
  });

  it('merges overlapping token hits and keeps every occurrence', () => {
    expect(highlightSegments('Auto Automotive', 'auto automo')).toEqual([
      { text: 'Auto', match: true },
      { text: ' ', match: false },
      { text: 'Automo', match: true },
      { text: 'tive', match: false },
    ]);
  });

  it('returns the text untouched when the query is empty or unmatched', () => {
    expect(highlightSegments('MEDICA', '')).toEqual([{ text: 'MEDICA', match: false }]);
    expect(highlightSegments('MEDICA', 'zzz')).toEqual([{ text: 'MEDICA', match: false }]);
    expect(highlightSegments('', 'medica')).toEqual([]);
  });
});
