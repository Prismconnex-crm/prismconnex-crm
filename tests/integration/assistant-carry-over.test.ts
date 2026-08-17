import { describe, expect, it } from 'vitest';
import { translateFilters } from '@/lib/assistant/carry-over';
import { adapterFor } from '@/lib/assistant/registry';

describe('adapterFor', () => {
  it('returns the adapter whose entity matches', () => {
    expect(adapterFor('people').entity).toBe('people');
    expect(adapterFor('events').entity).toBe('events');
    expect(adapterFor('companies').entity).toBe('companies');
  });
});

describe('translateFilters', () => {
  it('carries country from companies to events', () => {
    const out = translateFilters({
      from: 'companies',
      to: 'events',
      filters: { country: 'Germany' },
    });
    expect(out.filters.country).toBe('Germany');
    expect(out.dropped).toEqual([]);
  });

  it('maps industry onto the events category', () => {
    const out = translateFilters({
      from: 'companies',
      to: 'events',
      filters: { category: 'SaaS' },
    });
    expect(out.filters.category).toBe('SaaS');
  });

  it('drops a filter with no counterpart and reports it', () => {
    const out = translateFilters({
      from: 'people',
      to: 'events',
      filters: { country: 'Germany', verification: 'verified' },
    });
    expect(out.filters.country).toBe('Germany');
    expect(out.dropped).toContain('verification');
  });

  it('passes filters through untouched when the entity is unchanged', () => {
    const filters = { country: 'Germany', verification: 'verified' };
    const out = translateFilters({ from: 'people', to: 'people', filters });
    expect(out.filters).toEqual(filters);
    expect(out.dropped).toEqual([]);
  });

  it('ignores empty values rather than reporting them as dropped', () => {
    const out = translateFilters({
      from: 'people',
      to: 'events',
      filters: { countries: [], search: '' },
    });
    expect(out.dropped).toEqual([]);
  });
});
