import { describe, expect, it } from 'vitest';
import { peopleAdapter } from '@/lib/assistant/adapters/people';
import { eventsAdapter } from '@/lib/assistant/adapters/events';
import { createCompaniesAdapter } from '@/lib/assistant/adapters/companies';
import type { EntityAdapter } from '@/lib/assistant/types';

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

describe('companiesAdapter', () => {
  const fakeRows = Array.from({ length: 11 }, (_, i) => ({
    rowCursor: 100 - i,
    id: `c${i}`,
    name: `Acme ${i}`,
    category: 'SaaS',
    tags: 'saas',
  }));
  const adapter = createCompaniesAdapter(async () => fakeRows as never);

  it('always reports a null total — counting is too slow to do per request', async () => {
    const result = await adapter.search(adapter.emptyFilters(), 1);
    expect(result.total).toBeNull();
  });

  it('never renders "0" when the total is null', () => {
    const prose = adapter.describe({ ...adapter.emptyFilters(), country: 'Germany' }, null);
    expect(prose).not.toMatch(/\b0\b/);
    expect(prose.length).toBeGreaterThan(0);
  });

  it('puts a plain query into the prefix search field', () => {
    const filters = adapter.parseLocally('Infosys', adapter.emptyFilters());
    expect(filters.search).toBe('Infosys');
  });

  it('carries country and industry over, dropping event-only filters', () => {
    const { filters, dropped } = adapter.carryOver({
      country: 'Germany',
      industry: 'SaaS',
      venue: 'Messe Berlin',
    });
    expect(filters.country).toBe('Germany');
    expect(filters.category).toBe('SaaS');
    expect(dropped).toContain('venue');
  });

  it('returns company rows, never people', async () => {
    const result = await adapter.search(adapter.emptyFilters(), 1);
    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row).not.toHaveProperty('firstName');
      expect(row).toHaveProperty('name');
    }
  });

  it('produces chips for the applied filters', () => {
    const chips = adapter.chips({ ...adapter.emptyFilters(), country: 'Germany' });
    expect(chips).toHaveLength(1);
    expect(chips[0].value).toBe('Germany');
  });
});

describe('EntityAdapter contract', () => {
  const adapters: Array<[string, EntityAdapter<never>]> = [
    ['people', peopleAdapter as unknown as EntityAdapter<never>],
    ['events', eventsAdapter as unknown as EntityAdapter<never>],
    ['companies', createCompaniesAdapter(async () => []) as unknown as EntityAdapter<never>],
  ];

  it.each(adapters)('%s declares its own entity and signals', (name, adapter) => {
    expect(adapter.entity).toBe(name);
    expect(adapter.signals.length).toBeGreaterThan(0);
  });

  it.each(adapters)('%s exposes an object filterSchema with properties', (_name, adapter) => {
    expect(adapter.filterSchema.type).toBe('object');
    expect(Object.keys(adapter.filterSchema.properties as object).length).toBeGreaterThan(0);
  });

  it.each(adapters)('%s round-trips empty filters through parseLocally', (_name, adapter) => {
    const parsed = adapter.parseLocally('anything', adapter.emptyFilters());
    expect(parsed).toBeTypeOf('object');
    expect(parsed).not.toBeNull();
  });

  it.each(adapters)('%s returns a number-or-null total', async (_name, adapter) => {
    const { total } = await adapter.search(adapter.emptyFilters(), 1);
    expect(total === null || typeof total === 'number').toBe(true);
  });

  it.each(adapters)('%s never renders a bare 0 when total is null', (_name, adapter) => {
    const prose = adapter.describe(adapter.emptyFilters(), null);
    expect(prose.length).toBeGreaterThan(0);
    expect(prose).not.toMatch(/\b0\b/);
  });

  it.each(adapters)('%s always suggests at least one follow-up', (_name, adapter) => {
    expect(adapter.suggest(adapter.emptyFilters(), null).length).toBeGreaterThan(0);
  });

  it.each(adapters)('%s returns chips shaped {key,label,value}', (_name, adapter) => {
    for (const chip of adapter.chips(adapter.emptyFilters())) {
      expect(typeof chip.key).toBe('string');
      expect(typeof chip.label).toBe('string');
      expect(typeof chip.value).toBe('string');
    }
  });
});
