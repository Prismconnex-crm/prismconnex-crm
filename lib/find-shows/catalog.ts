import findShowsSeed from '../../data/find-shows-seed.json';
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

const categoryRules: Array<{
  category: Exclude<FindShowsCategory, 'All Categories'>;
  keywords: string[];
}> = [
  { category: 'Plastics & Rubber', keywords: ['plastic', 'rubber', 'composite'] },
  {
    category: 'Manufacturing & Engineering',
    keywords: [
      'metal',
      'mould',
      'die',
      'machine',
      'welding',
      'engineering',
      'subcontracting',
      'industrial',
      'tool',
      'process equipment',
    ],
  },
  {
    category: 'Medical & Healthcare',
    keywords: ['medical', 'veterinary', 'pharmaceutical', 'surgery', 'health', 'nursing'],
  },
  {
    category: 'Food & Beverage',
    keywords: ['food', 'catering', 'hospitality', 'wine', 'beer', 'coffee', 'tea', 'chocolate'],
  },
  {
    category: 'Technology & Electronics',
    keywords: [
      'computer',
      'internet',
      'telecommunications',
      'artificial intelligence',
      'data computing',
      'multimedia',
      'big data',
      'software',
      'knowledge based systems',
    ],
  },
  {
    category: 'Construction & Building',
    keywords: [
      'building',
      'construction',
      'kitchen',
      'bathroom',
      'home show',
      'renovation',
      'furniture',
      'lighting',
    ],
  },
  {
    category: 'Energy & Environment',
    keywords: ['environment', 'energy', 'oil', 'gas', 'shipping', 'marine', 'spatial information'],
  },
  { category: 'Automotive', keywords: ['motorcycle', 'bike', 'automobile'] },
  { category: 'Packaging', keywords: ['packaging'] },
  {
    category: 'Textiles & Fashion',
    keywords: ['fashion', 'clothing', 'textile', 'apparel', 'leather'],
  },
  {
    category: 'Agriculture',
    keywords: ['agriculture', 'horticulture', 'arboriculture', 'livestock', 'poultry'],
  },
  { category: 'Security & Safety', keywords: ['security', 'risk management', 'safety'] },
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

const americasSet = new Set([
  'united states', 'usa', 'u.s.a', 'canada', 'brazil', 'mexico', 'colombia',
  'peru', 'argentina', 'chile', 'bolivia', 'panama', 'cuba', 'ecuador',
  'bahamas', 'dominican republic', 'guatemala', 'costa rica', 'el salvador',
  'salvador', 'puerto rico', 'jamaica'
]);

const asiaPacificSet = new Set([
  'china', 'india', 'japan', 'australia', 'south korea', 'korea south',
  'korea, south', 'thailand', 'singapore', 'indonesia', 'malaysia', 
  'philippines', 'vietnam', 'taiwan', 'hong kong', 'hong-kong', 'pakistan', 
  'bangladesh', 'new zealand', 'new-zealand', 'sri lanka', 'sri-lanka', 
  'kazakhstan', 'uzbekistan', 'iran', 'kyrgyzstan', 'macao', 'maldives', 
  'mauritius', 'mongolia', 'myanmar', 'burma', 'nepal', 'turkmenistan', 
  'bhutan', 'cambodia', 'fiji', 'papua new guinea', 'papua-new-guinea'
]);

const africaMiddleEastSet = new Set([
  'united arab emirates', 'uae', 'turkey', 'saudi arabia', 'algeria', 
  'angola', 'bahrain', 'botswana', 'burkina faso', 'cameroon', 
  'congo-kinshasa', 'egypt', 'ethiopia', 'ghana', 'iraq', 'israel', 
  'ivory coast', 'jordan', 'kenya', 'kuwait', 'lebanon', 'libya', 
  'madagascar', 'mali', 'morocco', 'mozambique', 'namibia', 'nigeria', 
  'oman', 'qatar', 'rwanda', 'senegal', 'seychelles', 'south africa', 
  'south-africa', 'south sudan', 'syria', 'tanzania', 'togo', 'tunisia', 
  'uganda', 'zambia', 'zimbabwe'
]);

export const countryFlags: Record<string, string> = {
  'United Kingdom': '🇬🇧',
  'Germany': '🇩🇪',
  'United States': '🇺🇸',
  'China': '🇨🇳',
  'France': '🇫🇷',
  'Italy': '🇮🇹',
  'United Arab Emirates': '🇦🇪',
  'India': '🇮🇳',
  'Spain': '🇪🇸',
  'Turkey': '🇹🇷',
  'Japan': '🇯🇵',
  'Netherlands': '🇳🇱',
  'Brazil': '🇧🇷',
  'South Korea': '🇰🇷',
  'Thailand': '🇹🇭',
  'Singapore': '🇸🇬',
  'Canada': '🇨🇦',
  'Australia': '🇦🇺',
  'Poland': '🇵🇱',
  'Saudi Arabia': '🇸🇦',
  'Mexico': '🇲🇽',
  'Colombia': '🇨🇴',
  'Peru': '🇵🇪',
  'Argentina': '🇦🇷',
  'Chile': '🇨🇱',
  'Bolivia': '🇧🇴',
  'Panama': '🇵🇦',
  'Cuba': '🇨🇺',
  'Ecuador': '🇪🇨',
  'Bahamas': '🇧🇸',
  'Dominican Republic': '🇩🇴',
  'Guatemala': '🇬🇹',
  'Costa Rica': '🇨🇷',
  'El Salvador': '🇸🇻',
  'Puerto Rico': '🇵🇷',
  'Jamaica': '🇯🇲',
};

function getRegionForCountry(countryInfo: string): Exclude<FindShowsRegion, 'All Regions'> {
  const norm = countryInfo.toLowerCase();
  if (americasSet.has(norm)) return 'Americas';
  if (asiaPacificSet.has(norm)) return 'Asia-Pacific';
  if (africaMiddleEastSet.has(norm)) return 'Africa & Middle East';
  return 'Europe';
}

function splitLocation(rawLocation: string) {
  const lastParenIndex = rawLocation.lastIndexOf('(');
  if (lastParenIndex === -1) {
    return { city: rawLocation.trim(), country: 'Unknown', region: 'Europe' as const };
  }

  const city = rawLocation.substring(0, lastParenIndex).trim().replace(/\s*\([^)]*\)$/, '').trim();
  let countryInfo = rawLocation.substring(lastParenIndex + 1, rawLocation.length - 1).trim();
  const lowerInfo = countryInfo.toLowerCase();

  let country = countryInfo;
  if (lowerInfo.includes('united kingdom') || lowerInfo.startsWith('uk')) {
    country = 'United Kingdom';
  } else if (lowerInfo.includes('germany')) {
    country = 'Germany';
  } else if (lowerInfo.includes('united states') || lowerInfo === 'usa' || lowerInfo === 'u.s.a') {
    country = 'United States';
  } else if (lowerInfo.includes('korea, south') || lowerInfo === 'korea south') {
    country = 'South Korea';
  } else if (lowerInfo === 'uae') {
    country = 'United Arab Emirates';
  } else if (lowerInfo === 'salvador') {
    country = 'El Salvador';
  }

  return { city, country, region: getRegionForCountry(country) };
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

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapRawCategory(rawCategory: string): Exclude<FindShowsCategory, 'All Categories'> {
  const normalized = rawCategory.toLowerCase();

  for (const rule of categoryRules) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }

  return 'General';
}

