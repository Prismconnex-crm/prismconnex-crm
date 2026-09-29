import { describe, expect, it } from 'vitest';
import {
  COUNTRIES_BY_ISO,
  editionYear,
  getRegionForCountry,
  VERIFIED_EDITIONS,
  inferEventCountry,
  inferUnknownContinent,
  resolveSeedCountry,
} from '../../lib/find-shows/country-resolution';
import { countryStatsByRegion, findShowEvents, resolveRecordLocation } from '../../lib/find-shows/catalog';
import findShowsSeed from '../../data/find-shows-seed.json';
import type { FindShowSeedRecord } from '../../types/find-shows';

const record = (overrides: Partial<FindShowSeedRecord> & { name: string }) => ({
  description: '',
  organizer: '',
  website: '',
  venue: '?',
  ...overrides,
});

describe('resolveSeedCountry', () => {
  it('canonicalises the seed’s free-text country spellings', () => {
    expect(resolveSeedCountry('UAE - United Arab Emirates')).toEqual({
      country: 'United Arab Emirates',
      countryCode: 'AE',
      region: 'Africa & Middle East',
    });
    expect(resolveSeedCountry('UK - United Kingdom').country).toBe('United Kingdom');
    expect(resolveSeedCountry('USA').country).toBe('United States');
    expect(resolveSeedCountry('Korea South').country).toBe('South Korea');
    expect(resolveSeedCountry('Burma)')).toMatchObject({ country: 'Myanmar', region: 'Asia-Pacific' });
  });

  it('files previously misplaced countries under their own continent', () => {
    expect(getRegionForCountry('UAE - United Arab Emirates')).toBe('Africa & Middle East');
    expect(getRegionForCountry('Burma)')).toBe('Asia-Pacific');
    expect(getRegionForCountry('Benin')).toBe('Africa & Middle East');
    expect(getRegionForCountry('Paraguay')).toBe('Americas');
    expect(getRegionForCountry('Tajikistan')).toBe('Asia-Pacific');
    expect(getRegionForCountry('Mauritius')).toBe('Africa & Middle East');
    expect(getRegionForCountry('Unknown')).toBeNull();
  });

  it('keeps Kosovo in Europe with its XK flag code', () => {
    expect(resolveSeedCountry('Kosovo')).toEqual({ country: 'Kosovo', countryCode: 'XK', region: 'Europe' });
  });
});

