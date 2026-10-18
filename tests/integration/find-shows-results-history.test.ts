import { describe, expect, it } from 'vitest';
import { createResultsHistory } from '../../lib/find-shows/results-history';
import { DEFAULT_FILTERS, PAGE_SIZE, type FindShowsResultsState } from '../../lib/find-shows/results-state';
import type { FindShowFilters } from '../../types/find-shows';

/** An in-memory browser history: push truncates the forward stack, back/forward move without writing. */
function fakeBrowser(startUrl: string) {
  const entries = [startUrl];
  let index = 0;
  const url = () => new URL(entries[index], 'http://localhost');
  const browser = {
    history: {
      state: null as unknown,
      pushState(_data: unknown, _unused: string, next: string) {
        entries.splice(index + 1, entries.length, next);
        index += 1;
      },
      replaceState(_data: unknown, _unused: string, next: string) {
        entries[index] = next;
      },
    },
    location: {
      get pathname() { return url().pathname; },
      get search() { return url().search; },
      get hash() { return url().hash; },
    },
    /** What a link click does: Next pushes the event page's address. */
    openEvent(slug: string) {
      browser.history.pushState(null, '', `/en-US/find-shows/${slug}`);
    },
    back() {
      expect(index).toBeGreaterThan(0);
      index -= 1;
    },
    forward() {
      expect(index).toBeLessThan(entries.length - 1);
      index += 1;
    },
    get current() { return entries[index]; },
    get entries() { return entries.slice(); },
  };
  return browser;
}

const state = (filters: Partial<FindShowFilters>, visibleCount = PAGE_SIZE): FindShowsResultsState => ({
  filters: { ...DEFAULT_FILTERS, ...filters },
  visibleCount,
});

/** Home → Find Shows, the starting point of every scenario. */
function openFindShows() {
  const browser = fakeBrowser('/en-US');
  browser.history.pushState(null, '', '/en-US/find-shows');
  return { browser, results: createResultsHistory(browser) };
}

