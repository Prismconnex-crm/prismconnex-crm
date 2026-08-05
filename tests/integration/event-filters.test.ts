import { describe, expect, it } from 'vitest';
import {
  computeEventFacets,
  dateRangeForPreset,
  filterEventList,
  matchDatePreset,
  parseEventQueryState,
  serializeEventQueryState,
} from '@/lib/events/filters';
import { buildEventFilterChips, removeEventFilterChip } from '@/lib/events/chips';
import { emptyEventFilters, type EventFilters } from '@/types/events';
import type { FindShowEvent } from '@/types/find-shows';

function makeEvent(overrides: Partial<FindShowEvent> & { slug: string }): FindShowEvent {
  const base: FindShowEvent = {
    slug: overrides.slug,
    name: 'Sample Show',
    dates: 'Mar 1 - 3, 2026',
    city: 'Berlin',
    country: 'Germany',
    region: 'Europe',
    venue: 'Messe Berlin',
    organizer: 'Messe Frankfurt',
    frequency: 'Annual',
    website: 'https://example.com',
    email: 'info@example.com',
    rawCategories: ['plastics'],
    categories: ['Plastics & Rubber'],
    primaryCategory: 'Plastics & Rubber',
    startDate: '2026-03-01',
    endDate: '2026-03-03',
    startMonth: '2026-03',
    endMonth: '2026-03',
    displayDate: '01 - 03 Mar 2026',
    searchText: '',
    seedAsset: { eventseyeUrl: null, bannerUrl: null, logoUrl: null },
  };

  const merged = { ...base, ...overrides };
  // Mirrors how the catalog builds searchText, so keyword tests stay honest.
  merged.searchText = [
    merged.name,
    merged.city,
    merged.country,
    merged.venue,
    merged.organizer,
    ...merged.categories,
  ]
    .join(' ')
    .toLowerCase();
  return merged;
}

const events: FindShowEvent[] = [
  makeEvent({ slug: 'plastics-berlin', name: 'Plastics Berlin' }),
  makeEvent({
    slug: 'build-london',
    name: 'BuildEx London',
    city: 'London',
    country: 'United Kingdom',
    categories: ['Construction & Building'],
    primaryCategory: 'Construction & Building',
    organizer: 'Informa',
    startDate: '2026-09-10',
    endDate: '2026-09-12',
  }),
  makeEvent({
    slug: 'plastics-tokyo',
    name: 'Plastics Tokyo',
    city: 'Tokyo',
    country: 'Japan',
    region: 'Asia-Pacific',
    organizer: 'JMA',
    startDate: '2026-06-02',
    endDate: '2026-06-04',
  }),
];

const noFavourites = new Set<string>();

function withFilters(overrides: Partial<EventFilters>): EventFilters {
  return { ...emptyEventFilters(), ...overrides };
}

describe('event query URL state', () => {
  it('round-trips every filter through the query string', () => {
    const state = {
      filters: withFilters({
        regions: ['Europe'],
        countries: ['Germany', 'United Kingdom'],
        cities: ['Berlin'],
        categories: ['Plastics & Rubber'],
        organizers: ['Messe Frankfurt'],
        keywords: ['robotics'],
        dateFrom: '2026-01-01',
        dateTo: '2026-03-31',
        favouritesOnly: true,
      }),
      search: 'packaging',
    };

    expect(parseEventQueryState(serializeEventQueryState(state))).toEqual(state);
  });

  it('serialises an untouched state to an empty string', () => {
    expect(serializeEventQueryState({ filters: emptyEventFilters(), search: '' })).toBe('');
  });

  it('ignores malformed dates rather than filtering on them', () => {
    const { filters } = parseEventQueryState('?from=march&to=2026-13-99');
    expect(filters.dateFrom).toBeNull();
    expect(filters.dateTo).toBeNull();
  });
});