describe('inferEventCountry', () => {
  it('reads a city or country from the event name', () => {
    expect(inferEventCountry(record({ name: 'CINE GEAR EXPO - ATLANTA' }))).toMatchObject({
      country: 'United States',
      countryCode: 'US',
      region: 'Americas',
    });
    expect(inferEventCountry(record({ name: 'ARCHITECT @ WORK - NORWAY' }))).toMatchObject({
      country: 'Norway',
      countryCode: 'NO',
      region: 'Europe',
    });
  });

  it('prefers the most specific name segment — the city — over a country mention', () => {
    expect(inferEventCountry(record({ name: 'STUDY IN INDIA EXPO - SRI LANKA - COLOMBO' })).country).toBe(
      'Sri Lanka'
    );
    expect(inferEventCountry(record({ name: 'GARDEN EXPO AFRICA - DAKAR', website: 'http://x.ma' })).country).toBe(
      'Senegal'
    );
  });

  it('falls back to the description, then the website, then the organizer', () => {
    expect(
      inferEventCountry(record({ name: 'X', description: 'Trade Exhibition in Las Vegas' }))
    ).toMatchObject({ country: 'United States', evidence: 'description' });
    expect(inferEventCountry(record({ name: 'X', website: 'http://www.cede.pl/en' }))).toMatchObject({
      country: 'Poland',
      evidence: 'website domain (.pl)',
    });
    expect(inferEventCountry(record({ name: 'X', organizer: 'RX China' }))).toMatchObject({
      country: 'China',
      evidence: 'organizer',
    });
  });

  it('does not treat "Latin American" or "Americas" as the United States', () => {
    expect(
      inferEventCountry(record({ name: 'LATAMPAPER', description: 'Latin American manufacturers of Tissue' })).country
    ).toBe('Unknown');
    expect(inferEventCountry(record({ name: 'GAD AMERICAS' })).country).toBe('Unknown');
  });

  it('does not read a market or sector demonym in the description as the venue', () => {
    expect(
      inferEventCountry(
        record({ name: 'POLYMERS IN CABLES NORTH AMERICA', description: 'solutions for the American market' })
      )
    ).toMatchObject({ country: 'Unknown', region: 'Americas', source: 'none', confidence: 'none' });
    expect(
      inferEventCountry(record({ name: 'X', description: 'expertise in the Polish biotechnology sector' })).country
    ).toBe('Unknown');
    // A place name in the description still counts.
    expect(inferEventCountry(record({ name: 'X', description: 'Held at Paris Expo' })).country).toBe('France');
    // A demonym in the organizer is still the (low-confidence) organizer tier.
    expect(inferEventCountry(record({ name: 'X', organizer: 'American Dairy Goat Association' }))).toMatchObject({
      country: 'United States',
      source: 'organizer',
      confidence: 'low',
    });
  });

  it('applies a verified location only to the edition it was verified for', () => {
    expect(inferEventCountry(record({ name: 'REFRI AMERICAS', dates: 'July 2027 (?)' }))).toMatchObject({
      country: 'Costa Rica',
      region: 'Americas',
      city: 'San José',
      source: 'verified-edition',
      confidence: 'high',
    });
    // Country-level only: no city, medium confidence.
    const fireRetardants = inferEventCountry(
      record({ name: 'FIRE RETARDANTS IN PLASTICS NORTH AMERICA', dates: 'May 2027 (?)' })
    );
    expect(fireRetardants).toMatchObject({ country: 'United States', source: 'verified-edition', confidence: 'medium' });
    expect(fireRetardants.city).toBeUndefined();
    // eventseye's "? (USA)" alone is not verification.
    expect(
      inferEventCountry(record({ name: 'SINGLE-SERVE CAPSULES NORTH AMERICA', dates: 'March 2027 (?)' })).country
    ).toBe('Unknown');
    // The next edition is not verified yet, so it goes back to Unknown.
    expect(inferEventCountry(record({ name: 'REFRI AMERICAS', dates: 'July 2028 (?)' }))).toMatchObject({
      country: 'Unknown',
      region: 'Americas',
    });
    expect(inferEventCountry(record({ name: 'GAD AMERICAS', dates: 'May 2027 (?)' })).country).toBe('Unknown');
  });

  it('moves a verified edition to its real continent, and wins over a name-level veto', () => {
    expect(inferEventCountry(record({ name: 'TZMI CONGRESS', dates: 'Nov. 2026 (?)' }))).toMatchObject({
      country: 'Singapore',
      region: 'Asia-Pacific',
    });
    expect(inferEventCountry(record({ name: 'BANKSPACES', dates: 'April 2027 (?)' }))).toMatchObject({
      country: 'United States',
      region: 'Americas',
      city: 'Fort Lauderdale',
    });
    // Setcor's 2027 conferences are in Rome, not Portugal as eventseye still lists.
    expect(inferEventCountry(record({ name: 'COMPOSITES', dates: 'April 2027 (?)' }))).toMatchObject({
      country: 'Italy',
      city: 'Rome',
    });
    // WORLD OF COFFEE - EUROPE is vetoed by name (it moves every year); the
    // verified 2027 edition still resolves, other years stay Unknown.
    expect(inferEventCountry(record({ name: 'WORLD OF COFFEE - EUROPE', dates: 'June 2027 (?)' })).country).toBe(
      'Portugal'
    );
    expect(inferEventCountry(record({ name: 'WORLD OF COFFEE - EUROPE', dates: 'June 2028 (?)' })).country).toBe(
      'Unknown'
    );
  });

  it('resolves the verified 2027 UFI and World Retail Congress editions to Italy', () => {
    expect(inferEventCountry(record({ name: 'UFI EUROPEAN CONFERENCE', dates: 'June 2027 (?)' }))).toMatchObject({
      country: 'Italy',
      region: 'Europe',
      city: 'Rimini',
    });
    expect(inferEventCountry(record({ name: 'WORLD RETAIL CONGRESS', dates: 'April 2027 (?)' }))).toMatchObject({
      country: 'Italy',
      region: 'Europe',
      city: 'Milan',
    });
    // Merged into Flexible Packaging Innovation and Recycling Europe, which has its own record.
    expect(
      inferEventCountry(record({ name: 'RECYCLING FLEXIBLE PACKAGING EUROPE', dates: 'Dec. 2026 (?)' })).country
    ).toBe('Unknown');
  });

  it('matches every verified edition to exactly one catalog record, by full name and year', () => {
    const seedRecords = findShowsSeed as FindShowSeedRecord[];
    for (const [name, edition] of Object.entries(VERIFIED_EDITIONS)) {
      const matches = seedRecords.filter(
        (seedRecord) =>
          seedRecord.name.trim().toUpperCase() === name && editionYear(seedRecord.dates) === edition.edition
      );
      expect(matches, name).toHaveLength(1);
      // Only records the seed left without a location are ever overridden.
      expect(matches[0].city.includes('('), name).toBe(false);
      // …and never a placeholder copy of an edition the seed already locates
      // (same eventseye page), which would list that show twice.
      const locatedTwin = seedRecords.find(
        (other) => other !== matches[0] && other.eventseyeUrl === matches[0].eventseyeUrl && other.city.includes('(')
      );
      expect(locatedTwin, name).toBeUndefined();
    }
  });

  it('prefers the venue over a place named in the event name', () => {
    expect(
      inferEventCountry(record({ name: 'EXPO - ATLANTA', venue: 'Palais des Festivals, Cannes' }))
    ).toMatchObject({ country: 'France', source: 'venue', confidence: 'high' });
  });

  it('reports the source and confidence of every inference', () => {
    expect(inferEventCountry(record({ name: 'CINE GEAR EXPO - ATLANTA' }))).toMatchObject({
      source: 'event-name',
      confidence: 'medium',
    });
    expect(inferEventCountry(record({ name: 'X', website: 'http://www.cede.pl/en' }))).toMatchObject({
      source: 'website-domain',
      confidence: 'low',
    });
    expect(inferEventCountry(record({ name: 'MIP TV' }))).toMatchObject({ source: 'override', confidence: 'high' });
    expect(inferEventCountry(record({ name: 'MARELEC' }))).toMatchObject({
      country: 'Unknown',
      source: 'override',
      confidence: 'none',
    });
  });

  it('stays Unknown when evidence names two countries or none', () => {
    const ambiguous = inferEventCountry(
      record({ name: 'X', description: 'A Portugal and Spain summit' })
    );
    expect(ambiguous).toMatchObject({ country: 'Unknown', countryCode: null });
    expect(inferEventCountry(record({ name: 'NUTRACEUTICALS EUROPE' })).country).toBe('Unknown');
  });
});

