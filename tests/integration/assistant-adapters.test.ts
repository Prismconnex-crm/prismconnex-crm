import { describe, expect, it } from 'vitest';
import { peopleAdapter } from '@/lib/assistant/adapters/people';
import { eventsAdapter } from '@/lib/assistant/adapters/events';

describe('peopleAdapter', () => {
  it('parses a question into filters', () => {
    const filters = peopleAdapter.parseLocally(
      'verified marketing managers in Germany',
      peopleAdapter.emptyFilters()
    );
    expect(filters.countries).toEqual(['Germany']);
    expect(filters.verification).toBe('verified');
  });

  it('searches and returns a real numeric total', async () => {
    const filters = peopleAdapter.parseLocally('people in Germany', peopleAdapter.emptyFilters());
    const result = await peopleAdapter.search(filters, 1);
    expect(typeof result.total).toBe('number');
    expect(result.rows.length).toBeLessThanOrEqual(10);
  });

  it('pages without overlapping', async () => {
    const empty = peopleAdapter.emptyFilters();
    const first = await peopleAdapter.search(empty, 1);
    const second = await peopleAdapter.search(empty, 2);
    const firstIds = first.rows.map((r) => (r as { id: string }).id);
    const secondIds = second.rows.map((r) => (r as { id: string }).id);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it('carries country over from another entity and drops what it cannot map', () => {
    const { filters, dropped } = peopleAdapter.carryOver({
      country: 'Germany',
      venue: 'Messe Berlin',
    });
    expect(filters.countries).toEqual(['Germany']);
    expect(dropped).toContain('venue');
  });

  it('produces chips and non-empty prose', () => {
    const filters = peopleAdapter.parseLocally('CEOs in France', peopleAdapter.emptyFilters());
    expect(peopleAdapter.chips(filters).length).toBeGreaterThan(0);
    expect(peopleAdapter.describe(filters, 12).length).toBeGreaterThan(0);
  });

  it('suggests follow-ups', () => {
    expect(peopleAdapter.suggest(peopleAdapter.emptyFilters(), 40).length).toBeGreaterThan(0);
  });
});

describe('eventsAdapter', () => {
  it('extracts a keyword from a question', () => {
    const filters = eventsAdapter.parseLocally(
      'trade shows in Munich',
      eventsAdapter.emptyFilters()
    );
    expect(filters.keyword ?? filters.city).toBeTruthy();
  });

  it('searches and returns a numeric total', async () => {
    const result = await eventsAdapter.search(
      { ...eventsAdapter.emptyFilters(), country: 'Germany' },
      1
    );
    expect(typeof result.total).toBe('number');
    expect(result.rows.length).toBeLessThanOrEqual(10);
  });

  it('pages via offset', async () => {
    const empty = eventsAdapter.emptyFilters();
    const first = await eventsAdapter.search(empty, 1);
    const second = await eventsAdapter.search(empty, 2);
    const firstSlugs = first.rows.map((r) => (r as { slug: string }).slug);
    const secondSlugs = second.rows.map((r) => (r as { slug: string }).slug);
    expect(firstSlugs.some((s) => secondSlugs.includes(s))).toBe(false);
  });

  it('carries country over and drops people-only filters', () => {
    const { filters, dropped } = eventsAdapter.carryOver({
      country: 'Germany',
      verification: 'verified',
    });
    expect(filters.country).toBe('Germany');
    expect(dropped).toContain('verification');
  });

  it('never returns a Person-shaped row', async () => {
    const result = await eventsAdapter.search(eventsAdapter.emptyFilters(), 1);
    for (const row of result.rows) {
      expect(row).not.toHaveProperty('firstName');
      expect(row).toHaveProperty('slug');
    }
  });

  it('produces chips and prose', () => {
    const filters = { ...eventsAdapter.emptyFilters(), city: 'Munich' };
    expect(eventsAdapter.chips(filters).length).toBeGreaterThan(0);
    expect(eventsAdapter.describe(filters, 5).length).toBeGreaterThan(0);
  });
});
