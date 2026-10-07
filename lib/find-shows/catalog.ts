import findShowsSeed from '../../data/find-shows-seed.json';
import webDescriptions from '../../data/find-shows-web-descriptions.json';
import {
  inferEventCountry,
  resolveSeedCountry,
  UNKNOWN_COUNTRY,
  type CountryInference,
  type FindShowRegionName,
  type ResolvedCountry,
} from './country-resolution';
import { classifyFindShowEvent, FIND_SHOW_CATEGORIES } from './categories';
import type {
  FindShowEvent,
  FindShowFilterOption,
  FindShowSeedRecord,
  FindShowsCategory,
  FindShowsRegion,
} from '@/types/find-shows';

const monthMap: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const monthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function normalizeMonthToken(token: string) {
  return token.toLowerCase().replace(/\./g, '');
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function sanitizeDateText(rawDates: string) {
  return rawDates.replace(/\s*\(\?\)\s*$/i, '').trim();
}

/**
 * "City (Country)" → city plus canonical country/ISO/region. A seed location
 * with no "(Country)" part yields null, and the caller infers the country
 * from the rest of the record instead.
 */
function splitLocation(rawLocation: string): ({ city: string } & ResolvedCountry) | null {
  const lastParenIndex = rawLocation.lastIndexOf('(');
  if (lastParenIndex === -1) {
    return null;
  }

  const city = rawLocation.substring(0, lastParenIndex).trim().replace(/\s*\([^)]*\)$/, '').trim();
  const countryInfo = rawLocation.substring(lastParenIndex + 1, rawLocation.length - 1).trim();
  const resolved = resolveSeedCountry(countryInfo);
  // An unmapped country string keeps its own spelling rather than becoming
  // "Unknown": the seed did name a country, the table just lacks it.
  return resolved.countryCode ? { city, ...resolved } : { city, ...resolved, country: countryInfo };
}

  function parseDates(rawDates: string, durationDays = 0) {
  try {
    const normalized = sanitizeDateText(rawDates);
    const approximate = /\(\?\)/.test(rawDates);
    const suffix = approximate ? ' (TBC)' : '';
    const singleDay = normalized.match(/^(?:on\s+)?([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
    if (singleDay) {
      const month = monthMap[normalizeMonthToken(singleDay[1])];
      const day = Number(singleDay[2]);
      const year = Number(singleDay[3]);
      const isoDate = toIsoDate(year, month, day);

      return {
        startDate: isoDate,
        endDate: isoDate,
        startMonth: isoDate.slice(0, 7),
        endMonth: isoDate.slice(0, 7),
        displayDate: `${pad(day)} ${monthLabels[month - 1]} ${year}${suffix}`,
      };
    }

    const multiDay = normalized.match(/^([A-Za-z.]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})$/i);
    if (multiDay) {
      const month = monthMap[normalizeMonthToken(multiDay[1])];
      const startDay = Number(multiDay[2]);
      const endDay = Number(multiDay[3]);
      const year = Number(multiDay[4]);
      const startDate = toIsoDate(year, month, startDay);
      const endDate = toIsoDate(year, month, endDay);

      return {
        startDate,
        endDate,
        startMonth: startDate.slice(0, 7),
        endMonth: endDate.slice(0, 7),
        displayDate: `${pad(startDay)} - ${pad(endDay)} ${monthLabels[month - 1]} ${year}${suffix}`,
      };
    }

    const crossMonth = normalized.match(
      /^([A-Za-z.]+)\s+(\d{1,2})\s*-\s*([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
    );
    if (crossMonth) {
      const startMonth = monthMap[normalizeMonthToken(crossMonth[1])];
      const startDay = Number(crossMonth[2]);
      const endMonth = monthMap[normalizeMonthToken(crossMonth[3])];
      const endDay = Number(crossMonth[4]);
      const year = Number(crossMonth[5]);
      const startDate = toIsoDate(year, startMonth, startDay);
      const endDate = toIsoDate(year, endMonth, endDay);

      return {
        startDate,
        endDate,
        startMonth: startDate.slice(0, 7),
        endMonth: endDate.slice(0, 7),
        displayDate: `${pad(startDay)} ${monthLabels[startMonth - 1]} - ${pad(endDay)} ${monthLabels[endMonth - 1]} ${year}${suffix}`,
      };
    }

    // Numeric US-style dates from the eventseye calendar ("01/20/2027"), where a
    // confirmed date is published. `durationDays` (from the listing's "3 days")
    // gives the end date; without it the show is treated as single-day.
    const numeric = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (numeric) {
      const month = Number(numeric[1]);
      const day = Number(numeric[2]);
      const year = Number(numeric[3]);
      const startDate = toIsoDate(year, month, day);
      const span = Math.max(1, durationDays || 1);
      const endMs = new Date(Date.UTC(year, month - 1, day + span - 1)).getTime();
      const end = new Date(endMs);
      const endDate = toIsoDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate());

      const sameMonth = endDate.slice(0, 7) === startDate.slice(0, 7);
      const displayDate =
        span === 1
          ? `${pad(day)} ${monthLabels[month - 1]} ${year}`
          : sameMonth
            ? `${pad(day)} - ${pad(end.getUTCDate())} ${monthLabels[month - 1]} ${year}`
            : `${pad(day)} ${monthLabels[month - 1]} - ${pad(end.getUTCDate())} ${monthLabels[end.getUTCMonth()]} ${year}`;

      return {
        startDate,
        endDate,
        startMonth: startDate.slice(0, 7),
        endMonth: endDate.slice(0, 7),
        displayDate,
      };
    }

    const monthOnly = normalized.match(/^(?:on\s+)?([A-Za-z.]+)\s+(\d{4})$/i);
    if (monthOnly) {
      const month = monthMap[normalizeMonthToken(monthOnly[1])];
      const year = Number(monthOnly[2]);
      const startDate = toIsoDate(year, month, 1);
      const endDate = toIsoDate(year, month, getDaysInMonth(year, month));

      return {
        startDate,
        endDate,
        startMonth: startDate.slice(0, 7),
        endMonth: endDate.slice(0, 7),
        displayDate: `${monthLabels[month - 1]} ${year}${suffix || ' (TBC)'}`,
      };
    }
    
    // Default fallback for unknown formats in large seeds
    const fallbackYear = new Date().getFullYear() + 1;
    const fallbackIso = `${fallbackYear}-01-01`;
    return {
      startDate: fallbackIso,
      endDate: fallbackIso,
      startMonth: fallbackIso.slice(0, 7),
      endMonth: fallbackIso.slice(0, 7),
      displayDate: rawDates,
    };
  } catch (err) {
      const fallbackYear = new Date().getFullYear() + 1;
      const fallbackIso = `${fallbackYear}-01-01`;
      return {
        startDate: fallbackIso,
        endDate: fallbackIso,
        startMonth: fallbackIso.slice(0, 7),
        endMonth: fallbackIso.slice(0, 7),
        displayDate: rawDates,
      };
  }
}

/**
 * The description the show's own site publishes, keyed by bare domain in
 * data/find-shows-web-descriptions.json (built by
 * scripts/fetch-event-web-descriptions.mjs).
 *
 * Keyed by domain rather than by event because one organiser runs many shows
 * from a single site — 11,629 events across 6,947 domains. A domain whose site
 * published no description is stored as null, so a missing key and a known
 * miss are distinguishable; both yield '' here.
 */
const WEB_DESCRIPTIONS = webDescriptions as Record<string, string | null>;

function domainOfWebsite(website: string | null | undefined): string {
  if (!website) return '';
  return website
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

/**
 * Domains used by exactly one event in the seed.
 *
 * A site's description only describes THIS show when the organiser runs just
 * the one from that domain. 6,033 of 11,629 events sit on a shared domain —
 * studyrama.com alone serves 188 — and there the homepage description is about
 * the organiser or their flagship show. Attaching it anyway produced results
 * like the Cincinnati house show being described as "Columbus Building &
 * Renovation Expo, January 8-10, at the Ohio Expo Center": fluent, specific
 * and about a different event. Worse than showing nothing, so shared domains
 * show nothing.
 */
const SINGLE_EVENT_DOMAINS: ReadonlySet<string> = (() => {
  const counts = new Map<string, number>();
  for (const record of findShowsSeed as FindShowSeedRecord[]) {
    const domain = domainOfWebsite(record.website);
    if (domain) counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  const unique = new Set<string>();
  counts.forEach((count, domain) => {
    if (count === 1) unique.add(domain);
  });
  return unique;
})();

function webDescriptionFor(website: string | null | undefined): string {
  const domain = domainOfWebsite(website);
  if (!domain || !SINGLE_EVENT_DOMAINS.has(domain)) return '';
  return WEB_DESCRIPTIONS[domain] ?? '';
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeVenue(venue: string) {
  const normalizedVenue = venue.trim();
  return !normalizedVenue || normalizedVenue === '?' ? 'Venue to be announced' : normalizedVenue;
}

function extractEventseyeId(value: string | null | undefined) {
  return value?.match(/-(\d+)-\d+\.html$/i)?.[1] ?? null;
}

export type RecordLocation = { city: string } & CountryInference;

/**
 * City, country and continent for one seed record, with where the country
 * came from. The seed's own "City (Country)" wins; a record without one
 * (every such record also has no city or venue) has its country inferred from
 * venue, name, description, website and organizer, or stays Unknown.
 */
export function resolveRecordLocation(record: FindShowSeedRecord): RecordLocation {
  const parsed = splitLocation(record.city);
  if (!parsed) return { city: record.city.trim(), ...inferEventCountry(record) };
  return parsed.countryCode
    ? { ...parsed, source: 'seed-location', confidence: 'high', evidence: `seed location "${record.city.trim()}"` }
    : {
        ...parsed,
        source: 'seed-location',
        confidence: 'low',
        evidence: `seed location "${record.city.trim()}" names a country missing from COUNTRIES_BY_ISO`,
      };
}

function toEvent(record: FindShowSeedRecord): FindShowEvent {
  const location = resolveRecordLocation(record);
  // "3 days" from the listing lets a numeric start date resolve its end date.
  const durationDays = Number((record.duration ?? '').match(/(\d+)/)?.[1] ?? 0);
  const parsedDates = parseDates(record.dates, durationDays);
  // The seed's own `categories` are legacy combined buckets from a substring
  // match (see lib/find-shows/categories.ts); they are kept as rawCategories
  // for provenance only. The real tags are re-derived here.
  const categories = classifyFindShowEvent(record.name, record.description ?? '');
  const seedAsset = {
    eventseyeUrl: record.eventseyeUrl ?? null,
    bannerUrl: record.bannerUrl ?? null,
    logoUrl: record.logoUrl ?? null,
  };

  return {
    slug: slugify(`${record.name}-${location.city}-${parsedDates.startDate}`),
    name: record.name,
    dates: record.dates,
    city: location.city,
    country: location.country,
    countryCode: location.countryCode,
    // Only a seed country missing from COUNTRIES_BY_ISO lacks a region (none
    // today); it keeps the old default rather than falling outside every continent.
    region: location.region ?? 'Europe',
    venue: normalizeVenue(record.venue),
    organizer: record.organizer,
    frequency: record.frequency,
    website: record.website,
    email: record.email,
    rawCategories: record.categories,
    categories,
    primaryCategory: categories[0],
    startDate: parsedDates.startDate,
    endDate: parsedDates.endDate,
    startMonth: parsedDates.startMonth,
    endMonth: parsedDates.endMonth,
    displayDate: parsedDates.displayDate,
    searchText: [
      record.name,
      location.city,
      location.country,
      normalizeVenue(record.venue),
      record.organizer,
      record.description ?? '',
      ...categories,
    ]
      .join(' ')
      .toLowerCase(),
    seedAsset,
    description: record.description ?? '',
    webDescription: webDescriptionFor(record.website),
    seedCity: record.city,
    monthYear: record.monthYear ?? parsedDates.startMonth ?? '',
    duration: record.duration ?? '',
  };
}

export const findShowsRegions: FindShowsRegion[] = [
  'All Regions',
  'Americas',
  'Europe',
  'Africa & Middle East',
  'Asia-Pacific',
];

/**
 * "All Categories" (the reset option) first, then every category A-Z. Sorted
 * here as well as written sorted in categories.ts, so a category added out of
 * order can never break the dropdown's ordering.
 */
export const findShowsCategories: FindShowsCategory[] = [
  'All Categories',
  ...[...FIND_SHOW_CATEGORIES].sort((left, right) => left.localeCompare(right, 'en')),
]

export const findShowCategoryOptions: FindShowFilterOption<FindShowsCategory>[] =
  findShowsCategories.map((category) => ({
    label: category,
    value: category,
  }));

const mappedFindShowEvents = (findShowsSeed as FindShowSeedRecord[])
  .map(toEvent)
  .sort((left, right) => left.startDate.localeCompare(right.startDate));

// First index of each slug, so de-duplication is one pass rather than a
// findIndex over all ~11k events for every event (~200 ms on module load, which
// client components pay too since they import this catalog).
const firstIndexBySlug = new Map<string, number>();
mappedFindShowEvents.forEach((event, index) => {
  if (!firstIndexBySlug.has(event.slug)) firstIndexBySlug.set(event.slug, index);
});

export const findShowEvents = mappedFindShowEvents.map((event, index) => {
  const baseSlug = event.slug;

  if (firstIndexBySlug.get(baseSlug) === index) {
    return event;
  }

  const eventseyeId = extractEventseyeId(event.seedAsset.eventseyeUrl);
  if (eventseyeId) {
    return {
      ...event,
      slug: `${baseSlug}-${eventseyeId}`,
    };
  }

  return {
    ...event,
    slug: `${baseSlug}-${index + 1}`,
  };
});

export const findShowEventsBySlug = Object.fromEntries(
  findShowEvents.map((event) => [event.slug, event])
) as Record<string, FindShowEvent>;

export const findShowCountries = Array.from(
  new Set(findShowEvents.map((event) => event.country))
).sort();

/**
 * Month-Year options for the Events Explorer filter, in calendar order rather
 * than alphabetical ("August 2026" before "January 2027").
 */
export const findShowMonthOptions: FindShowFilterOption[] = Array.from(
  findShowEvents.reduce((acc, event) => {
    if (!event.monthYear) return acc;
    acc.set(event.monthYear, (acc.get(event.monthYear) ?? 0) + 1);
    return acc;
  }, new Map<string, number>())
)
  .map(([label, count]) => ({ label, value: label, count }))
  .sort((left, right) => {
    const toKey = (value: string) => {
      const [month, year] = value.split(' ');
      const index = monthMap[month.toLowerCase()] ?? 0;
      return Number(year) * 100 + index;
    };
    return toKey(left.value) - toKey(right.value);
  });

// Declared here rather than beside `findShowCategoryOptions` because it derives
// from `findShowEvents`, which is only built further down the module.
export const findShowCountryOptions: FindShowFilterOption[] = findShowCountries.map((country) => ({
  label: country,
  value: country,
}));

export const findShowStats = {
  totalEvents: findShowEvents.length,
  countries: findShowCountries.length,
  years: new Set(findShowEvents.map((event) => event.startDate.slice(0, 4))).size,
  germanyEvents: findShowEvents.filter((event) => event.country === 'Germany').length,
  ukEvents: findShowEvents.filter((event) => event.country === 'United Kingdom').length,
  usaEvents: findShowEvents.filter((event) => event.country === 'United States').length,
};

export type CountryStat = {
  country: string;
  count: number;
  /** ISO 3166-1 alpha-2 code, or null when the country has none ("Unknown").
   *  The UI turns this into a flag image, or a globe icon when null;
   *  it deliberately does not carry an emoji, which Windows cannot draw. */
  isoCode: string | null;
};

/**
 * Each continent's dropdown: only countries whose events carry that region,
 * sorted A–Z. Built from the events themselves, so a country can only appear
 * under the region its events are filtered by. Events with no provable
 * country are listed as their continent's "Unknown" entry (Europe → Unknown),
 * kept last because it is not a country. Every continent keeps its Unknown
 * entry even at zero events, so resolving the last unknown event never makes
 * the option disappear.
 */
export const countryStatsByRegion: Record<FindShowsRegion, CountryStat[]> = {
  'All Regions': [],
  'Americas': [],
  'Europe': [],
  'Africa & Middle East': [],
  'Asia-Pacific': [],
};

const statsByRegionAndCountry = new Map<FindShowRegionName, Map<string, CountryStat>>(
  findShowsRegions
    .filter((region): region is FindShowRegionName => region !== 'All Regions')
    .map((region) => [
      region,
      new Map([[UNKNOWN_COUNTRY, { country: UNKNOWN_COUNTRY, count: 0, isoCode: null }]]),
    ])
);
findShowEvents.forEach((event) => {
  const byCountry = statsByRegionAndCountry.get(event.region) ?? new Map<string, CountryStat>();
  statsByRegionAndCountry.set(event.region, byCountry);
  const stat = byCountry.get(event.country);
  if (stat) {
    stat.count += 1;
  } else {
    byCountry.set(event.country, { country: event.country, count: 1, isoCode: event.countryCode });
  }
});

statsByRegionAndCountry.forEach((byCountry, region) => {
  countryStatsByRegion[region] = Array.from(byCountry.values()).sort((a, b) => {
    if (a.country === UNKNOWN_COUNTRY || b.country === UNKNOWN_COUNTRY) {
      return Number(a.country === UNKNOWN_COUNTRY) - Number(b.country === UNKNOWN_COUNTRY);
    }
    return a.country.localeCompare(b.country, 'en', { sensitivity: 'base' });
  });
});

