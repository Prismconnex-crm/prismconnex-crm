import {
  PEOPLE_FILTER_LIST_KEYS,
  type PeopleFilterListKey,
  type PeopleFilters,
} from '@/types/people';
import { INTENT_LABELS, SOURCE_LABELS, VERIFICATION_LABELS } from '@/lib/people/vocabulary';

/**
 * Turns the applied filters into removable chips and back again. Shared by the
 * chat reply ("here's how I read your question"), the rail's active-filter row
 * and the empty state ("nothing matched — drop one of these"), so one click
 * removes exactly one constraint everywhere.
 *
 * Structurally compatible with `QueryChip` in components/search/filter-chips.
 */
export type PeopleFilterChip = { id: string; label: string; value: string };

const SEARCH_CHIP_ID = 'search';
const VERIFICATION_CHIP_ID = 'verification';
const CONFIDENCE_CHIP_ID = 'confidence';
const LOOKALIKE_CHIP_ID = 'lookalike';

const LIST_LABEL: Record<PeopleFilterListKey, string> = {
  titles: 'Title contains',
  seniorities: 'Seniority',
  departments: 'Department',
  companies: 'Company',
  locations: 'Location',
  countries: 'Country',
  headcounts: 'Headcount',
  industries: 'Industry',
  keywords: 'Keyword',
  buyingIntents: 'Intent',
  sources: 'Source',
};

/** Enum values are stored snake_case but must never be shown that way. */
function displayValue(key: PeopleFilterListKey, value: string): string {
  if (key === 'sources') return SOURCE_LABELS[value] ?? value;
  if (key === 'buyingIntents') return INTENT_LABELS[value] ?? value;
  return value;
}

export function buildPeopleFilterChips(filters: PeopleFilters): PeopleFilterChip[] {
  const chips: PeopleFilterChip[] = [];

  if (filters.search.trim()) {
    chips.push({ id: SEARCH_CHIP_ID, label: 'Search', value: filters.search.trim() });
  }

  // Titles lead, so the worked example reads Title → Verification → Country and
  // the most-specific constraint always comes first.
  for (const value of filters.titles) {
    chips.push({ id: `titles:${value}`, label: LIST_LABEL.titles, value });
  }

  if (filters.verification) {
    chips.push({
      id: VERIFICATION_CHIP_ID,
      label: 'Verification',
      value: VERIFICATION_LABELS[filters.verification],
    });
  }

  if (filters.minConfidence !== null) {
    chips.push({
      id: CONFIDENCE_CHIP_ID,
      label: 'Confidence',
      value: `≥${filters.minConfidence}%`,
    });
  }

  for (const key of PEOPLE_FILTER_LIST_KEYS) {
    if (key === 'titles') continue; // already emitted above
    for (const value of filters[key]) {
      chips.push({ id: `${key}:${value}`, label: LIST_LABEL[key], value: displayValue(key, value) });
    }
  }

  if (filters.lookalikeSeedId) {
    chips.push({ id: LOOKALIKE_CHIP_ID, label: 'Similar to', value: filters.lookalikeSeedId });
  }

  return chips;
}

export function removePeopleFilterChip(filters: PeopleFilters, chipId: string): PeopleFilters {
  if (chipId === SEARCH_CHIP_ID) return { ...filters, search: '' };
  if (chipId === VERIFICATION_CHIP_ID) return { ...filters, verification: null };
  if (chipId === CONFIDENCE_CHIP_ID) return { ...filters, minConfidence: null };
  if (chipId === LOOKALIKE_CHIP_ID) return { ...filters, lookalikeSeedId: null };

  const separator = chipId.indexOf(':');
  if (separator === -1) return filters;

  const key = chipId.slice(0, separator) as PeopleFilterListKey;
  const value = chipId.slice(separator + 1);
  if (!PEOPLE_FILTER_LIST_KEYS.includes(key)) return filters;

  return { ...filters, [key]: filters[key].filter((item) => item !== value) };
}
