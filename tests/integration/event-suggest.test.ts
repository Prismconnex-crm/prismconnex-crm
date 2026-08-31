import { describe, expect, it } from 'vitest';
import { suggestEvents, SUGGESTION_LIMIT } from '@/lib/events/suggest';
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
    description: 'A sample trade show used by the suggestion tests.',
    seedCity: 'Berlin',
    monthYear: 'March 2026',
    duration: '3 days',
    searchText: '',
    seedAsset: { eventseyeUrl: null, bannerUrl: null, logoUrl: null },
  };

  const merged = { ...base, ...overrides };
  merged.searchText = [merged.name, merged.city, merged.country, merged.venue, merged.organizer]
    .join(' ')
    .toLowerCase();
  return merged;
}

const events: FindShowEvent[] = [
  makeEvent({ slug: 'bett-show', name: 'BETT Show', city: 'London', country: 'United Kingdom' }),
  makeEvent({ slug: 'bett-asia', name: 'BETT Asia', city: 'Bangkok', country: 'Thailand' }),
  makeEvent({ slug: 'educar', name: 'Educar Brazil at BETT', city: 'Sao Paulo', country: 'Brazil' }),
  // No "b" anywhere in this one's searched fields — it is the control row.
  makeEvent({
    slug: 'plastics-tokyo',
    name: 'Plastics Tokyo',
    city: 'Tokyo',
    country: 'Japan',
    venue: 'Tokyo Int Forum',
    organizer: 'JMA',
  }),
];

describe('suggestEvents', () => {
  it('returns nothing for an empty or blank query', () => {
    expect(suggestEvents(events, '')).toEqual([]);
    expect(suggestEvents(events, '   ')).toEqual([]);
  });

  it('answers a single letter with the events named for it', () => {
    // The whole point of the composer typeahead: one keystroke, real rows.
    expect(suggestEvents(events, 'b').map((event) => event.slug)).toEqual([
      'bett-show',
      'bett-asia',
      'educar',
    ]);
  });

  it('ranks a name prefix above a later-word name match', () => {
    expect(suggestEvents(events, 'bett').map((event) => event.slug)).toEqual([
      'bett-show',
      'bett-asia',
      'educar',
    ]);
  });

  it('narrows as more of the name is typed', () => {
    expect(suggestEvents(events, 'bett as').map((event) => event.slug)).toEqual(['bett-asia']);
  });

  it('caps the list', () => {
    const many = Array.from({ length: SUGGESTION_LIMIT + 5 }, (_, index) =>
      makeEvent({ slug: `show-${index}`, name: `Bravo Show ${index}` })
    );
    expect(suggestEvents(many, 'bravo')).toHaveLength(SUGGESTION_LIMIT);
    expect(suggestEvents(many, 'bravo', 3)).toHaveLength(3);
  });

  it('does not match mid-word', () => {
    expect(suggestEvents(events, 'okyo')).toEqual([]);
  });
});
