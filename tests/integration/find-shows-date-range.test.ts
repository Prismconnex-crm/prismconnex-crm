import { describe, expect, it } from 'vitest';
import { findShowEvents } from '../../lib/find-shows/catalog';
import {
  dateRangeLabel,
  draftFromFilters,
  eventYears,
  toMonthKey,
  validateDateRange,
} from '../../lib/find-shows/date-range';
import { filterFindShowEvents } from '../../lib/find-shows/search-events';
import type { FindShowEvent, FindShowFilters, FindShowsRegion } from '../../types/find-shows';

/** The page's starting state (find-shows-page.tsx initialFilters) — "Clear All Filters" returns to it. */
const noFilters: FindShowFilters = {
  query: '',
  region: 'All Regions',
  country: '',
  category: 'All Categories',
  startMonth: '',
  endMonth: '',
};

/** The rule under test, written out: the event's dates overlap [from, to]. */
const overlaps = (event: FindShowEvent, from: string, to: string) => event.endMonth >= from && event.startMonth <= to;

const withRange = (from: string, to: string, extra: Partial<FindShowFilters> = {}) =>
  filterFindShowEvents(findShowEvents, { ...noFilters, ...extra, startMonth: from, endMonth: to });

describe('date range — choosing months and years', () => {
  it('turns From/To month and year into a month range', () => {
    expect(validateDateRange({ fromMonth: 1, fromYear: 2027, toMonth: 3, toYear: 2027 })).toEqual({
      ok: true,
      startMonth: '2027-01',
      endMonth: '2027-03',
    });
    expect(toMonthKey(2026, 8)).toBe('2026-08');
  });

  it('accepts the same month as From and To', () => {
    expect(validateDateRange({ fromMonth: 5, fromYear: 2027, toMonth: 5, toYear: 2027 })).toMatchObject({
      ok: true,
      startMonth: '2027-05',
      endMonth: '2027-05',
    });
  });

  it('rejects a From later than To with a clear message, and does not produce a range', () => {
    const later = validateDateRange({ fromMonth: 3, fromYear: 2027, toMonth: 1, toYear: 2027 });
    expect(later).toEqual({ ok: false, error: 'The From date must be the same as or earlier than the To date.' });
    // Later year, earlier month.
    expect(validateDateRange({ fromMonth: 1, fromYear: 2027, toMonth: 12, toYear: 2026 }).ok).toBe(false);
  });

  it('asks for all four fields', () => {
    expect(validateDateRange({ fromMonth: 1, fromYear: 2027, toMonth: null, toYear: 2027 })).toEqual({
      ok: false,
      error: 'Choose a month and year for both From and To.',
    });
  });

  it('labels the pill and re-opens on the applied range', () => {
    expect(dateRangeLabel('', '')).toBe('Date Range');
    expect(dateRangeLabel('2027-01', '2027-03')).toBe('Jan 2027 – Mar 2027');
    expect(dateRangeLabel('2026-08', '2026-08')).toBe('Aug 2026');
    expect(draftFromFilters('2027-01', '2027-03')).toEqual({ fromMonth: 1, fromYear: 2027, toMonth: 3, toYear: 2027 });
    expect(draftFromFilters('', '')).toEqual({ fromMonth: null, fromYear: null, toMonth: null, toYear: null });
  });

  it('offers the years the catalog’s events run in', () => {
    const years = eventYears(findShowEvents);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    for (const event of findShowEvents) {
      expect(years).toContain(Number(event.startMonth.slice(0, 4)));
      expect(years).toContain(Number(event.endMonth.slice(0, 4)));
    }
  });
});

describe('date range — filtering the catalog', () => {
  it('shows every event when no range is chosen', () => {
    expect(filterFindShowEvents(findShowEvents, noFilters)).toHaveLength(findShowEvents.length);
  });

  it('January 2027 → March 2027 keeps exactly the events in January, February and March 2027', () => {
    const result = withRange('2027-01', '2027-03');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toEqual(findShowEvents.filter((event) => overlaps(event, '2027-01', '2027-03')));
    const months = new Set(result.flatMap((event) => [event.startMonth, event.endMonth]));
    for (const month of ['2027-01', '2027-02', '2027-03']) expect(months.has(month)).toBe(true);
  });

  it('August 2026 → December 2026 keeps exactly the events in those months', () => {
    const result = withRange('2026-08', '2026-12');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toEqual(findShowEvents.filter((event) => overlaps(event, '2026-08', '2026-12')));
  });

  it('the same From and To month keeps only that month’s events', () => {
    const result = withRange('2027-05', '2027-05');
    expect(result.length).toBeGreaterThan(0);
    for (const event of result) expect(overlaps(event, '2027-05', '2027-05')).toBe(true);
    expect(result).toEqual(findShowEvents.filter((event) => overlaps(event, '2027-05', '2027-05')));
  });

  it('includes a show that starts in the month before and runs into the range', () => {
    const spanning = findShowEvents.find((event) => event.startMonth === '2026-08' && event.endMonth === '2026-09');
    expect(spanning).toBeDefined();
    expect(withRange('2026-09', '2026-09')).toContain(spanning);
    expect(withRange('2026-10', '2026-12')).not.toContain(spanning);
  });

  it('combines with every region, and with region + category', () => {
    const regions: FindShowsRegion[] = ['Europe', 'Asia-Pacific', 'Americas', 'Africa & Middle East'];
    for (const region of regions) {
      const result = withRange('2027-01', '2027-03', { region });
      expect(result.length, region).toBeGreaterThan(0);
      expect(result).toEqual(
        findShowEvents.filter((event) => event.region === region && overlaps(event, '2027-01', '2027-03'))
      );
    }

    const category = findShowEvents.find((event) => event.region === 'Europe')!.categories[0];
    const combined = withRange('2026-08', '2027-08', { region: 'Europe', category });
    expect(combined.length).toBeGreaterThan(0);
    for (const event of combined) {
      expect(event.region).toBe('Europe');
      expect(event.categories).toContain(category);
    }
    // Each filter only narrows.
    expect(combined.length).toBeLessThanOrEqual(withRange('2026-08', '2027-08', { region: 'Europe' }).length);
  });

  it('Clear Date Range removes only the date range, keeping region and category', () => {
    const others: Partial<FindShowFilters> = { region: 'Europe', category: 'Medical' };
    const cleared = filterFindShowEvents(findShowEvents, { ...noFilters, ...others, startMonth: '', endMonth: '' });
    expect(cleared).toEqual(filterFindShowEvents(findShowEvents, { ...noFilters, ...others }));
    expect(cleared.length).toBeGreaterThan(withRange('2027-01', '2027-01', others).length);
  });

  it('Clear All Filters (back to the starting state) also clears the date range', () => {
    expect(noFilters.startMonth).toBe('');
    expect(noFilters.endMonth).toBe('');
    expect(filterFindShowEvents(findShowEvents, noFilters)).toHaveLength(findShowEvents.length);
  });
});
