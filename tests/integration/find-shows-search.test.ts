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
    countryCode: 'DE',
    region: 'Europe',
    venue: 'Messe Düsseldorf',
    organizer: 'Messe Düsseldorf GmbH',
    frequency: 'annual',
    website: 'https://medica.de',
    email: 'info@medica.de',
    rawCategories: ['Medical & Healthcare'],
    categories: ['Medical', 'Healthcare'],
    primaryCategory: 'Medical',
    startDate: '2026-11-16',
    endDate: '2026-11-19',
    startMonth: '2026-11',
    endMonth: '2026-11',
    displayDate: '16 - 19 Nov 2026',
    searchText: '',
    seedAsset: { bannerUrl: null, logoUrl: null, eventseyeUrl: null },
    description: 'World forum for medicine.',
    webDescription: '',
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
  categories: ['Plastics'],
  primaryCategory: 'Plastics',
  startDate: '2027-02-09',
  // End with the start: the base fixture's November 2026 end would make this
  // event end before it starts, which no catalog event does.
  endDate: '2027-02-09',
  startMonth: '2027-02',
  endMonth: '2027-02',
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
    expect(matchesSearchQuery(event, 'medical')).toBe(true); // industry
    expect(matchesSearchQuery(event, 'dusseldorf')).toBe(true); // city, accent-insensitive
    expect(matchesSearchQuery(event, 'Düsseldorf')).toBe(true);
    expect(matchesSearchQuery(event, 'germany')).toBe(true); // country
    expect(matchesSearchQuery(event, 'healthcare')).toBe(true); // category
  });

  it("matches individual categories, never the seed's legacy combined labels", () => {
    // PLASTEC is tagged Plastics only; "Rubber" survives just in the legacy
    // "Plastics & Rubber" bucket, which must not pull it into rubber searches.
    expect(matchesSearchQuery(plastics, 'plastics')).toBe(true);
    expect(matchesSearchQuery(plastics, 'rubber')).toBe(false);
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

  it('searches venue, organizer and the description too', () => {
    expect(matchesSearchQuery(event, 'messe')).toBe(true); // venue/organizer
    expect(matchesSearchQuery(event, 'gmbh')).toBe(true); // organizer
    expect(matchesSearchQuery(event, 'forum')).toBe(true); // description
    expect(getSearchableValues(event)).toContain(event.description);
  });

  it('matches the description on whole words only, so prose does not match everything', () => {
    expect(matchesSearchQuery(event, 'medicine')).toBe(true);
    expect(matchesSearchQuery(event, 'medicin')).toBe(false); // prefix of a description-only word
    expect(matchesSearchQuery(event, 'orld')).toBe(false);
  });

  it('matches the title anywhere, but every other field only at word starts', () => {
    const inLausanne = makeEvent({ name: 'ART FAIR', city: 'Lausanne', country: 'Switzerland', venue: 'Beaulieu' });
    const titledLausanne = makeEvent({ name: 'ART3F LAUSANNE', city: 'Geneva', country: 'Switzerland' });
    const reconstructionOrganizer = makeEvent({ name: 'BUILD EXPO', organizer: 'Reconstruction Group' });

    expect(matchesSearchQuery(inLausanne, 'usa')).toBe(false); // city, mid-word
    expect(matchesSearchQuery(reconstructionOrganizer, 'construction')).toBe(false); // organizer, mid-word
    expect(matchesSearchQuery(titledLausanne, 'usa')).toBe(true); // title contains
    // Partial = the start of a word outside the title.
    expect(matchesSearchQuery(inLausanne, 'laus')).toBe(true);
    expect(matchesSearchQuery(event, 'dussel')).toBe(true);
  });

  it('matches country aliases such as USA and UK', () => {
    expect(matchesSearchQuery(plastics, 'usa')).toBe(true);
    expect(matchesSearchQuery(plastics, 'united states')).toBe(true);
    expect(matchesSearchQuery(makeEvent({ country: 'United Kingdom' }), 'uk')).toBe(true);
    expect(matchesSearchQuery(event, 'usa')).toBe(false);
  });

  it('tolerates a typo when no catalog word starts with the token', () => {
    const oslo = makeEvent({ name: 'GARDEN SHOW OSLO', city: 'Oslo', country: 'Norway' });
    expect(matchesSearchQuery(oslo, 'norwy')).toBe(true); // dropped letter
    expect(matchesSearchQuery(oslo, 'nrowey')).toBe(false); // two edits on a 6-letter word
    expect(matchesSearchQuery(event, 'germnay')).toBe(true); // swapped letters
    expect(matchesSearchQuery(event, 'medcial')).toBe(true);
    // Short tokens are never fuzzed — too many false hits.
    expect(matchesSearchQuery(oslo, 'olso')).toBe(true); // 4 letters: 1 edit allowed
    expect(matchesSearchQuery(oslo, 'osl')).toBe(true); // prefix
    expect(matchesSearchQuery(oslo, 'olo')).toBe(false);
  });

  it('ignores case, surrounding and repeated whitespace, and connectives', () => {
    expect(matchesSearchQuery(event, '   MEDICAL    germany  ')).toBe(true);
    expect(matchesSearchQuery(event, 'medical and germany')).toBe(true);
    expect(tokenizeSearchQuery('food and beverage')).toEqual(['food', 'beverage']);
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
        category: 'Medical',
      })
    ).toHaveLength(1);

    expect(
      filterFindShowEvents(events, {
        ...baseFilters,
        query: 'germany',
        category: 'Plastics',
      })
    ).toEqual([]);
  });

  it('narrows Europe + Construction + "norway" to European construction shows in Norway', () => {
    const osloBuild = makeEvent({
      slug: 'oslo-build', name: 'BYGG EXPO', city: 'Oslo', country: 'Norway',
      categories: ['Construction'], primaryCategory: 'Construction',
    });
    const osloFood = makeEvent({
      slug: 'oslo-food', name: 'MATMESSE', city: 'Oslo', country: 'Norway',
      categories: ['Food'], primaryCategory: 'Food',
    });
    const stockholmBuild = makeEvent({
      slug: 'stockholm-build', name: 'NORDBYGG', city: 'Stockholm', country: 'Sweden',
      categories: ['Construction'], primaryCategory: 'Construction',
    });
    const norwayNamedInUs = makeEvent({
      slug: 'norway-us', name: 'NORWAY DAYS', city: 'Seattle', country: 'United States',
      region: 'Americas', categories: ['Construction'], primaryCategory: 'Construction',
    });

    expect(
      searchFindShowEvents([osloBuild, osloFood, stockholmBuild, norwayNamedInUs], {
        ...baseFilters,
        query: '  NORWAY ',
        region: 'Europe',
        category: 'Construction',
      }).map((event) => event.slug)
    ).toEqual(['oslo-build']);
  });

  it('keeps every filter applied whatever the query — typing never widens results', () => {
    const events = [makeEvent(), plastics];
    const filters = { ...baseFilters, region: 'Americas' as const };
    for (const query of ['', 'm', 'medica', 'germany', 'plastec', 'zzzz']) {
      const results = filterFindShowEvents(events, { ...filters, query });
      expect(results.every((event) => event.region === 'Americas')).toBe(true);
    }
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
  const at = (slug: string, overrides: Partial<FindShowEvent>) =>
    makeEvent({
      slug,
      city: 'Lyon',
      country: 'France',
      organizer: 'Show Org',
      venue: 'Hall',
      categories: ['General'],
      description: '',
      ...overrides,
    });

  it('scores the eight priorities exactly as specified', () => {
    expect(scoreEventForQuery(at('a', { name: 'PACKAGING INNOVATIONS' }), 'p')).toBe(SEARCH_SCORE.titleStartsWith); // 1
    expect(scoreEventForQuery(at('b', { name: 'CINE GEAR EXPO - ATLANTA' }), 'expo')).toBe(
      SEARCH_SCORE.titleWordStartsWith
    ); // 2
    expect(scoreEventForQuery(at('c', { name: 'SHOP EXPO' }), 'p')).toBe(SEARCH_SCORE.titleContains); // 3
    expect(scoreEventForQuery(at('d', { name: 'FAIR', organizer: 'Paris Events' }), 'paris')).toBe(
      SEARCH_SCORE.organizerMatch
    ); // 4
    expect(scoreEventForQuery(at('e', { name: 'FAIR', city: 'Paris' }), 'paris')).toBe(SEARCH_SCORE.cityMatch); // 5
    expect(scoreEventForQuery(at('f', { name: 'FAIR', country: 'Poland' }), 'poland')).toBe(
      SEARCH_SCORE.countryMatch
    ); // 6
    expect(scoreEventForQuery(at('g', { name: 'FAIR', categories: ['Packaging'] }), 'packaging')).toBe(
      SEARCH_SCORE.categoryMatch
    ); // 7
    expect(scoreEventForQuery(at('h', { name: 'FAIR', description: 'Held near Oslo' }), 'oslo')).toBe(
      SEARCH_SCORE.descriptionMatch
    ); // 8
    expect(scoreEventForQuery(at('i', { name: 'FAIR' }), 'zzzz')).toBe(SEARCH_SCORE.noMatch);
  });

  it('orders the tiers strictly: title start > title word > title substring > organizer > city > country > category > description', () => {
    const events = [
      at('description', { name: 'FAIR H', description: 'The China market' }),
      at('category', { name: 'FAIR G', categories: ['China Trade' as never] }),
      at('country', { name: 'FAIR F', country: 'China' }),
      at('city', { name: 'FAIR E', city: 'China Town' }),
      at('organizer', { name: 'FAIR D', organizer: 'China Council' }),
      at('title-contains', { name: 'INDOCHINAEXPO' }),
      at('title-word', { name: 'HI CHINA' }),
      at('title-start', { name: 'CHINA GLASS' }),
    ];

    expect(rankFindShowEvents(events, 'china').map((e) => e.slug)).toEqual([
      'title-start',
      'title-word',
      'title-contains',
      'organizer',
      'city',
      'country',
      'category',
      'description',
    ]);
  });

  it('matches the examples: "p", "digital" and "china"', () => {
    const p = rankFindShowEvents(
      [
        at('in-poland', { name: 'FAIR', country: 'Poland' }),
        at('shop', { name: 'SHOP EXPO' }),
        at('photo', { name: 'THE PHOTO SHOW' }),
        at('paperworld', { name: 'PAPERWORLD' }),
        at('photonex', { name: 'PHOTONEX EUROPE' }),
        at('packaging', { name: 'PACKAGING INNOVATIONS' }),
      ],
      'p'
    ).map((e) => e.slug);
    expect(p.slice(0, 3).sort()).toEqual(['packaging', 'paperworld', 'photonex']);
    expect(p.slice(3)).toEqual(['photo', 'shop', 'in-poland']);

    const digital = rankFindShowEvents(
      [
        at('elsewhere', { name: 'RETAIL SUMMIT', description: 'All things digital' }),
        at('african', { name: 'DIGITAL AFRICAN SUMMIT' }),
        at('signage', { name: 'DIGITAL SIGNAGE EXPERIENCE' }),
      ],
      'digital'
    ).map((e) => e.slug);
    expect(digital[2]).toBe('elsewhere');

    expect(
      rankFindShowEvents(
        [
          at('mentions', { name: 'FAIR', description: 'Buyers from China' }),
          at('in-china', { name: 'FAIR', country: 'China' }),
          at('hi-china', { name: 'HI CHINA' }),
        ],
        'china'
      ).map((e) => e.slug)
    ).toEqual(['hi-china', 'in-china', 'mentions']);
  });

  it('breaks ties by date ascending, then by name', () => {
    const later = at('later', { name: 'PACK EXPO', startDate: '2027-05-01' });
    const soonerB = at('sooner-b', { name: 'PAPER FAIR', startDate: '2026-09-01' });
    const soonerA = at('sooner-a', { name: 'PACKAGING DAY', startDate: '2026-09-01' });

    expect(rankFindShowEvents([later, soonerB, soonerA], 'p').map((e) => e.slug)).toEqual([
      'sooner-a',
      'sooner-b',
      'later',
    ]);
  });

  it('scores an alias as the country, and a typo as the word it corrects to', () => {
    expect(scoreEventForQuery(at('us', { name: 'FAIR', country: 'United States' }), 'usa')).toBe(
      SEARCH_SCORE.countryMatch
    );
    expect(scoreEventForQuery(at('chi', { name: 'FAIR', city: 'Chicago' }), 'chicgo')).toBe(SEARCH_SCORE.cityMatch);
  });

  it('scores case-insensitively', () => {
    expect(scoreEventForQuery(at('cafe', { name: 'CAFE SHOW' }), 'CAFE')).toBe(SEARCH_SCORE.titleStartsWith);
    expect(scoreEventForQuery(at('cafe', { name: 'CAFE SHOW' }), 'cafe')).toBe(SEARCH_SCORE.titleStartsWith);
  });

  it('scores a multi-word query as a phrase first, else on the average of its words', () => {
    const chinaFood = at('china-food', { name: 'CHINA FOOD EXPO', country: 'China' });
    expect(scoreEventForQuery(chinaFood, 'china food')).toBe(SEARCH_SCORE.titleStartsWith);

    const medicalInGermany = at('am-medical', { name: 'AM MEDICAL DAYS', country: 'Germany' });
    // title word (90) + country (50) → 70
    expect(scoreEventForQuery(medicalInGermany, 'medical germany')).toBe(70);
  });

  it('leaves the default date order alone when the query is empty', () => {
    const events = [makeEvent(), plastics];
    expect(rankFindShowEvents(events, '')).toBe(events);
    expect(rankFindShowEvents(events, '   ')).toBe(events);
  });

  it('ranks only what the Region and Category filters kept', () => {
    const cafeChina = at('cafe-china', { name: 'CAFE SHOW CHINA', country: 'China', region: 'Asia-Pacific', categories: ['Beverage'] });
    const chicago = at('chicago', { name: 'CHICAGO COLLECTIVE', country: 'United States', region: 'Americas', categories: ['Fashion'] });
    const toronto = at('toronto', { name: 'TORONTO GIFT FAIR', country: 'Canada', region: 'Americas' });

    expect(
      searchFindShowEvents([cafeChina, chicago, toronto], { ...baseFilters, query: 'c', region: 'Americas' }).map(
        (event) => event.slug
      )
    ).toEqual(['chicago', 'toronto']);
    expect(
      searchFindShowEvents([cafeChina, chicago, toronto], { ...baseFilters, query: 'c', category: 'Beverage' }).map(
        (event) => event.slug
      )
    ).toEqual(['cafe-china']);
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

  it('highlights at word starts, anywhere in titles, and the word a typo stands for', () => {
    expect(highlightSegments('Lausanne', 'usa')).toEqual([{ text: 'Lausanne', match: false }]);
    expect(highlightSegments('SHOP EXPO', 'p', { anywhere: true })).toEqual([
      { text: 'SHO', match: false },
      { text: 'P', match: true },
      { text: ' EX', match: false },
      { text: 'P', match: true },
      { text: 'O', match: false },
    ]);
    expect(highlightSegments('Oslo, Norway', 'norwy')).toEqual([
      { text: 'Oslo, ', match: false },
      { text: 'Norway', match: true },
    ]);
  });

  it('returns the text untouched when the query is empty or unmatched', () => {
    expect(highlightSegments('MEDICA', '')).toEqual([{ text: 'MEDICA', match: false }]);
    expect(highlightSegments('MEDICA', 'zzz')).toEqual([{ text: 'MEDICA', match: false }]);
    expect(highlightSegments('', 'medica')).toEqual([]);
  });
});
