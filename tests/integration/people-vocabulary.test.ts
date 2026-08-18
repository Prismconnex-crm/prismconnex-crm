import { describe, expect, it } from 'vitest';
import {
  emptyPeopleFilters,
  hasAnyPeopleFilter,
  PEOPLE_FILTER_LIST_KEYS,
  SENIORITIES,
  DEPARTMENTS,
  HEADCOUNT_BANDS,
  VERIFICATION_STATUSES,
  DATA_SOURCES,
  BUYING_INTENTS,
} from '@/types/people';
import {
  normalizePeopleText,
  resolveDepartment,
  resolveHeadcountBand,
  resolveSeniority,
  resolveVerification,
  singularize,
} from '@/lib/people/vocabulary';

describe('empty filters', () => {
  it('has an entry for every list key and nothing applied', () => {
    const filters = emptyPeopleFilters();
    for (const key of PEOPLE_FILTER_LIST_KEYS) {
      expect(filters[key]).toEqual([]);
    }
    expect(filters.verification).toBeNull();
    expect(filters.minConfidence).toBeNull();
    expect(filters.lookalikeSeedId).toBeNull();
    expect(filters.search).toBe('');
    expect(hasAnyPeopleFilter(filters)).toBe(false);
  });

  it('detects each kind of applied filter', () => {
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), countries: ['Germany'] })).toBe(true);
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), verification: 'verified' })).toBe(true);
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), minConfidence: 70 })).toBe(true);
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), lookalikeSeedId: 'p-1' })).toBe(true);
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), search: 'sarah' })).toBe(true);
    // Whitespace is not a filter.
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), search: '   ' })).toBe(false);
  });
});

describe('vocabularies are non-empty and unique', () => {
  it('exposes every closed vocabulary', () => {
    for (const vocab of [
      SENIORITIES,
      DEPARTMENTS,
      HEADCOUNT_BANDS,
      VERIFICATION_STATUSES,
      DATA_SOURCES,
      BUYING_INTENTS,
    ]) {
      expect(vocab.length).toBeGreaterThan(0);
      expect(new Set(vocab).size).toBe(vocab.length);
    }
  });
});

describe('normalizePeopleText', () => {
  it('lowercases, trims and strips accents', () => {
    expect(normalizePeopleText('  MÜNCHEN ')).toBe('munchen');
    expect(normalizePeopleText('São Paulo')).toBe('sao paulo');
  });
});

describe('singularize', () => {
  it('handles the plural forms that appear in questions', () => {
    expect(singularize('managers')).toBe('manager');
    expect(singularize('companies')).toBe('company');
    expect(singularize('addresses')).toBe('address');
    expect(singularize('sales')).toBe('sales');
    expect(singularize('director')).toBe('director');
  });
});

describe('alias resolution', () => {
  it('maps verification words onto statuses', () => {
    expect(resolveVerification('verified')).toBe('verified');
    expect(resolveVerification('unverified')).toBe('needs_verification');
    expect(resolveVerification('needs verification')).toBe('needs_verification');
    expect(resolveVerification('bounced')).toBe('invalid');
    expect(resolveVerification('german')).toBeNull();
  });

  it('maps seniority words', () => {
    expect(resolveSeniority('vp')).toBe('VP');
    expect(resolveSeniority('vice president')).toBe('VP');
    expect(resolveSeniority('chief')).toBe('C-Level');
    expect(resolveSeniority('heads')).toBe('Director');
    expect(resolveSeniority('banana')).toBeNull();
  });

  it('maps department words', () => {
    expect(resolveDepartment('marketing')).toBe('Marketing');
    expect(resolveDepartment('devs')).toBe('Engineering');
    expect(resolveDepartment('people ops')).toBe('HR');
    expect(resolveDepartment('banana')).toBeNull();
  });

  it('maps headcount phrases onto bands', () => {
    expect(resolveHeadcountBand('startup')).toBe('11-50');
    expect(resolveHeadcountBand('enterprise')).toBe('5000+');
    expect(resolveHeadcountBand('51-200')).toBe('51-200');
    expect(resolveHeadcountBand('banana')).toBeNull();
  });
});
