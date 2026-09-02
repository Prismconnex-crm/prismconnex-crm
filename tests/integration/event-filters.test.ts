import { describe, expect, it } from 'vitest';
import {
  calendarRange,
  computeCalendarFacets,
  computeEventFacets,
  dateRangeForPreset,
  filterEventList,
  formatCalendarSelection,
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
    // Added by the eventseye calendar import: the catalog now carries a
    // description, the seed's raw city, a Month-Year label and a duration.
    description: 'A sample trade show used by the filter tests.',
    seedCity: 'Berlin',
    monthYear: 'March 2026',
    duration: '3 days',
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
        month: 3,
        year: 2026,
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

  it('matches a single letter as a word prefix, not a substring', () => {
    // Every fixture sits in "Messe Berlin", so "b" legitimately reaches all
    // three through the venue. "l" is the discriminating letter: only BuildEx
    // London has a word starting with it. The old blob substring matched all
    // three on the "l" inside "Plastics".
    expect(
      filterEventList(events, emptyEventFilters(), 'l', noFavourites).map((e) => e.slug)
    ).toEqual(['build-london']);
  });

  it('does not match mid-word', () => {
    // "lastics" is inside "Plastics" but starts no word, so nothing matches.
    expect(filterEventList(events, emptyEventFilters(), 'lastics', noFavourites)).toEqual([]);
  });

  it('finds an event from the first letters of its name', () => {
    expect(
      filterEventList(events, emptyEventFilters(), 'buil', noFavourites).map((e) => e.slug)
    ).toEqual(['build-london']);
  });

  it('ANDs terms across fields, so a full name still matches', () => {
    expect(
      filterEventList(events, emptyEventFilters(), 'buildex london', noFavourites).map((e) => e.slug)
    ).toEqual(['build-london']);
    expect(filterEventList(events, emptyEventFilters(), 'buildex tokyo', noFavourites)).toEqual([]);
  });

  it('matches a word that starts later in the name', () => {
    expect(
      filterEventList(events, emptyEventFilters(), 'tokyo', noFavourites).map((e) => e.slug)
    ).toEqual(['plastics-tokyo']);
  });

  it('ranks name matches above location-only matches', () => {
    // All three sit in "Messe Berlin", so all three match "b". BuildEx starts
    // with it (rank 0), Plastics Berlin has it on a later name word (rank 1),
    // and Plastics Tokyo reaches it only through the venue (rank 2).
    expect(
      filterEventList(events, emptyEventFilters(), 'b', noFavourites).map((e) => e.slug)
    ).toEqual(['build-london', 'plastics-berlin', 'plastics-tokyo']);
  });

  it('puts an exact name prefix ahead of a later-word name match', () => {
    expect(
      filterEventList(events, emptyEventFilters(), 'p', noFavourites).map((e) => e.slug)
    ).toEqual(['plastics-berlin', 'plastics-tokyo']);
  });

  it('leaves catalog order alone when the box is empty', () => {
    expect(filterEventList(events, emptyEventFilters(), '', noFavourites).map((e) => e.slug)).toEqual(
      ['plastics-berlin', 'build-london', 'plastics-tokyo']
    );
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

describe('calendar filter (month + year)', () => {
  // A show that runs across a year boundary, to pin the overlap rules.
  const newYearShow = makeEvent({
    slug: 'new-year-expo',
    name: 'New Year Expo',
    startDate: '2026-12-29',
    endDate: '2027-01-03',
    startMonth: '2026-12',
    endMonth: '2027-01',
  });
  const nextJanuary = makeEvent({
    slug: 'january-2027',
    name: 'January Show',
    startDate: '2027-01-20',
    endDate: '2027-01-22',
    startMonth: '2027-01',
    endMonth: '2027-01',
  });
  const calendarEvents = [...events, newYearShow, nextJanuary];

  it('bounds a month, including February in a leap year', () => {
    expect(calendarRange(2026, 3)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(calendarRange(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(calendarRange(2026, null)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('filters to one month of one year', () => {
    expect(
      filterEventList(calendarEvents, withFilters({ month: 1, year: 2027 }), '', noFavourites).map(
        (event) => event.slug
      )
    ).toEqual(['new-year-expo', 'january-2027']);
  });

  it('treats a month without a year as that month in every year', () => {
    expect(
      filterEventList(calendarEvents, withFilters({ month: 3 }), '', noFavourites).map(
        (event) => event.slug
      )
    ).toEqual(['plastics-berlin']);
  });

  it('treats a year without a month as the whole year', () => {
    expect(
      filterEventList(calendarEvents, withFilters({ year: 2027 }), '', noFavourites).map(
        (event) => event.slug
      )
    ).toEqual(['new-year-expo', 'january-2027']);
  });

  it('narrows alongside the date range rather than replacing it', () => {
    // September 2026 is inside the range, so the month is what excludes the
    // other two events — proof the two dimensions are AND-ed.
    expect(
      filterEventList(
        calendarEvents,
        withFilters({ month: 9, dateFrom: '2026-01-01', dateTo: '2026-12-31' }),
        '',
        noFavourites
      ).map((event) => event.slug)
    ).toEqual(['build-london']);
  });

  it('ignores an out-of-range month or year from the URL', () => {
    const parsed = parseEventQueryState('?month=13&year=99');
    expect(parsed.filters.month).toBeNull();
    expect(parsed.filters.year).toBeNull();
  });

  it('counts every month, and counts years under the chosen month', () => {
    const facets = computeCalendarFacets(
      calendarEvents,
      withFilters({ month: 1 }),
      '',
      noFavourites
    );

    // Months are always twelve rows so the dropdown never reshuffles.
    expect(facets.months).toHaveLength(12);
    const byMonth = Object.fromEntries(facets.months.map((m) => [m.month, m.count]));
    expect(byMonth[1]).toBe(2); // both January shows, counted once each
    expect(byMonth[3]).toBe(1);
    expect(byMonth[11]).toBe(0);

    // With January picked, the year list answers "how many Januaries per year".
    expect(facets.years).toEqual([{ year: 2027, count: 2 }]);
  });

  it('counts months within the chosen year', () => {
    const facets = computeCalendarFacets(
      calendarEvents,
      withFilters({ year: 2026 }),
      '',
      noFavourites
    );
    const byMonth = Object.fromEntries(facets.months.map((m) => [m.month, m.count]));
    expect(byMonth[12]).toBe(1); // the cross-year show, on its 2026 side only
    expect(byMonth[1]).toBe(0);
  });

  it('describes the selection for the rail and the chips', () => {
    expect(formatCalendarSelection(1, 2026)).toBe('January 2026');
    expect(formatCalendarSelection(1, null)).toBe('January');
    expect(formatCalendarSelection(null, 2026)).toBe('2026');
    expect(formatCalendarSelection(null, null)).toBe('');
  });
});

describe('filter chips', () => {
  const filters = withFilters({
    regions: ['Europe'],
    countries: ['Germany'],
    dateFrom: '2026-01-01',
    dateTo: '2026-03-31',
    month: 1,
    year: 2026,
    favouritesOnly: true,
  });

  it('describes every applied constraint including the search box', () => {
    const chips = buildEventFilterChips(filters, 'packaging');
    expect(chips.map((chip) => `${chip.label}: ${chip.value}`)).toEqual([
      'Search: packaging',
      'Region: Europe',
      'Country: Germany',
      'Dates: 01 Jan 2026 – 31 Mar 2026',
      'Month: January 2026',
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

    const withoutCalendar = removeEventFilterChip(filters, '', 'calendar').filters;
    expect(withoutCalendar.month).toBeNull();
    expect(withoutCalendar.year).toBeNull();
    expect(withoutCalendar.dateFrom).toBe('2026-01-01');
  });

  it('leaves state untouched for an unknown chip id', () => {
    expect(removeEventFilterChip(filters, '', 'bogus').filters).toEqual(filters);
  });
});
