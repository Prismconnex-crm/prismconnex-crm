import { EVENT_FILTER_LIST_KEYS, type EventFilterListKey, type EventFilters } from '@/types/events';

/**
 * Turns the applied filters into removable chips and back again. Shared by the
 * AI panel ("here's how I read your question") and the empty state ("nothing
 * matched — drop one of these"), so a single click removes exactly one
 * constraint in both places.
 *
 * Structurally compatible with `QueryChip` in components/search/filter-chips.
 */
export type EventFilterChip = { id: string; label: string; value: string };

const LIST_LABEL: Record<EventFilterListKey, string> = {
  regions: 'Region',
  countries: 'Country',
  cities: 'City',
  categories: 'Industry',
  organizers: 'Organizer',
  keywords: 'Keyword',
};

const DATES_CHIP_ID = 'dates';
const FAVOURITES_CHIP_ID = 'favourites';
const SEARCH_CHIP_ID = 'search';

function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${day} ${months[Number(month) - 1] ?? month} ${year}`;
}

export function formatDateRange(dateFrom: string | null, dateTo: string | null): string {
  if (dateFrom && dateTo) return `${formatDay(dateFrom)} – ${formatDay(dateTo)}`;
  if (dateFrom) return `from ${formatDay(dateFrom)}`;
  if (dateTo) return `until ${formatDay(dateTo)}`;
  return '';
}

export function buildEventFilterChips(filters: EventFilters, search = ''): EventFilterChip[] {
  const chips: EventFilterChip[] = [];

  if (search.trim()) {
    chips.push({ id: SEARCH_CHIP_ID, label: 'Search', value: search.trim() });
  }

  for (const key of EVENT_FILTER_LIST_KEYS) {
    for (const value of filters[key]) {
      chips.push({ id: `${key}:${value}`, label: LIST_LABEL[key], value });
    }
  }

  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      id: DATES_CHIP_ID,
      label: 'Dates',
      value: formatDateRange(filters.dateFrom, filters.dateTo),
    });
  }

  if (filters.favouritesOnly) {
    chips.push({ id: FAVOURITES_CHIP_ID, label: 'Only', value: 'Liked events' });
  }

  return chips;
}

/**
 * Applies a chip removal. Returns the next filters plus the next search box
 * value, since the search chip lives outside `EventFilters`.
 */
export function removeEventFilterChip(
  filters: EventFilters,
  search: string,
  chipId: string
): { filters: EventFilters; search: string } {
  if (chipId === SEARCH_CHIP_ID) return { filters, search: '' };
  if (chipId === DATES_CHIP_ID) {
    return { filters: { ...filters, dateFrom: null, dateTo: null }, search };
  }
  if (chipId === FAVOURITES_CHIP_ID) {
    return { filters: { ...filters, favouritesOnly: false }, search };
  }

  const separator = chipId.indexOf(':');
  if (separator === -1) return { filters, search };

  const key = chipId.slice(0, separator) as EventFilterListKey;
  const value = chipId.slice(separator + 1);
  if (!EVENT_FILTER_LIST_KEYS.includes(key)) return { filters, search };

  return {
    filters: { ...filters, [key]: filters[key].filter((item) => item !== value) },
    search,
  };
}
