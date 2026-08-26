import { describe, expect, it } from 'vitest';
import { buildPeopleFilterChips, removePeopleFilterChip } from '@/lib/people/chips';
import { emptyPeopleFilters, type PeopleFilters } from '@/types/people';

function withFilters(overrides: Partial<PeopleFilters>): PeopleFilters {
  return { ...emptyPeopleFilters(), ...overrides };
}

describe('buildPeopleFilterChips', () => {
  it('produces the spec worked example verbatim', () => {
    const chips = buildPeopleFilterChips(
      withFilters({
        titles: ['Marketing Manager'],
        verification: 'verified',
        countries: ['Germany'],
      })
    );

    expect(chips.map((chip) => `${chip.label}: ${chip.value}`)).toEqual([
      'Title contains: Marketing Manager',
      'Verification: Verified',
      'Country: Germany',
    ]);
  });

  it('humanises enum values rather than leaking snake_case', () => {
    const chips = buildPeopleFilterChips(
      withFilters({
        verification: 'needs_verification',
        sources: ['licensed_dataset'],
        buyingIntents: ['high'],
        minConfidence: 70,
      })
    );

    expect(chips.map((chip) => `${chip.label}: ${chip.value}`)).toEqual([
      'Verification: Needs verification',
      'Confidence: ≥70%',
      'Intent: High',
      'Source: Licensed dataset',
    ]);
  });

  it('describes the search box and the lookalike seed', () => {
    const chips = buildPeopleFilterChips(
      withFilters({ search: 'sarah', lookalikeSeedId: 'pcx-person-00001' })
    );
    expect(chips.map((chip) => chip.label)).toEqual(['Search', 'Similar to']);
  });

  it('returns nothing for untouched filters', () => {
    expect(buildPeopleFilterChips(emptyPeopleFilters())).toEqual([]);
  });

  it('gives every chip a unique id', () => {
    const chips = buildPeopleFilterChips(
      withFilters({ countries: ['Germany', 'France'], departments: ['Marketing'] })
    );
    expect(new Set(chips.map((chip) => chip.id)).size).toBe(chips.length);
  });
});

describe('removePeopleFilterChip', () => {
  const filters = withFilters({
    countries: ['Germany', 'France'],
    titles: ['Marketing Manager'],
    verification: 'verified',
    minConfidence: 90,
    search: 'sarah',
    lookalikeSeedId: 'pcx-person-00001',
  });

  it('removes exactly one value from a list dimension', () => {
    const next = removePeopleFilterChip(filters, 'countries:Germany');
    expect(next.countries).toEqual(['France']);
    expect(next.titles).toEqual(['Marketing Manager']);
  });

  it('clears the single-value dimensions', () => {
    expect(removePeopleFilterChip(filters, 'verification').verification).toBeNull();
    expect(removePeopleFilterChip(filters, 'confidence').minConfidence).toBeNull();
    expect(removePeopleFilterChip(filters, 'search').search).toBe('');
    expect(removePeopleFilterChip(filters, 'lookalike').lookalikeSeedId).toBeNull();
  });

  it('leaves state untouched for an unknown chip id', () => {
    expect(removePeopleFilterChip(filters, 'bogus')).toEqual(filters);
    expect(removePeopleFilterChip(filters, 'nosuchkey:value')).toEqual(filters);
  });

  it('round-trips: every built chip can be removed by its own id', () => {
    for (const chip of buildPeopleFilterChips(filters)) {
      const next = removePeopleFilterChip(filters, chip.id);
      expect(next).not.toEqual(filters);
    }
  });
});
