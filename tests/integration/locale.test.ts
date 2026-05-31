import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultLocale,
  getLocaleFromPathname,
  localeDetails,
  localizePathname,
  locales,
  normalizeLocale,
  stripLocaleFromPathname,
} from '../../lib/locale';

const messagesDir = path.join(process.cwd(), 'messages');
const requiredLocales = ['en-US', 'en-GB', 'de', 'fr', 'es', 'pt', 'ja', 'zh-CN'] as const;

function readJson(fileName: string) {
  return JSON.parse(fs.readFileSync(path.join(messagesDir, fileName), 'utf-8')) as Record<
    string,
    unknown
  >;
}

describe('locale routing', () => {
  it('uses en-US as the default locale', () => {
    expect(defaultLocale).toBe('en-US');
    expect(locales).toEqual(requiredLocales);
    expect(localeDetails.map((locale) => locale.code)).toEqual(requiredLocales);
  });

  it('normalizes legacy and region inputs', () => {
    expect(normalizeLocale('en')).toBe('en-US');
    expect(normalizeLocale('en-us')).toBe('en-US');
    expect(normalizeLocale('en-gb')).toBe('en-GB');
    expect(normalizeLocale('en-uk')).toBe('en-GB');
    expect(normalizeLocale('zh')).toBe('zh-CN');
    expect(normalizeLocale('zh-cn')).toBe('zh-CN');
    expect(normalizeLocale('pt')).toBe('pt');
  });

  it('keeps localized route handling canonical', () => {
    expect(getLocaleFromPathname('/en/product')).toBe('en-US');
    expect(getLocaleFromPathname('/en-GB/product')).toBe('en-GB');
    expect(getLocaleFromPathname('/en-UK/product')).toBe('en-GB');
    expect(getLocaleFromPathname('/zh-CN/security')).toBe('zh-CN');
    expect(getLocaleFromPathname('/en/find-shows')).toBe('en-US');
    expect(stripLocaleFromPathname('/en/product')).toBe('/product');
    expect(stripLocaleFromPathname('/en-UK/onboarding')).toBe('/onboarding');
    expect(stripLocaleFromPathname('/en-US/onboarding')).toBe('/onboarding');
    expect(stripLocaleFromPathname('/en/find-shows')).toBe('/find-shows');
    expect(localizePathname('/product', 'en-GB')).toBe('/en-GB/product');
    expect(localizePathname('/en/product', 'zh-CN')).toBe('/zh-CN/product');
    expect(localizePathname('/find-shows', 'en-GB')).toBe('/en-GB/find-shows');
  });
});

describe('message coverage', () => {
  it('ships message files for every supported locale', () => {
    for (const locale of requiredLocales) {
      expect(fs.existsSync(path.join(messagesDir, `${locale}.json`))).toBe(true);
    }
  });

  it('keeps marketing, onboarding, and auth keys present in every locale', () => {
    const baseline = readJson('en-US.json');

    for (const locale of requiredLocales) {
      const messages = readJson(`${locale}.json`);
      expect(messages).toHaveProperty('marketing');
      expect(messages).toHaveProperty('onboarding');
      expect(messages).toHaveProperty('auth');
      expect(Object.keys(messages)).toEqual(Object.keys(baseline));
    }
  });
});
