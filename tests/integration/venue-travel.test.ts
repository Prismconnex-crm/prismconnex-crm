import { describe, expect, it } from 'vitest';
import { findShowEvents } from '../../lib/find-shows/catalog';
import { VENUE_TRAVEL_GUIDES } from '../../lib/find-shows/venue-travel-data';
import {
  getVenueTravelGuide,
  mapDirectionsUrl,
  mapPlaceUrl,
  placeQuery,
} from '../../lib/find-shows/venue-travel';

describe('getVenueTravelGuide', () => {
  it('finds the guide from the event’s own venue, city and country code', () => {
    expect(
      getVenueTravelGuide({ venue: 'Melbourne Exhibition & Convention Centre', city: 'Melbourne', countryCode: 'AU' })?.id
    ).toBe('au-melbourne-mcec');
    // Case, "&"/"and" and punctuation do not matter.
    expect(
      getVenueTravelGuide({ venue: 'melbourne convention and exhibition centre', city: 'MELBOURNE', countryCode: 'au' })?.id
    ).toBe('au-melbourne-mcec');
    expect(getVenueTravelGuide({ venue: 'ExCeL', city: 'London', countryCode: 'GB' })?.id).toBe('gb-london-excel');
  });

  it('returns null rather than a near miss', () => {
    // Same venue name, different city or country.
    expect(getVenueTravelGuide({ venue: 'ExCeL', city: 'Manchester', countryCode: 'GB' })).toBeNull();
    expect(getVenueTravelGuide({ venue: 'ExCeL', city: 'London', countryCode: 'CA' })).toBeNull();
    // No verified guide, or no location at all.
    expect(getVenueTravelGuide({ venue: 'Paris Expo Porte de Versailles', city: 'Paris', countryCode: 'FR' })).toBeNull();
    expect(getVenueTravelGuide({ venue: 'Venue to be announced', city: '', countryCode: null })).toBeNull();
  });

  it('attaches each guide to the catalog events held at that venue', () => {
    const mcec = findShowEvents.filter((event) => getVenueTravelGuide(event)?.id === 'au-melbourne-mcec');
    const excel = findShowEvents.filter((event) => getVenueTravelGuide(event)?.id === 'gb-london-excel');
    expect(mcec.length).toBeGreaterThan(0);
    expect(excel.length).toBeGreaterThan(0);
    expect(mcec.every((event) => event.venue === 'Melbourne Exhibition & Convention Centre')).toBe(true);
    expect(excel.every((event) => event.country === 'United Kingdom' && event.city === 'London')).toBe(true);
    // Other Melbourne venues are not given MCEC's guide.
    expect(
      findShowEvents.some((event) => event.city === 'Melbourne' && event.venue === 'Melbourne Showgrounds' && getVenueTravelGuide(event))
    ).toBe(false);
  });
});

describe('map links', () => {
  it('searches for the specific place: name plus address, or the locality hint', () => {
    expect(placeQuery({ name: 'Pan Pacific Melbourne', address: '2 Convention Centre Place, South Wharf VIC 3006, Australia' })).toBe(
      'Pan Pacific Melbourne, 2 Convention Centre Place, South Wharf VIC 3006, Australia'
    );
    expect(placeQuery({ name: 'Southern Cross Station', mapHint: 'Melbourne VIC, Australia' })).toBe(
      'Southern Cross Station, Melbourne VIC, Australia'
    );
    expect(mapPlaceUrl({ name: 'A & B', address: 'X' })).toBe('https://www.google.com/maps/search/?api=1&query=A%20%26%20B%2C%20X');
  });

  it('builds directions from one specific place to another', () => {
    const url = new URL(mapDirectionsUrl({ name: 'Venue', address: '1 A St' }, { name: 'Hotel', address: '2 B St' }));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('origin')).toBe('Venue, 1 A St');
    expect(url.searchParams.get('destination')).toBe('Hotel, 2 B St');
  });
});

describe('venue travel data', () => {
  const sourcesOf = (guide: (typeof VENUE_TRAVEL_GUIDES)[number]) => [
    ...guide.airports.flatMap((item) => item.sources),
    ...guide.buses.flatMap((item) => item.sources),
    ...guide.publicTransport.flatMap((item) => item.sources),
    ...(guide.taxi?.sources ?? []),
    ...guide.hotels.flatMap((item) => item.sources),
  ];

  it('has unique ids and never two guides for the same venue key', () => {
    expect(new Set(VENUE_TRAVEL_GUIDES.map((guide) => guide.id)).size).toBe(VENUE_TRAVEL_GUIDES.length);
    for (const guide of VENUE_TRAVEL_GUIDES) {
      for (const venueName of guide.match.venueNames) {
        expect(getVenueTravelGuide({ venue: venueName, city: guide.match.city, countryCode: guide.match.countryCode })?.id).toBe(
          guide.id
        );
      }
    }
  });

  it('cites an https source for every item, and every item of a list', () => {
    for (const guide of VENUE_TRAVEL_GUIDES) {
      const items = [...guide.airports, ...guide.buses, ...guide.publicTransport, ...guide.hotels];
      for (const item of items) expect(item.sources.length, guide.id).toBeGreaterThan(0);
      if (guide.taxi) expect(guide.taxi.sources.length).toBeGreaterThan(0);
      for (const source of sourcesOf(guide)) {
        expect(source.url.startsWith('https://'), source.url).toBe(true);
        expect(source.label.trim()).not.toBe('');
      }
    }
  });

  it('only uses 3-5 star ratings and bus stops of mode "bus"', () => {
    for (const guide of VENUE_TRAVEL_GUIDES) {
      for (const hotel of guide.hotels) if (hotel.stars) expect([3, 4, 5]).toContain(hotel.stars);
      for (const stop of guide.buses) expect(stop.mode).toBe('bus');
      for (const stop of guide.publicTransport) expect(stop.mode).not.toBe('bus');
    }
  });

  it('matches at least one catalog event per guide, so a typo cannot hide a guide', () => {
    for (const guide of VENUE_TRAVEL_GUIDES) {
      expect(findShowEvents.some((event) => getVenueTravelGuide(event)?.id === guide.id), guide.id).toBe(true);
    }
  });
});
