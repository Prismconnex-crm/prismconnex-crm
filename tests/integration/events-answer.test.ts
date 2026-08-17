import { describe, expect, it } from 'vitest';
import { buildEventAnswer } from '@/lib/events/answer';
import { emptyEventFilters, type EventFilters } from '@/types/events';
import type { FindShowEvent } from '@/types/find-shows';

function event(overrides: Partial<FindShowEvent> = {}): FindShowEvent {
  return {
    slug: 's1',
    name: 'ANALYTICA',
    dates: '24 - 27 Mar 2026',
    city: 'Munich',
    country: 'Germany',
    region: 'Europe',
    venue: 'Messe München',
    organizer: 'Messe München GmbH',
    frequency: 'Biennial',
    website: 'http://analytica.de',
    email: '',
    rawCategories: ['Laboratory'],
    categories: ['Medical & Healthcare'],
    primaryCategory: 'Medical & Healthcare',
    startDate: '2026-03-24',
    endDate: '2026-03-27',
    startMonth: '2026-03',
    endMonth: '2026-03',
    displayDate: '24 - 27 Mar 2026',
    searchText: 'analytica munich',
    seedAsset: { eventseyeUrl: null, bannerUrl: null, logoUrl: null },
    ...overrides,
  } as FindShowEvent;
}

const state = (overrides: Partial<EventFilters> = {}, search = '') => ({
  filters: { ...emptyEventFilters(), ...overrides },
  search,
});

describe('buildEventAnswer', () => {
  it('reports the real total', () => {
    const text = buildEventAnswer({
      question: 'shows in Munich',
      state: state({ cities: ['Munich'] }),
      matches: [event()],
      total: 62,
    });
    expect(text).toContain('62');
  });

  it('singularises one match', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state(),
      matches: [event()],
      total: 1,
    });
    expect(text).toMatch(/1 trade show\b/);
    expect(text).not.toContain('1 trade shows');
  });

  it('names the places being filtered on', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state({ cities: ['Munich'], countries: ['Germany'] }),
      matches: [event()],
      total: 5,
    });
    expect(text).toContain('Munich');
    expect(text).toContain('Germany');
  });

  it('mentions the date range when one is set', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state({ dateFrom: '2026-03-01', dateTo: '2026-05-31' }),
      matches: [event()],
      total: 9,
    });
    expect(text).toMatch(/2026/);
  });

  it('summarises the dominant categories from the matched rows', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state(),
      matches: [
        event({ primaryCategory: 'Medical & Healthcare' }),
        event({ slug: 's2', primaryCategory: 'Medical & Healthcare' }),
        event({ slug: 's3', primaryCategory: 'Packaging' }),
      ],
      total: 3,
    });
    expect(text).toContain('Medical & Healthcare');
  });

  it('explains an empty result instead of reporting zero rows', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state({ cities: ['Nowhere'] }),
      matches: [],
      total: 0,
    });
    expect(text).toMatch(/no trade shows/i);
    expect(text.length).toBeGreaterThan(20);
  });

  it('never emits a bare 0 for a non-empty result', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state(),
      matches: [event()],
      total: 7,
    });
    expect(text).not.toMatch(/\b0\b/);
  });
});
