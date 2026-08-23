import { describe, expect, it } from 'vitest';
import {
  applyPeopleFilters,
  computePeopleFacets,
  paramsToFilters,
  parsePeopleFilters,
  serializePeopleQuery,
} from '@/lib/people/filters';
import { emptyPeopleFilters, type PeopleFilters, type Person } from '@/types/people';

function makePerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    firstName: 'Sarah',
    lastName: 'Miller',
    title: 'Marketing Manager',
    seniority: 'Manager',
    department: 'Marketing',
    company: 'NovaAI',
    companyDomain: 'novaai.de',
    companyHeadcount: '51-200',
    industry: 'Artificial Intelligence',
    country: 'Germany',
    location: 'Berlin, Germany',
    workEmail: 'sarah.miller@novaai.de',
    phone: null,
    linkedinUrl: null,
    verification: 'verified',
    confidence: 91,
    platformScore: 98,
    source: 'user_import',
    keywords: ['automation'],
    buyingIntent: 'high',
    fetchedAt: '2026-02-01',
    lastActiveAt: '2026-08-01',
    ...overrides,
  };
}

const people: Person[] = [
  makePerson({ id: 'p1' }),
  makePerson({
    id: 'p2',
    firstName: 'David',
    lastName: 'Lee',
    title: 'Sales Director',
    seniority: 'Director',
    department: 'Sales',
    company: 'CloudForge',
    country: 'United Kingdom',
    location: 'London, United Kingdom',
    workEmail: 'david.lee@cloudforge.co.uk',
    verification: 'needs_verification',
    confidence: 68,
    source: 'licensed_dataset',
    keywords: ['expansion'],
    buyingIntent: 'low',
    companyHeadcount: '1001-5000',
    industry: 'SaaS',
  }),
  makePerson({
    id: 'p3',
    firstName: 'Jonas',
    lastName: 'Richter',
    title: 'Product Lead',
    seniority: 'Director',
    department: 'Product',
    company: 'NovaAI',
    verification: 'invalid',
    confidence: 41,
    source: 'enrichment',
    keywords: ['automation', 'iot'],
    buyingIntent: 'none',
  }),
];

function withFilters(overrides: Partial<PeopleFilters>): PeopleFilters {
  return { ...emptyPeopleFilters(), ...overrides };
}

describe('applyPeopleFilters', () => {
  it('returns everything when nothing is applied', () => {
    expect(applyPeopleFilters(people, emptyPeopleFilters())).toHaveLength(3);
  });

  it('ORs within a dimension and ANDs across dimensions', () => {
    expect(
      applyPeopleFilters(people, withFilters({ departments: ['Marketing', 'Sales'] }))
    ).toHaveLength(2);

    expect(
      applyPeopleFilters(
        people,
        withFilters({ departments: ['Marketing', 'Sales'], countries: ['Germany'] })
      ).map((person) => person.id)
    ).toEqual(['p1']);
  });

  it('filters on verification as a single value', () => {
    expect(
      applyPeopleFilters(people, withFilters({ verification: 'verified' })).map((p) => p.id)
    ).toEqual(['p1']);
  });

  it('treats minConfidence as an inclusive floor', () => {
    expect(applyPeopleFilters(people, withFilters({ minConfidence: 50 })).map((p) => p.id)).toEqual([
      'p1',
      'p2',
    ]);
    expect(applyPeopleFilters(people, withFilters({ minConfidence: 90 })).map((p) => p.id)).toEqual([
      'p1',
    ]);
  });

  it('matches titles as a substring, case-insensitively', () => {
    expect(applyPeopleFilters(people, withFilters({ titles: ['marketing'] })).map((p) => p.id)).toEqual(
      ['p1']
    );
  });

  it('matches company, country and location exactly but case-insensitively', () => {
    expect(applyPeopleFilters(people, withFilters({ companies: ['novaai'] }))).toHaveLength(2);
    expect(applyPeopleFilters(people, withFilters({ countries: ['GERMANY'] }))).toHaveLength(2);
    expect(
      applyPeopleFilters(people, withFilters({ locations: ['London, United Kingdom'] }))
    ).toHaveLength(1);
  });

  it('ORs keywords so any listed term is enough', () => {
    expect(applyPeopleFilters(people, withFilters({ keywords: ['iot'] })).map((p) => p.id)).toEqual([
      'p3',
    ]);
    expect(applyPeopleFilters(people, withFilters({ keywords: ['iot', 'expansion'] }))).toHaveLength(
      2
    );
  });

  it('searches name, title, company and email', () => {
    expect(applyPeopleFilters(people, withFilters({ search: 'david' })).map((p) => p.id)).toEqual([
      'p2',
    ]);
    expect(applyPeopleFilters(people, withFilters({ search: 'cloudforge.co.uk' })).map((p) => p.id)).toEqual([
      'p2',
    ]);
    expect(applyPeopleFilters(people, withFilters({ search: 'sarah miller' })).map((p) => p.id)).toEqual([
      'p1',
    ]);
  });

  it('returns an empty list rather than throwing when nothing matches', () => {
    expect(applyPeopleFilters(people, withFilters({ countries: ['Atlantis'] }))).toEqual([]);
  });
});

