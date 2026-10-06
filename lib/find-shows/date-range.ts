/**
 * Month-and-year Date Range for the Find Shows filter bar. The range is kept in
 * the existing `FindShowFilters.startMonth` / `endMonth` fields as "YYYY-MM"
 * keys — January 2027 → March 2027 is "2027-01" → "2027-03", i.e. 1 Jan to
 * 31 Mar — and search-events.ts keeps any event whose dates overlap it.
 */

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "2027-01" from year 2027 and month 1 (January). */
export function toMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Year and month (1-12) of a "YYYY-MM" key; null for an empty or malformed key. */
export function parseMonthKey(key: string): { year: number; month: number } | null {
  const match = key.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

/** "Jan 2027" for "2027-01". */
function shortLabel(key: string) {
  const parsed = parseMonthKey(key);
  return parsed ? `${MONTH_NAMES[parsed.month - 1].slice(0, 3)} ${parsed.year}` : '';
}

/** The filter pill's label: "Date Range", "Mar 2027", or "Jan 2027 – Mar 2027". */
export function dateRangeLabel(startMonth: string, endMonth: string) {
  if (!startMonth || !endMonth) return 'Date Range';
  return startMonth === endMonth ? shortLabel(startMonth) : `${shortLabel(startMonth)} – ${shortLabel(endMonth)}`;
}

/** A partly or fully chosen range in the popover; a field is null until picked. */
export type DateRangeDraft = {
  fromMonth: number | null;
  fromYear: number | null;
  toMonth: number | null;
  toYear: number | null;
};

export type DateRangeResult =
  | { ok: true; startMonth: string; endMonth: string }
  | { ok: false; error: string };

/** Checks a draft before it is applied: all four fields chosen, From not after To. */
export function validateDateRange(draft: DateRangeDraft): DateRangeResult {
  const { fromMonth, fromYear, toMonth, toYear } = draft;
  if (!fromMonth || !fromYear || !toMonth || !toYear) {
    return { ok: false, error: 'Choose a month and year for both From and To.' };
  }
  const startMonth = toMonthKey(fromYear, fromMonth);
  const endMonth = toMonthKey(toYear, toMonth);
  if (startMonth > endMonth) {
    return { ok: false, error: 'The From date must be the same as or earlier than the To date.' };
  }
  return { ok: true, startMonth, endMonth };
}

/** The popover's starting fields for the range currently applied (empty when none). */
export function draftFromFilters(startMonth: string, endMonth: string): DateRangeDraft {
  const from = parseMonthKey(startMonth);
  const to = parseMonthKey(endMonth);
  return {
    fromMonth: from?.month ?? null,
    fromYear: from?.year ?? null,
    toMonth: to?.month ?? null,
    toYear: to?.year ?? null,
  };
}

/** Every year an event in the catalog starts or ends in, ascending. */
export function eventYears(events: ReadonlyArray<{ startMonth: string; endMonth: string }>) {
  const years = new Set<number>();
  for (const event of events) {
    for (const key of [event.startMonth, event.endMonth]) {
      const parsed = parseMonthKey(key);
      if (parsed) years.add(parsed.year);
    }
  }
  return Array.from(years).sort((a, b) => a - b);
}