function normalizeVenue(venue: string) {
  const normalizedVenue = venue.trim();
  return !normalizedVenue || normalizedVenue === '?' ? 'Venue to be announced' : normalizedVenue;
}

function extractEventseyeId(value: string | null | undefined) {
  return value?.match(/-(\d+)-\d+\.html$/i)?.[1] ?? null;
}

function uniqueCategories<T extends string>(categories: T[]) {
  return categories.filter((category, index) => categories.indexOf(category) === index);
}

function toEvent(record: FindShowSeedRecord): FindShowEvent {
  const location = splitLocation(record.city);
  // "3 days" from the listing lets a numeric start date resolve its end date.
  const durationDays = Number((record.duration ?? '').match(/(\d+)/)?.[1] ?? 0);
  const parsedDates = parseDates(record.dates, durationDays);
  const mappedCategories = uniqueCategories(record.categories.map(mapRawCategory));
  const primaryCategory = mappedCategories[0] ?? 'General';
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
    region: location.region,
    venue: normalizeVenue(record.venue),
    organizer: record.organizer,
    frequency: record.frequency,
    website: record.website,
    email: record.email,
    rawCategories: record.categories,
    categories: mappedCategories,
    primaryCategory,
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
      ...record.categories,
      ...mappedCategories,
    ]
      .join(' ')
      .toLowerCase(),
    seedAsset,
    description: record.description ?? '',
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

export const findShowsCategories: FindShowsCategory[] = [
  'All Categories',
  'Manufacturing & Engineering',
  'Plastics & Rubber',
  'Medical & Healthcare',
  'Food & Beverage',
  'Technology & Electronics',
  'Construction & Building',
  'Energy & Environment',
  'Automotive',
  'Packaging',
  'Textiles & Fashion',
  'Agriculture',
  'Security & Safety',
  'General',
];

export const findShowCountryOptions: FindShowFilterOption[] = [];

export const findShowCategoryOptions: FindShowFilterOption<FindShowsCategory>[] =
  findShowsCategories.map((category) => ({
    label: category,
    value: category,
  }));

const mappedFindShowEvents = (findShowsSeed as FindShowSeedRecord[])
  .map(toEvent)
  .sort((left, right) => left.startDate.localeCompare(right.startDate));

export const findShowEvents = mappedFindShowEvents.map((event, index, events) => {
  const baseSlug = event.slug;
  const firstIndex = events.findIndex((candidate) => candidate.slug === baseSlug);

  if (firstIndex === index) {
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

export const findShowStats = {
  totalEvents: findShowEvents.length,
  countries: findShowCountries.length,
  years: new Set(findShowEvents.map((event) => event.startDate.slice(0, 4))).size,
  germanyEvents: findShowEvents.filter((event) => event.country === 'Germany').length,
  ukEvents: findShowEvents.filter((event) => event.country === 'United Kingdom').length,
  usaEvents: findShowEvents.filter((event) => event.country === 'United States').length,
};

export type CountryStat = { country: string; count: number; flag: string };
export const countryStatsByRegion: Record<FindShowsRegion, CountryStat[]> = {
  'All Regions': [],
  'Americas': [],
  'Europe': [],
  'Africa & Middle East': [],
  'Asia-Pacific': [],
};

const counts: Record<string, number> = {};
findShowEvents.forEach(event => {
    counts[event.country] = (counts[event.country] || 0) + 1;
});

findShowCountries.forEach(country => {
    const region = getRegionForCountry(country);
    if (region && countryStatsByRegion[region]) {
        countryStatsByRegion[region].push({
            country,
            count: counts[country],
            flag: countryFlags[country] || '🌐'
        });
    }
});

// Sort countries within regions by event count descending
Object.keys(countryStatsByRegion).forEach(key => {
    countryStatsByRegion[key as FindShowsRegion].sort((a, b) => b.count - a.count);
});