describe('inferUnknownContinent', () => {
  it('keeps an unresolved event under the continent its name names', () => {
    expect(inferEventCountry(record({ name: 'HI DESIGN EUROPE' }))).toMatchObject({
      country: 'Unknown',
      countryCode: null,
      region: 'Europe',
    });
    expect(inferEventCountry(record({ name: 'HI DESIGN ASIA' })).region).toBe('Asia-Pacific');
    expect(inferEventCountry(record({ name: 'ELEARNING AFRICA' })).region).toBe('Africa & Middle East');
    expect(inferEventCountry(record({ name: 'GAD AMERICAS' })).region).toBe('Americas');
    expect(inferEventCountry(record({ name: 'X NORTH AMERICA' })).region).toBe('Americas');
  });

  it('falls back to the description, then to country hints that agree on a continent', () => {
    expect(
      inferUnknownContinent(record({ name: 'X', description: 'Latin American manufacturers' })).region
    ).toBe('Americas');
    // Two countries: no country, but one continent.
    expect(
      inferEventCountry(record({ name: 'X', description: 'A Portugal and Spain summit' })).region
    ).toBe('Europe');
    expect(inferUnknownContinent(record({ name: 'X', website: 'http://x.co.uk' })).region).toBe('Europe');
  });

  it('never leaves an event outside the continents: no evidence keeps the old Europe default', () => {
    expect(inferUnknownContinent(record({ name: 'BANKSPACES' })).region).toBe('Europe');
  });
});