describe('computePeopleFacets', () => {
  it('counts a dimension as if its own selection were cleared', () => {
    const facets = computePeopleFacets(people, withFilters({ countries: ['Germany'] }));

    // Country counts ignore the country filter, so the UK is still offered.
    expect(facets.countries).toEqual([
      { value: 'Germany', count: 2 },
      { value: 'United Kingdom', count: 1 },
    ]);
    // Department counts DO respect it.
    expect(facets.departments.map((option) => option.value).sort()).toEqual([
      'Marketing',
      'Product',
    ]);
  });

  it('counts verification alongside the list dimensions', () => {
    const facets = computePeopleFacets(people, emptyPeopleFilters());
    expect(facets.verification).toEqual([
      { value: 'invalid', count: 1 },
      { value: 'needs_verification', count: 1 },
      { value: 'verified', count: 1 },
    ]);
  });

  it('sorts by count descending, then alphabetically', () => {
    const facets = computePeopleFacets(people, emptyPeopleFilters());
    expect(facets.companies).toEqual([
      { value: 'NovaAI', count: 2 },
      { value: 'CloudForge', count: 1 },
    ]);
  });
});

describe('URL round-trip', () => {
  it('round-trips every filter through the query string', () => {
    const filters = withFilters({
      titles: ['Marketing Manager'],
      seniorities: ['Manager'],
      departments: ['Marketing'],
      companies: ['NovaAI'],
      locations: ['Berlin, Germany'],
      countries: ['Germany', 'France'],
      headcounts: ['51-200'],
      industries: ['Artificial Intelligence'],
      keywords: ['automation'],
      buyingIntents: ['high'],
      sources: ['user_import'],
      verification: 'verified',
      minConfidence: 70,
      lookalikeSeedId: 'p1',
      search: 'sarah',
    });

    expect(paramsToFilters(serializePeopleQuery(filters))).toEqual(filters);
  });

  it('serialises an untouched state to an empty string', () => {
    expect(serializePeopleQuery(emptyPeopleFilters())).toBe('');
  });

  it('appends extra params such as tab and page', () => {
    const query = serializePeopleQuery(emptyPeopleFilters(), { tab: 'saved', page: '3' });
    expect(query).toBe('?tab=saved&page=3');
  });

  it('drops values outside the closed vocabularies', () => {
    const filters = paramsToFilters(
      '?verification=banana&minConfidence=63&seniority=Wizard&seniority=VP&intent=galactic&source=user_import'
    );
    expect(filters.verification).toBeNull();
    expect(filters.minConfidence).toBeNull();
    expect(filters.seniorities).toEqual(['VP']);
    expect(filters.buyingIntents).toEqual([]);
    expect(filters.sources).toEqual(['user_import']);
  });

  it('ignores unknown params instead of throwing', () => {
    expect(paramsToFilters('?nonsense=1&country=Germany').countries).toEqual(['Germany']);
  });
});

/**
 * The lenient drop above is deliberate for the rail and the assistant binding:
 * a value invented by a model must never reach a query, and a stale shared link
 * must still render. But a machine caller wants the opposite — being told, so a
 * near-miss like `verification=Verified` fails loudly instead of quietly
 * returning every row. `parsePeopleFilters` reports; `paramsToFilters` does not.
 */
describe('parsePeopleFilters', () => {
  it('reports a dropped list value and keeps the valid ones', () => {
    const { filters, dropped } = parsePeopleFilters('?seniority=Wizard&seniority=VP');

    expect(filters.seniorities).toEqual(['VP']);
    expect(dropped).toEqual([{ key: 'seniorities', value: 'Wizard' }]);
  });

  it('reports a dropped verification value', () => {
    const { filters, dropped } = parsePeopleFilters('?verification=Verified');

    expect(filters.verification).toBeNull();
    expect(dropped).toEqual([{ key: 'verification', value: 'Verified' }]);
  });

  it('reports a dropped confidence floor', () => {
    const { filters, dropped } = parsePeopleFilters('?minConfidence=85');

    expect(filters.minConfidence).toBeNull();
    expect(dropped).toEqual([{ key: 'minConfidence', value: '85' }]);
  });

  it('reports nothing for a query whose values are all accepted', () => {
    const { filters, dropped } = parsePeopleFilters(
      '?seniority=VP&verification=verified&minConfidence=90&country=Germany'
    );

    expect(dropped).toEqual([]);
    expect(filters.seniorities).toEqual(['VP']);
    expect(filters.verification).toBe('verified');
    expect(filters.minConfidence).toBe(90);
  });

  it('does not report an unknown param name, only an unknown value', () => {
    // `nonsense` is not a filter at all. Reporting it would make every stray
    // tracking param a 400.
    expect(parsePeopleFilters('?nonsense=1&country=Germany').dropped).toEqual([]);
  });

  it('does not report an open-vocabulary value', () => {
    // Titles and countries are matched against the data, not against a list.
    expect(parsePeopleFilters('?title=Chief+Vibes+Officer').dropped).toEqual([]);
  });

  it('agrees with paramsToFilters on the resulting filters', () => {
    const query = '?verification=Verified&seniority=Wizard&seniority=VP&country=Germany';

    expect(parsePeopleFilters(query).filters).toEqual(paramsToFilters(query));
  });
});
