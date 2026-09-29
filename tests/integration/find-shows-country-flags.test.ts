import { describe, expect, it } from 'vitest';
import {
  getCountryFlag,
  getCountryFlagImageUrl,
  getCountryIsoCode,
  isoCodeToFlagEmoji,
  normalizeCountryKey,
} from '../../lib/find-shows/country-flags';
import { countryStatsByRegion, findShowCountries } from '../../lib/find-shows/catalog';

describe('country flags', () => {
  it('builds the flag from the ISO alpha-2 code', () => {
    expect(isoCodeToFlagEmoji('US')).toBe('🇺🇸');
    expect(isoCodeToFlagEmoji('CA')).toBe('🇨🇦');
    expect(isoCodeToFlagEmoji('BR')).toBe('🇧🇷');
    expect(isoCodeToFlagEmoji('CN')).toBe('🇨🇳');
    expect(isoCodeToFlagEmoji('IN')).toBe('🇮🇳');
    expect(isoCodeToFlagEmoji('AU')).toBe('🇦🇺');
  });

  it('rejects anything that is not a two-letter code', () => {
    expect(isoCodeToFlagEmoji('USA')).toBeNull();
    expect(isoCodeToFlagEmoji('U1')).toBeNull();
    expect(isoCodeToFlagEmoji('')).toBeNull();
  });

  it('resolves the catalog spellings, including the messy ones', () => {
    expect(getCountryIsoCode('United States')).toBe('US');
    expect(getCountryIsoCode('united states')).toBe('US');
    expect(getCountryIsoCode('UAE - United Arab Emirates')).toBe('AE'); // "XX - Name" prefix
    expect(getCountryIsoCode('Congo-Kinshasa')).toBe('CD'); // hyphenated
    expect(getCountryIsoCode('Burma)')).toBe('MM'); // stray seed punctuation
    expect(getCountryIsoCode('South Korea')).toBe('KR');
    expect(getCountryIsoCode('Korea South')).toBe('KR');
    expect(getCountryIsoCode('Turkey')).toBe('TR');
  });

  it('accepts an ISO code directly', () => {
    expect(getCountryFlag('US')).toBe('🇺🇸');
    expect(getCountryFlag('ca')).toBe('🇨🇦');
  });

  it('returns null so the UI can fall back to the globe icon', () => {
    expect(getCountryFlag('Unknown')).toBeNull();
    expect(getCountryFlag('')).toBeNull();
  });

  it('normalizes accents and separators into a lookup key', () => {
    expect(normalizeCountryKey('  Côte d’Ivoire ')).toBe('cote d ivoire');
    expect(normalizeCountryKey('UK - United Kingdom')).toBe('united kingdom');
  });

  it('builds a flag image URL from the ISO code', () => {
    expect(getCountryFlagImageUrl('United States')).toBe('https://flagcdn.com/w40/us.png');
    expect(getCountryFlagImageUrl('Canada')).toBe('https://flagcdn.com/w40/ca.png');
    expect(getCountryFlagImageUrl('India')).toBe('https://flagcdn.com/w40/in.png');
    expect(getCountryFlagImageUrl('China')).toBe('https://flagcdn.com/w40/cn.png');
    expect(getCountryFlagImageUrl('Australia')).toBe('https://flagcdn.com/w40/au.png');
    expect(getCountryFlagImageUrl('Brazil', 80)).toBe('https://flagcdn.com/w80/br.png');
  });

  it('has no image URL for a country with no ISO code, so the UI shows the globe', () => {
    expect(getCountryFlagImageUrl('Unknown')).toBeNull();
  });

  it('maps Kosovo to its user-assigned XK code so it shows a flag, not the globe', () => {
    expect(getCountryIsoCode('Kosovo')).toBe('XK');
    expect(getCountryFlagImageUrl('Kosovo')).toBe('https://flagcdn.com/w40/xk.png');
  });

  it('gives every country in every region panel an image URL, bar Unknown', () => {
    const missing = Object.entries(countryStatsByRegion).flatMap(([region, stats]) =>
      stats.filter((stat) => !getCountryFlagImageUrl(stat.country)).map((stat) => `${region}/${stat.country}`)
    );

    // A continent may carry an "Unknown" bucket (globe icon); nothing else may lack a flag.
    expect(missing.every((entry) => entry.endsWith('/Unknown'))).toBe(true);
  });

  it('flags every country in the live catalog except the known unmapped ones', () => {
    const unflagged = findShowCountries.filter((country) => !getCountryFlag(country));

    // "Unknown" is what an unparsable seed location becomes. Anything else
    // appearing here is a missing mapping.
    expect(unflagged).toEqual(['Unknown']);
  });

  it('lists every region’s countries A–Z, with Unknown kept last', () => {
    for (const stats of Object.values(countryStatsByRegion)) {
      const named = stats.map((stat) => stat.country).filter((country) => country !== 'Unknown');
      expect(named).toEqual([...named].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
      if (stats.some((stat) => stat.country === 'Unknown')) {
        expect(stats[stats.length - 1].country).toBe('Unknown');
      }
    }
  });

  it('carries the ISO code — not an emoji — through to the region country lists', () => {
    const americas = countryStatsByRegion.Americas;

    expect(americas.find((stat) => stat.country === 'United States')?.isoCode).toBe('US');
    expect(americas.find((stat) => stat.country === 'Canada')?.isoCode).toBe('CA');
    expect(americas.find((stat) => stat.country === 'Brazil')?.isoCode).toBe('BR');
    expect(
      americas.every((stat) => stat.isoCode === null || /^[A-Z]{2}$/.test(stat.isoCode))
    ).toBe(true);
  });
});