describe('catalog after country cleanup', () => {
  it('gives every event a continent, and every known country its ISO code', () => {
    for (const event of findShowEvents) {
      expect(event.region).toBeTruthy();
      if (event.country === 'Unknown') {
        expect(event.countryCode).toBeNull();
      } else if (event.countryCode) {
        expect(COUNTRIES_BY_ISO[event.countryCode]).toEqual({ name: event.country, region: event.region });
      }
    }
  });

  it('places each dropdown country only under its own continent, once', () => {
    const seen = new Set<string>();
    for (const [region, stats] of Object.entries(countryStatsByRegion)) {
      for (const stat of stats.filter((entry) => entry.country !== 'Unknown')) {
        expect(getRegionForCountry(stat.country)).toBe(region);
        expect(seen.has(stat.country)).toBe(false);
        seen.add(stat.country);
      }
    }
  });

  it('preserves every event across the dropdown counts, Unknown buckets included', () => {
    const inContinents = Object.values(countryStatsByRegion)
      .flat()
      .reduce((sum, stat) => sum + stat.count, 0);
    expect(inContinents).toBe(findShowEvents.length);
  });

  it('lists a continent-level Unknown bucket that matches its events, last in the list', () => {
    for (const [region, stats] of Object.entries(countryStatsByRegion)) {
      const unknownEvents = findShowEvents.filter((e) => e.country === 'Unknown' && e.region === region);
      const bucket = stats.find((stat) => stat.country === 'Unknown');
      expect(bucket?.count ?? 0).toBe(unknownEvents.length);
      if (bucket) expect(stats[stats.length - 1]).toBe(bucket);
    }
  });

  it('keeps an Unknown entry, last, in every continent even at zero events', () => {
    for (const region of ['Americas', 'Europe', 'Africa & Middle East', 'Asia-Pacific'] as const) {
      const stats = countryStatsByRegion[region];
      expect(stats[stats.length - 1]).toMatchObject({ country: 'Unknown', isoCode: null });
      expect(stats.filter((stat) => stat.country === 'Unknown')).toHaveLength(1);
    }
    expect(countryStatsByRegion['All Regions']).toEqual([]);
  });

  it('resolves every seed record with a source, and seed locations with high confidence', () => {
    for (const seedRecord of findShowsSeed as FindShowSeedRecord[]) {
      const location = resolveRecordLocation(seedRecord);
      if (location.country === 'Unknown') {
        expect(location.confidence).toBe('none');
      } else {
        expect(location.source).not.toBe('none');
      }
      if (seedRecord.city.includes('(')) {
        expect(location).toMatchObject({ source: 'seed-location', confidence: 'high' });
      }
    }
  });

  it('reassigns the bulk of the location-less seed records', () => {
    const locationless = (findShowsSeed as FindShowSeedRecord[]).filter((r) => !r.city.includes('('));
    expect(locationless.length).toBeGreaterThan(0);
    const unknown = findShowEvents.filter((event) => event.country === 'Unknown').length;
    expect(unknown).toBeLessThan(locationless.length / 2);
  });
});
