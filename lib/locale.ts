import type { Locale } from '@/types';

export const defaultLocale: Locale = 'en-US';

const localeAliases = {
  en: 'en-US',
  'en-us': 'en-US',
  'en-gb': 'en-GB',
  'en-uk': 'en-GB',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
} as const satisfies Record<string, Locale>;

export const localeDetails = [
  { code: 'en-US', label: 'English (USA)', nativeLabel: 'English (USA)', switcherCode: 'en-US' },
  { code: 'en-GB', label: 'English (UK)', nativeLabel: 'English (UK)', switcherCode: 'en-UK' },
  { code: 'de', label: 'Deutsch', nativeLabel: 'Deutsch', switcherCode: 'de' },
  { code: 'fr', label: 'Français', nativeLabel: 'Français', switcherCode: 'fr' },
  { code: 'es', label: 'Español', nativeLabel: 'Español', switcherCode: 'es' },
  { code: 'pt', label: 'Português', nativeLabel: 'Português', switcherCode: 'pt' },
  { code: 'ja', label: '日本語', nativeLabel: '日本語', switcherCode: 'ja' },
  { code: 'zh-CN', label: '简体中文', nativeLabel: '简体中文', switcherCode: 'zh-CN' },
] as const satisfies ReadonlyArray<{
  code: Locale;
  label: string;
  nativeLabel: string;
  switcherCode: string;
}>;

export const locales = localeDetails.map((detail) => detail.code) as Locale[];

const localizedBaseRoutes = [
  '/',
  '/product',
  '/pricing',
  '/security',
  '/find-shows',
  '/onboarding',
] as const;

export function isLocale(value: string | null | undefined): value is Locale {
  return value !== undefined && value !== null && locales.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) {
    return null;
  }

  if (isLocale(value)) {
    return value;
  }

  return localeAliases[value.trim().toLowerCase() as keyof typeof localeAliases] ?? null;
}

function getPathLocaleMatch(pathname: string) {
  const segment = decodeURIComponent(pathname.split('/')[1] ?? '');
  const locale = normalizeLocale(segment);

  if (!segment || !locale) {
    return null;
  }

  return { segment, locale };
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  return getPathLocaleMatch(pathname)?.locale ?? null;
}

export function stripLocaleFromPathname(pathname: string): string {
  const match = getPathLocaleMatch(pathname);
  if (!match) {
    return pathname || '/';
  }

  const stripped = pathname.slice(match.segment.length + 1);
  if (!stripped) {
    return '/';
  }

  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

export function getPathLocaleSegment(pathname: string) {
  return getPathLocaleMatch(pathname)?.segment ?? null;
}

export function isLocalizedRoute(pathname: string) {
  const normalized = stripLocaleFromPathname(pathname);

  return localizedBaseRoutes.some((route) => {
    if (route === '/') {
      return normalized === '/';
    }

    return normalized === route || normalized.startsWith(`${route}/`);
  });
}

export function localizePathname(pathname: string, locale: Locale) {
  const normalized = stripLocaleFromPathname(pathname);
  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`;
}

export function getLocaleNativeLabel(locale: Locale) {
  return (
    localeDetails.find((detail) => detail.code === locale)?.nativeLabel ?? locale.toUpperCase()
  );
}
