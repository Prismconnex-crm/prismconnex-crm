import { describe, expect, it } from 'vitest';
import { describeResults, filterEvents, normalize } from '@/lib/find-shows/filter-events';
import { findShowEvents } from '@/lib/find-shows/catalog';

describe('filterEvents', () => {
  it('finds trade shows in London, United Kingdom', () => {
    const { events, totalMatched } = filterEvents({
      city: 'London',
      country: 'United Kingdom',
    });

    expect(totalMatched).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.city.toLowerCase()).toContain('london');
      expect(event.country).toBe('United Kingdom');
    }
  });

  it('matches the catalog country normalisation ("UK - United Kingdom" -> "United Kingdom")', () => {
    const { totalMatched } = filterEvents({ country: 'United Kingdom' });
    expect(totalMatched).toBeGreaterThan(100);
  });

  it('caps results at the default limit but reports the true total', () => {
    const { events, totalMatched } = filterEvents({ country: 'Germany' });
    expect(events).toHaveLength(25);
    expect(totalMatched).toBeGreaterThan(25);
  });

  it('honours an explicit limit', () => {
    const { events } = filterEvents({ country: 'Germany', limit: 3 });
    expect(events).toHaveLength(3);
  });

  it('filters by category', () => {
    const { events, totalMatched } = filterEvents({ category: 'Packaging' });
    expect(totalMatched).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.primaryCategory).toBeTruthy();
    }
  });

  it('filters by month range', () => {
    const { events } = filterEvents({ monthFrom: 3, monthTo: 5, limit: 50 });
    for (const event of events) {
      const month = Number(event.startDate.slice(5, 7));
      expect(month).toBeGreaterThanOrEqual(3);
      expect(month).toBeLessThanOrEqual(5);
    }
  });

  it('handles a month range that wraps the new year', () => {
    const { events } = filterEvents({ monthFrom: 11, monthTo: 2, limit: 50 });
    for (const event of events) {
      const month = Number(event.startDate.slice(5, 7));
      expect([11, 12, 1, 2]).toContain(month);
    }
  });

  it('returns nothing for a city that does not exist', () => {
    const { events, totalMatched } = filterEvents({ city: 'Wakanda' });
    expect(totalMatched).toBe(0);
    expect(events).toHaveLength(0);
  });

  it('treats "All Categories" / "All Regions" as no filter', () => {
    const unfiltered = filterEvents({});
    const sentinel = filterEvents({ category: 'All Categories', region: 'All Regions' });
    expect(sentinel.totalMatched).toBe(unfiltered.totalMatched);
  });

  it('honours an explicit limit of 50', () => {
    const { events } = filterEvents({ country: 'France', limit: 50 });
    expect(events).toHaveLength(50);
  });

  it('clamps a limit above MAX_LIMIT down to 50', () => {
    // filterEvents is a pure function — the Zod max(50) only guards the route
    // boundary, so an oversized limit can reach here and must be clamped.
    const { events } = filterEvents({ country: 'France', limit: 999 });
    expect(events).toHaveLength(50);
  });

  it('offset slices a later page without overlapping the first', () => {
    const first = filterEvents({ country: 'France', limit: 10 });
    const second = filterEvents({ country: 'France', limit: 10, offset: 10 });

    expect(first.events).toHaveLength(10);
    expect(second.events).toHaveLength(10);

    const firstSlugs = new Set(first.events.map((event) => event.slug));
    for (const event of second.events) {
      expect(firstSlugs.has(event.slug)).toBe(false);
    }
  });

  it('reports the same totalMatched on every page of a filter set', () => {
    const first = filterEvents({ country: 'France', limit: 10 });
    const third = filterEvents({ country: 'France', limit: 10, offset: 20 });
    expect(third.totalMatched).toBe(first.totalMatched);
  });

  it('returns an empty page when offset runs past the end', () => {
    const { events, totalMatched } = filterEvents({
      country: 'France',
      offset: 100000,
    });
    expect(events).toHaveLength(0);
    expect(totalMatched).toBeGreaterThan(0);
  });

  it('finds every trade show in France when no category is set', () => {
    // Derived from the catalog rather than pinned: the total changes with every
    // import (the Aug 2026 - Jul 2027 refresh moved it from 1,306 to 1,385), and
    // a hardcoded number only ever produces a false failure. What matters is
    // that dropping the category filter matches the whole country.
    const expected = findShowEvents.filter((event) => event.country === 'France').length;
    const { totalMatched } = filterEvents({ country: 'France', category: null });
    expect(totalMatched).toBe(expected);
    expect(totalMatched).toBeGreaterThan(0);
  });

  it('exposes the seed logo url on each result', () => {
    const { events } = filterEvents({ country: 'France', limit: 5 });
    for (const event of events) {
      expect(event).toHaveProperty('logoUrl');
    }
  });
});

describe('normalize', () => {
  it('strips accents so "Munchen" matches "München"', () => {
    expect(normalize('München')).toBe('munchen');
    expect(normalize('  Köln ')).toBe('koln');
  });
});

describe('describeResults', () => {
  it('reports an empty result set', () => {
    expect(describeResults({ city: 'Wakanda' }, 0, 0)).toContain('No trade shows found');
  });

  it('names the location and notes truncation', () => {
    const sentence = describeResults({ city: 'London', country: 'United Kingdom' }, 40, 12);
    expect(sentence).toContain('Found 40 trade shows');
    expect(sentence).toContain('London, United Kingdom');
    expect(sentence).toContain('Showing the first 12');
  });

  it('uses the singular for exactly one match', () => {
    expect(describeResults({}, 1, 1)).toContain('1 trade show.');
  });
});
