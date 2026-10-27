import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  parseResultsState,
  resultsSearch,
  scrollStorageKey,
} from '../../lib/find-shows/results-state';
import type { FindShowFilters } from '../../types/find-shows';

const searched: FindShowFilters = {
  query: 'bett asia',
  region: 'Asia' as FindShowFilters['region'],
  country: 'Malaysia',
  category: DEFAULT_FILTERS.category,
  startMonth: '2026-09',
  endMonth: '2026-12',
};

describe('Find Shows results state in the address', () => {
  it('leaves an untouched results page at its bare address', () => {
    expect(resultsSearch({ filters: DEFAULT_FILTERS, visibleCount: PAGE_SIZE })).toBe('');
    expect(parseResultsState('')).toEqual({ filters: DEFAULT_FILTERS, visibleCount: PAGE_SIZE });
  });

  it('round-trips search, filters and Load more depth', () => {
    const state = { filters: searched, visibleCount: 36 };
    const search = resultsSearch(state);
    expect(search).toBe('?q=bett+asia&region=Asia&country=Malaysia&from=2026-09&to=2026-12&shown=36');
    expect(parseResultsState(search)).toEqual(state);
  });

  it('drops parameters once they return to their defaults and keeps unrelated ones', () => {
    const search = resultsSearch({ filters: DEFAULT_FILTERS, visibleCount: PAGE_SIZE }, '?q=bett&shown=24&utm_source=mail');
    expect(search).toBe('?utm_source=mail');
  });

  it('ignores a whitespace-only query', () => {
    expect(resultsSearch({ filters: { ...DEFAULT_FILTERS, query: '   ' }, visibleCount: PAGE_SIZE })).toBe('');
  });

  it('falls back safely on malformed or hand-edited values', () => {
    expect(parseResultsState('?shown=abc').visibleCount).toBe(PAGE_SIZE);
    expect(parseResultsState('?shown=-5').visibleCount).toBe(PAGE_SIZE);
    expect(parseResultsState('?shown=30').visibleCount).toBe(36);
    expect(parseResultsState('?region=&category=').filters).toEqual(DEFAULT_FILTERS);
  });

  it('keys the saved scroll position by the full results address', () => {
    expect(scrollStorageKey('/en-US/find-shows', '?q=bett')).not.toBe(scrollStorageKey('/en-US/find-shows', ''));
  });
});