describe('Find Shows browser history', () => {
  it('Europe → country → event: each Back returns one state, ending at Find Shows then Home', () => {
    const { browser, results } = openFindShows();
    results.commit(state({ region: 'Europe' }));
    results.commit(state({ region: 'Europe', country: 'Germany' }));
    browser.openEvent('medica-dusseldorf-2026-11-16');

    browser.back();
    expect(browser.current).toBe('/en-US/find-shows?region=Europe&country=Germany');
    expect(results.read()).toEqual(state({ region: 'Europe', country: 'Germany' }));

    browser.back();
    expect(results.read()).toEqual(state({ region: 'Europe' }));

    browser.back();
    expect(browser.current).toBe('/en-US/find-shows');
    expect(results.read()).toEqual(state({}));

    browser.back();
    expect(browser.current).toBe('/en-US');
  });

  it('applying then changing a date range gives one entry per applied range', () => {
    const { browser, results } = openFindShows();
    results.commit(state({ startMonth: '2026-01', endMonth: '2026-03' }));
    results.commit(state({ startMonth: '2026-04', endMonth: '2026-06' }));
    browser.openEvent('some-show');

    browser.back();
    expect(results.read().filters).toMatchObject({ startMonth: '2026-04', endMonth: '2026-06' });
    browser.back();
    expect(results.read().filters).toMatchObject({ startMonth: '2026-01', endMonth: '2026-03' });
    browser.back();
    expect(results.read().filters).toEqual(DEFAULT_FILTERS);
  });

  it('restores search, filters and Load more depth from the event page', () => {
    const { browser, results } = openFindShows();
    for (const query of ['b', 'be', 'bet', 'bett']) results.type(state({ query }));
    results.endTyping();
    results.commit(state({ query: 'bett', region: 'Asia' as FindShowFilters['region'] }));
    results.commit(state({ query: 'bett', region: 'Asia' as FindShowFilters['region'], country: 'Malaysia', category: 'Education' as FindShowFilters['category'] }));
    results.update(state({ query: 'bett', region: 'Asia' as FindShowFilters['region'], country: 'Malaysia', category: 'Education' as FindShowFilters['category'] }, 36));
    browser.openEvent('bett-asia-kuala-lumpur-2026-09-30');

    browser.back();
    expect(results.read()).toEqual(
      state({ query: 'bett', region: 'Asia' as FindShowFilters['region'], country: 'Malaysia', category: 'Education' as FindShowFilters['category'] }, 36)
    );
    browser.back();
    expect(results.read().filters).toMatchObject({ query: 'bett', region: 'Asia', country: '' });
    // The whole typing burst is one entry: Back undoes "bett", not one letter.
    browser.back();
    expect(results.read().filters).toEqual({ ...DEFAULT_FILTERS, query: 'bett' });
    browser.back();
    expect(results.read().filters).toEqual(DEFAULT_FILTERS);
  });

  it('Back and Forward traverse the same states in order without skipping or looping', () => {
    const { browser, results } = openFindShows();
    results.commit(state({ region: 'Europe' }));
    results.commit(state({ region: 'Europe', country: 'France' }));
    results.commit(state({ region: 'Europe', country: 'France', category: 'Medical & Healthcare' as FindShowFilters['category'] }));
    const forwardStack = browser.entries;

    for (let i = forwardStack.length - 1; i > 0; i -= 1) {
      expect(browser.current).toBe(forwardStack[i]);
      browser.back();
      results.read();
    }
    for (let i = 0; i < forwardStack.length - 1; i += 1) {
      expect(browser.current).toBe(forwardStack[i]);
      browser.forward();
      results.read();
    }
    expect(browser.entries).toEqual(forwardStack);
  });

  it('never adds an entry for an action that leaves the address unchanged', () => {
    const { browser, results } = openFindShows();
    results.commit(state({ region: 'Europe' }));
    const before = browser.entries;
    expect(results.commit(state({ region: 'Europe' }))).toBe(false);
    expect(results.update(state({ region: 'Europe' }))).toBe(false);
    expect(browser.entries).toEqual(before);
  });

  it('a new typing burst after Back or a submitted search gets its own entry', () => {
    const { browser, results } = openFindShows();
    results.type(state({ query: 'expo' }));
    results.endTyping();
    results.type(state({ query: 'expo 2026' }));
    expect(browser.entries.slice(-2)).toEqual(['/en-US/find-shows?q=expo', '/en-US/find-shows?q=expo+2026']);

    browser.back();
    results.read();
    results.type(state({ query: 'medica' }));
    // Typing after Back replaces the forward stack with one new entry, never rewriting the entry it came back to.
    expect(browser.entries.slice(-2)).toEqual(['/en-US/find-shows?q=expo', '/en-US/find-shows?q=medica']);
  });

  it('Load more rewrites the current entry instead of adding one', () => {
    const { browser, results } = openFindShows();
    results.commit(state({ region: 'Europe' }));
    const length = browser.entries.length;
    results.update(state({ region: 'Europe' }, 24));
    results.update(state({ region: 'Europe' }, 36));
    expect(browser.entries.length).toBe(length);
    expect(browser.current).toBe('/en-US/find-shows?region=Europe&shown=36');
  });

  it('a direct or refreshed address restores its state with no history writes', () => {
    const browser = fakeBrowser('/en-US/find-shows?region=Europe&country=Germany&shown=24');
    const results = createResultsHistory(browser);
    expect(results.read()).toEqual(state({ region: 'Europe', country: 'Germany' }, 24));
    expect(browser.entries).toEqual(['/en-US/find-shows?region=Europe&country=Germany&shown=24']);
  });

  it('a directly opened event page is left alone: Back goes wherever the visitor came from', () => {
    const browser = fakeBrowser('https://example.com/');
    browser.history.pushState(null, '', '/en-US/find-shows/medica-dusseldorf-2026-11-16');
    browser.back();
    expect(browser.current).toBe('https://example.com/');
  });
});
