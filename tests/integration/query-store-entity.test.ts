import { describe, expect, it } from 'vitest';

import { targetEntityOf, type SavedQuery } from '@/components/search/query-store';

function entry(overrides: Partial<SavedQuery>): SavedQuery {
  return {
    id: 'q1',
    type: 'lead_query',
    query: 'saas companies in germany',
    chips: [],
    createdAt: 0,
    saved: false,
    ...overrides,
  };
}

describe('targetEntityOf', () => {
  it('prefers an explicit targetEntity', () => {
    expect(targetEntityOf(entry({ type: 'lead_query', targetEntity: 'people' }))).toBe('people');
  });

  it('infers companies from lead_query', () => {
    // Entries written before this field existed must keep working — the store
    // is localStorage, so there is no migration step that can run.
    expect(targetEntityOf(entry({ type: 'lead_query' }))).toBe('companies');
  });

  it('infers events from event_query', () => {
    expect(targetEntityOf(entry({ type: 'event_query' }))).toBe('events');
  });

  it('infers people from people_query', () => {
    expect(targetEntityOf(entry({ type: 'people_query' }))).toBe('people');
  });

  it('falls back to companies for an unrecognised type', () => {
    expect(targetEntityOf(entry({ type: 'something_else' as SavedQuery['type'] }))).toBe(
      'companies'
    );
  });
});
