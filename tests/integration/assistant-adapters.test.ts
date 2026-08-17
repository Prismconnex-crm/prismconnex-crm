import { describe, expect, it } from 'vitest';
import { peopleAdapter } from '@/lib/assistant/adapters/people';

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
