import { describe, expect, it } from 'vitest';

import {
  decodeFilters,
  encodeFilters,
  MAX_FILTER_PARAM_LENGTH,
} from '@/lib/assistant/filter-params';

const FALLBACK = { titles: [], search: '' };

describe('encodeFilters', () => {
  it('round-trips an object through the param', () => {
    const filters = { titles: ['CEO', 'CTO'], countries: ['Germany'], search: 'fintech' };
    const encoded = encodeFilters(filters);
    expect(encoded).not.toBeNull();
    expect(decodeFilters(encoded, FALLBACK)).toEqual(filters);
  });

  it('emits only base64url characters', () => {
    // +, / and = are mangled or ambiguous in a query string. Padding is stripped.
    const encoded = encodeFilters({ search: 'a?b&c=d+e/f' });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('survives non-ASCII, which base64 of a raw JS string would corrupt', () => {
    const filters = { search: 'Köln Messe — 日本' };
    expect(decodeFilters(encodeFilters(filters), FALLBACK)).toEqual(filters);
  });

  it('round-trips empty filters', () => {
    expect(decodeFilters(encodeFilters(FALLBACK), { titles: ['x'], search: 'y' })).toEqual(FALLBACK);
  });

  it('returns null over the cap rather than writing a giant URL', () => {
    const huge = { keywords: Array.from({ length: 2000 }, (_, i) => `keyword-${i}`) };
    expect(encodeFilters(huge)).toBeNull();
  });

  it('accepts a payload just under the cap', () => {
    const encoded = encodeFilters({ search: 'x'.repeat(200) });
    expect(encoded).not.toBeNull();
    expect((encoded as string).length).toBeLessThanOrEqual(MAX_FILTER_PARAM_LENGTH);
  });

  it('returns null for something JSON cannot represent', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(encodeFilters(cyclic)).toBeNull();
  });
});

describe('decodeFilters', () => {
  it('falls back for an absent param', () => {
    expect(decodeFilters(null, FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters(undefined, FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters('', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for garbage rather than throwing', () => {
    // Anyone can edit the address bar; a throw here is an unhandled navigation
    // failure on the target page, not a bad filter.
    expect(decodeFilters('!!!not base64!!!', FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters('%%%%', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for valid base64url that is not JSON', () => {
    expect(decodeFilters('aGVsbG8', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for JSON that is not an object', () => {
    // "7" and "null" both parse; neither is a filter set.
    expect(decodeFilters(encodeFilters(7), FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters(encodeFilters(null), FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters(encodeFilters([1, 2]), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for an oversize param it is handed anyway', () => {
    expect(decodeFilters('A'.repeat(MAX_FILTER_PARAM_LENGTH + 1), FALLBACK)).toBe(FALLBACK);
  });
});