describe('filterEventList', () => {
  it('returns everything when nothing is applied', () => {
    expect(filterEventList(events, emptyEventFilters(), '', noFavourites)).toHaveLength(3);
  });

  it('ORs within a dimension and ANDs across dimensions', () => {
    const bothRegions = filterEventList(
      events,
      withFilters({ regions: ['Europe', 'Asia-Pacific'] }),
      '',
      noFavourites
    );
    expect(bothRegions).toHaveLength(3);

    const narrowed = filterEventList(
      events,
      withFilters({ regions: ['Europe'], categories: ['Plastics & Rubber'] }),
      '',
      noFavourites
    );
    expect(narrowed.map((event) => event.slug)).toEqual(['plastics-berlin']);
  });

  it('matches country and city loosely but region exactly', () => {
    expect(
      filterEventList(events, withFilters({ countries: ['united kingdom'] }), '', noFavourites)
    ).toHaveLength(1);
    expect(
      filterEventList(events, withFilters({ regions: ['europe'] }), '', noFavourites)
    ).toHaveLength(0);
  });

  it('ANDs keywords so each term must appear', () => {
    expect(
      filterEventList(events, withFilters({ keywords: ['plastics'] }), '', noFavourites)
    ).toHaveLength(2);
    expect(
      filterEventList(events, withFilters({ keywords: ['plastics', 'tokyo'] }), '', noFavourites)
    ).toHaveLength(1);
  });

  it('keeps events whose run overlaps the date window', () => {
    const overlapping = filterEventList(
      events,
      withFilters({ dateFrom: '2026-03-03', dateTo: '2026-06-02' }),
      '',
      noFavourites
    );
    expect(overlapping.map((event) => event.slug)).toEqual(['plastics-berlin', 'plastics-tokyo']);
  });

  it('restricts to favourites only when asked', () => {
    const favourites = new Set(['plastics-tokyo']);
    expect(
      filterEventList(events, withFilters({ favouritesOnly: true }), '', favourites).map(
        (event) => event.slug
      )
    ).toEqual(['plastics-tokyo']);
  });

  it('applies the free-text box against the searchable blob', () => {
    expect(filterEventList(events, emptyEventFilters(), 'informa', noFavourites)).toHaveLength(1);
  });
});

describe('computeEventFacets', () => {
  it('counts a dimension as if its own selection were cleared', () => {
    const facets = computeEventFacets(
      events,
      withFilters({ regions: ['Europe'] }),
      '',
      noFavourites
    );

    // Region counts ignore the region filter, so Asia-Pacific is still offered.
    expect(facets.regions).toEqual([
      { value: 'Europe', count: 2 },
      { value: 'Asia-Pacific', count: 1 },
    ]);
    // Country counts DO respect the region filter.
    expect(facets.countries.map((option) => option.value).sort()).toEqual([
      'Germany',
      'United Kingdom',
    ]);
  });

  it('drops placeholder organizers', () => {
    const facets = computeEventFacets(
      [makeEvent({ slug: 'unknown-organizer', organizer: '?' })],
      emptyEventFilters(),
      '',
      noFavourites
    );
    expect(facets.organizers).toEqual([]);
  });
});

describe('date presets', () => {
  it('builds a this-year range and recognises it again', () => {
    const today = new Date('2026-08-01T00:00:00Z');
    const range = dateRangeForPreset('this-year', today);
    expect(range).toEqual({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    expect(matchDatePreset(withFilters(range), today)).toBe('this-year');
  });

  it('builds a rolling 30-day window from today', () => {
    const today = new Date('2026-08-01T00:00:00Z');
    expect(dateRangeForPreset('next-30-days', today)).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
  });

  it('reports no preset for a hand-picked range', () => {
    expect(matchDatePreset(withFilters({ dateFrom: '2026-02-03', dateTo: '2026-04-09' }))).toBeNull();
  });
});

describe('filter chips', () => {
  const filters = withFilters({
    regions: ['Europe'],
    countries: ['Germany'],
    dateFrom: '2026-01-01',
    dateTo: '2026-03-31',
    favouritesOnly: true,
  });

  it('describes every applied constraint including the search box', () => {
    const chips = buildEventFilterChips(filters, 'packaging');
    expect(chips.map((chip) => `${chip.label}: ${chip.value}`)).toEqual([
      'Search: packaging',
      'Region: Europe',
      'Country: Germany',
      'Dates: 01 Jan 2026 – 31 Mar 2026',
      'Only: Liked events',
    ]);
  });

  it('removes exactly one constraint per chip', () => {
    expect(removeEventFilterChip(filters, 'packaging', 'regions:Europe').filters.regions).toEqual([]);
    expect(removeEventFilterChip(filters, 'packaging', 'search').search).toBe('');

    const withoutDates = removeEventFilterChip(filters, '', 'dates').filters;
    expect(withoutDates.dateFrom).toBeNull();
    expect(withoutDates.dateTo).toBeNull();
    // Everything else survives.
    expect(withoutDates.regions).toEqual(['Europe']);
  });

  it('leaves state untouched for an unknown chip id', () => {
    expect(removeEventFilterChip(filters, '', 'bogus').filters).toEqual(filters);
  });
});
