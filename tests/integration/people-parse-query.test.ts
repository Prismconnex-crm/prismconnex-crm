import { describe, expect, it } from 'vitest';
import { parsePeopleQuery } from '@/lib/people/parse-query';
import { emptyPeopleFilters } from '@/types/people';

const vocabulary = {
  titles: ['Marketing Manager', 'Sales Director', 'Head of Product', 'Product Manager'],
  companies: ['NovaAI', 'CloudForge'],
  countries: ['Germany', 'United Kingdom', 'United States'],
  locations: ['Berlin, Germany', 'London, United Kingdom'],
  industries: ['Artificial Intelligence', 'SaaS'],
  keywords: ['automation', 'expansion'],
};

const parse = (text: string) => parsePeopleQuery(text, { vocabulary });

describe('parsePeopleQuery', () => {
  it('reads the spec worked example', () => {
    const filters = parse('verified marketing managers in Germany');
    expect(filters.verification).toBe('verified');
    expect(filters.titles).toEqual(['Marketing Manager']);
    expect(filters.countries).toEqual(['Germany']);
  });

  it('handles plurals and casing', () => {
    expect(parse('SALES DIRECTORS').titles).toEqual(['Sales Director']);
    expect(parse('product managers').titles).toEqual(['Product Manager']);
  });

  it('prefers the longest matching title phrase', () => {
    // "Head of Product" must win over the shorter "Product Manager" substring.
    expect(parse('head of product at NovaAI').titles).toEqual(['Head of Product']);
  });

  it('reads verification aliases', () => {
    expect(parse('unverified contacts').verification).toBe('needs_verification');
    expect(parse('bounced emails').verification).toBe('invalid');
  });

  it('reads a confidence floor, snapping to the nearest supported threshold', () => {
    expect(parse('contacts above 90% confidence').minConfidence).toBe(90);
    expect(parse('at least 70% confidence').minConfidence).toBe(70);
    expect(parse('>= 50% confidence').minConfidence).toBe(50);
    // 63 is not a supported chip value; snap down to the nearest floor.
    expect(parse('over 63% confidence').minConfidence).toBe(50);
    expect(parse('high confidence people').minConfidence).toBe(90);
  });

  it('reads seniority and department', () => {
    expect(parse('VPs in engineering').seniorities).toEqual(['VP']);
    expect(parse('VPs in engineering').departments).toEqual(['Engineering']);
  });

  it('reads company, industry, keyword and headcount', () => {
    expect(parse('people at CloudForge').companies).toEqual(['CloudForge']);
    expect(parse('SaaS contacts').industries).toEqual(['SaaS']);
    expect(parse('anyone tagged automation').keywords).toEqual(['automation']);
    expect(parse('enterprise buyers').headcounts).toEqual(['5000+']);
  });

  it('reads buying intent and data source', () => {
    expect(parse('high intent leads').buyingIntents).toEqual(['high']);
    expect(parse('licensed dataset records').sources).toEqual(['licensed_dataset']);
  });

  it('combines many dimensions from one sentence', () => {
    const filters = parse('verified marketing managers at NovaAI in Germany with high intent');
    expect(filters.verification).toBe('verified');
    expect(filters.titles).toEqual(['Marketing Manager']);
    expect(filters.companies).toEqual(['NovaAI']);
    expect(filters.countries).toEqual(['Germany']);
    expect(filters.buyingIntents).toEqual(['high']);
  });

  it('falls back to free-text search when nothing is recognised', () => {
    const filters = parse('zzz quantum widget people');
    expect(filters.search).toBe('zzz quantum widget people');
    expect(filters.titles).toEqual([]);
  });

  it('does not set search when the sentence was fully understood', () => {
    expect(parse('verified marketing managers in Germany').search).toBe('');
  });

  it('starts from the supplied base filters', () => {
    const base = { ...emptyPeopleFilters(), departments: ['Finance'] };
    const filters = parsePeopleQuery('in Germany', { base, vocabulary });
    expect(filters.departments).toEqual(['Finance']);
    expect(filters.countries).toEqual(['Germany']);
  });

  it('returns untouched filters for an empty question', () => {
    expect(parse('   ')).toEqual(emptyPeopleFilters());
  });
});
