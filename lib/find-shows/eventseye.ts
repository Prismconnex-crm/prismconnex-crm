import { unstable_cache } from 'next/cache';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import type { FindShowAsset, FindShowDetail, FindShowEvent } from '@/types/find-shows';

const EVENTSEYE_BASE_URL = 'https://www.eventseye.com';
const EVENTSEYE_SEARCH_URL = 'https://www.eventseye.com/cgi-bin/tsearch.pl';

const EMPTY_FIND_SHOW_ASSET = {
  eventseyeUrl: null,
  bannerUrl: null,
  logoUrl: null,
} satisfies FindShowAsset;

const EMPTY_FIND_SHOW_DETAIL = {
  ...EMPTY_FIND_SHOW_ASSET,
  description: null,
  fullVenueAddress: null,
  visitorCount: null,
  exhibitorCount: null,
  website: null,
  lastUpdated: null,
} satisfies FindShowDetail;

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  nbsp: ' ',
  quot: '"',
  lt: '<',
  gt: '>',
  rsquo: "'",
  lsquo: "'",
  ldquo: '"',
  rdquo: '"',
  ndash: '-',
  mdash: '-',
  hellip: '...',
};

const requestHeaders = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => HTML_ENTITIES[name.toLowerCase()] ?? match);
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ');
}

function cleanText(value: string) {
  return decodeHtmlEntities(stripTags(value)).replace(/\s+/g, ' ').trim();
}

function normalizeComparableText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function fetchEventseyeText(url: string) {
  const response = await fetch(url, {
    headers: requestHeaders,
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error(`Eventseye request failed for ${url}: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new TextDecoder('latin1').decode(buffer);
}

function resolveEventseyeUrl(value: string) {
  const sanitizedValue = value.replace(/\s+/g, '');
  return new URL(sanitizedValue, EVENTSEYE_BASE_URL).toString();
}

function resolvePossibleUrl(value: string) {
  const sanitizedValue = value.trim();

  if (!sanitizedValue) {
    return null;
  }

  if (sanitizedValue.toLowerCase().startsWith('mailto:')) {
    return sanitizedValue;
  }

  if (/^https?:\/\//i.test(sanitizedValue)) {
    return sanitizedValue;
  }

  return resolveEventseyeUrl(sanitizedValue);
}

function extractSearchCandidates(html: string) {
  return Array.from(
    html.matchAll(
      /<a href="([^"]*\/(?:fairs|messen|ferias)\/f-[^"]+?\.html)">[\s\r\n\t]*<b>(.*?)<\/b>/gim
    )
  ).map((match) => ({
    url: resolveEventseyeUrl(match[1]),
    name: cleanText(match[2]),
  }));
}

function parseAttributes(rawAttributes: string) {
  const attributes: Record<string, string> = {};

  const matches = Array.from(rawAttributes.matchAll(/([:@a-z0-9_-]+)\s*=\s*"([^"]*)"/gi));
  for (const match of matches) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2]);
  }

  return attributes;
}

function extractAnchors(html: string) {
  return Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)).map((match) => ({
    attributes: parseAttributes(match[1]),
    text: cleanText(match[2]),
  }));
}

function extractImages(html: string) {
  return Array.from(html.matchAll(/<img\b([^>]*?)\/?>/gi)).map((match) => ({
    attributes: parseAttributes(match[1]),
  }));
}

function getSection(html: string, startMarker: string, endMarker: string) {
  const startIndex = html.indexOf(startMarker);
  if (startIndex === -1) {
    return '';
  }

  const endIndex = endMarker ? html.indexOf(endMarker, startIndex) : -1;
  return html.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

function toTextLines(sectionHtml: string) {
  return decodeHtmlEntities(
    sectionHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h\d|tr|td|table|strong|u)>/gi, '\n')
      .replace(/<(li|p|tr|div|h\d)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function uniqueLines(lines: string[]) {
  return lines.filter((line, index) => lines.indexOf(line) === index);
}

function extractMetaContent(html: string, metaName: string) {
  const match = html.match(
    new RegExp(`<meta\\s+name="${metaName}"\\s+content="([^"]+)"`, 'i')
  );
  return match?.[1] ? decodeHtmlEntities(match[1]) : null;
}

function extractCanonicalUrl(html: string, fallbackUrl: string | null) {
  return html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1]?.trim() ?? fallbackUrl;
}

function isCandidateMatch(candidateName: string, event: FindShowEvent) {
  const normalizedCandidate = normalizeComparableText(candidateName);
  const normalizedEventName = normalizeComparableText(event.name);

  return (
    normalizedCandidate === normalizedEventName ||
    normalizedCandidate.includes(normalizedEventName) ||
    normalizedEventName.includes(normalizedCandidate)
  );
}

function rankCandidates(candidates: Array<{ name: string; url: string }>, event: FindShowEvent) {
  return [...candidates].sort((left, right) => {
    const leftScore = Number(isCandidateMatch(left.name, event));
    const rightScore = Number(isCandidateMatch(right.name, event));
    return rightScore - leftScore;
  });
}

function extractImageUrl(
  detailHtml: string,
  predicate: (attributes: Record<string, string>) => boolean
) {
  const image = extractImages(detailHtml).find(({ attributes }) => predicate(attributes));
  return image?.attributes.src ? resolveEventseyeUrl(image.attributes.src) : null;
}

function extractContactWebsite(detailHtml: string) {
  const organizersSection = getSection(detailHtml, '<div class="orgs"', '<div class="me-group">');
  const moreInfoSection = getSection(
    detailHtml,
    '<div class="more-info"',
    '<div class="error-reporting">'
  );

  const organizerAnchors = extractAnchors(organizersSection);
  const infoAnchors = extractAnchors(moreInfoSection);

  const href =
    infoAnchors.find(
      ({ attributes, text }) =>
        (attributes.class ?? '').includes('ev-web') && text.toLowerCase() === 'official web site'
    )?.attributes.href ??
    organizerAnchors.find(({ attributes }) => (attributes.class ?? '').includes('ev-web'))
      ?.attributes.href ??
    null;

  return href ? resolvePossibleUrl(href) : null;
}

function extractDescription(detailHtml: string) {
  const descriptionSection =
    getSection(detailHtml, '<div class="description"', '<div class="industries"') ||
    getSection(detailHtml, '<div class="description"', '<div class="ac-group"');
  const descriptionText = uniqueLines(toTextLines(descriptionSection))
    .filter((line) => !/^description$/i.test(line))
    .join(' ');

  if (descriptionText) {
    return descriptionText;
  }

  const metaDescription = extractMetaContent(detailHtml, 'description');
  if (!metaDescription) {
    return null;
  }

  return metaDescription
    .replace(/^Dates\s*&\s*venues\s*for\s+.*?\s+-\s*/i, '')
    .replace(/^Dates\s+venues\s+for\s+.*?\s+-\s*/i, '')
    .trim();
}

function extractVenueAddress(detailHtml: string) {
  const venueSection = getSection(detailHtml, '<div class="venues"', '<div class="orgs"');
  if (!venueSection) {
    return null;
  }

  const lines = uniqueLines(toTextLines(venueSection));
  const stopPatterns = [
    /^web site$/i,
    /^e-mail$/i,
    /^google maps$/i,
    /^find a hotel/i,
    /^\+[\d\s().-]+$/,
    /^venue\(s\)$/i,
  ];

  const relevantLines: string[] = [];
  for (const line of lines) {
    if (stopPatterns.some((pattern) => pattern.test(line))) {
      if (relevantLines.length) {
        break;
      }
      continue;
    }

    relevantLines.push(line);
  }

  return relevantLines.length ? relevantLines.join(', ') : null;
}

function extractMetricValue(detailHtml: string, label: 'Visitors' | 'Exhibitors') {
  const normalizedText = cleanText(detailHtml);
  const patterns = [
    new RegExp(`${label}(?:\\s+number)?\\s*(?:\\|)?\\s*:?[\\s]*([0-9][0-9\\s.,]*)`, 'i'),
    new RegExp(`${label}(?:\\s+number)?[\\s]*([0-9][0-9\\s.,]*)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    const digits = match?.[1]?.replace(/[^\d]/g, '');

    if (digits) {
      return Number(digits);
    }
  }

  return null;
}

function extractLastUpdated(detailHtml: string) {
  const updateSection = getSection(detailHtml, '<div class="update"', '</div>');
  const cleanedUpdate = cleanText(updateSection)
    .replace(/^\(?\s*Last update:\s*/i, '')
    .replace(/\)?$/, '')
    .replace(/\b(\d{1,2})\s+(st|nd|rd|th)\b/i, '$1$2')
    .trim();

  return cleanedUpdate || null;
}

function extractDetailAsset(detailHtml: string, seedAsset: FindShowAsset) {
  const organizerImageUrl = extractImageUrl(
    detailHtml,
    (attributes) => (attributes.title ?? '').startsWith('All events from')
  );
  const logoUrl =
    extractImageUrl(detailHtml, (attributes) => (attributes.alt ?? '').startsWith('logo for')) ??
    seedAsset.logoUrl ??
    organizerImageUrl;
  const venueImageUrl = extractImageUrl(
    detailHtml,
    (attributes) => (attributes.alt ?? '').startsWith('Venue for')
  );
  const relatedImageUrl =
    extractImageUrl(detailHtml, (attributes) => {
      const src = attributes.src ?? '';
      return /\/(?:l|cy)\//i.test(src);
    }) ?? seedAsset.bannerUrl;

  return {
    eventseyeUrl: extractCanonicalUrl(detailHtml, seedAsset.eventseyeUrl),
    bannerUrl: venueImageUrl ?? relatedImageUrl ?? organizerImageUrl ?? logoUrl ?? null,
    logoUrl: logoUrl ?? relatedImageUrl ?? venueImageUrl ?? null,
  } satisfies FindShowAsset;
}

function hasResolvedAsset(asset: FindShowAsset) {
  return Boolean(asset.eventseyeUrl || asset.bannerUrl || asset.logoUrl);
}

function isEventseyeUrl(value: string | null | undefined) {
  return Boolean(value && /(^https?:\/\/)?(?:www\.)?eventseye\.com/i.test(value));
}

type FindShowDetailContext = Pick<FindShowEvent, 'seedAsset' | 'venue' | 'website'>;

export function parseFindShowDetailHtml(
  detailHtml: string,
  event: FindShowDetailContext
): FindShowDetail {
  const detailAsset = extractDetailAsset(detailHtml, event.seedAsset);
  const website =
    extractContactWebsite(detailHtml) ??
    (event.website && !isEventseyeUrl(event.website) ? resolvePossibleUrl(event.website) : null);

  return {
    ...detailAsset,
    description: extractDescription(detailHtml),
    fullVenueAddress: extractVenueAddress(detailHtml),
    visitorCount: extractMetricValue(detailHtml, 'Visitors'),
    exhibitorCount: extractMetricValue(detailHtml, 'Exhibitors'),
    website,
    lastUpdated: extractLastUpdated(detailHtml),
  };
}

async function resolveEventseyePage(event: FindShowEvent) {
  if (event.seedAsset.eventseyeUrl) {
    try {
      const detailHtml = await fetchEventseyeText(event.seedAsset.eventseyeUrl);
      return {
        url: extractCanonicalUrl(detailHtml, event.seedAsset.eventseyeUrl),
        detailHtml,
      };
    } catch {
      // Fall back to Eventseye search if the stored detail URL is stale.
    }
  }

  const searchTerms = [event.name, `${event.name} ${event.city}`, `${event.name} ${event.country}`];

  for (const term of searchTerms) {
    const searchUrl = `${EVENTSEYE_SEARCH_URL}?keywords=${encodeURIComponent(term)}&lang=1`;

    try {
      const searchHtml = await fetchEventseyeText(searchUrl);
      const candidates = rankCandidates(extractSearchCandidates(searchHtml), event);

      for (const candidate of candidates.slice(0, 3)) {
        try {
          const detailHtml = await fetchEventseyeText(candidate.url);
          return {
            url: extractCanonicalUrl(detailHtml, candidate.url),
            detailHtml,
          };
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function getSeedFindShowAsset(slug: string) {
  const event = findShowEventsBySlug[slug];

  if (!event || !hasResolvedAsset(event.seedAsset)) {
    return null;
  }

  return event.seedAsset;
}

export function getFindShowRegisterUrl(
  detail: Pick<FindShowDetail, 'website' | 'eventseyeUrl'>,
  event: Pick<FindShowEvent, 'website' | 'seedAsset'>
) {
  const detailWebsite = detail.website ? resolvePossibleUrl(detail.website) : null;
  const eventWebsite = event.website ? resolvePossibleUrl(event.website) : null;
  const officialWebsite = [detailWebsite, eventWebsite].find(
    (value): value is string => Boolean(value && !isEventseyeUrl(value))
  );

  return (
    officialWebsite ??
    detail.eventseyeUrl ??
    event.seedAsset.eventseyeUrl ??
    (eventWebsite && isEventseyeUrl(eventWebsite) ? eventWebsite : null) ??
    null
  );
}

const getCachedEventseyeDetail = unstable_cache(
  async (slug: string) => {
    const event = findShowEventsBySlug[slug];

    if (!event) {
      return EMPTY_FIND_SHOW_DETAIL;
    }

    const resolvedPage = await resolveEventseyePage(event);
    if (!resolvedPage) {
      return {
        ...EMPTY_FIND_SHOW_DETAIL,
        ...event.seedAsset,
        website: event.website && !isEventseyeUrl(event.website) ? event.website : null,
      } satisfies FindShowDetail;
    }

    return parseFindShowDetailHtml(resolvedPage.detailHtml, event);
  },
  ['find-show-eventseye-detail'],
  { revalidate: 60 * 60 * 24 }
);

const getCachedEventseyeAsset = unstable_cache(
  async (slug: string) => {
    const event = findShowEventsBySlug[slug];

    if (!event) {
      return EMPTY_FIND_SHOW_ASSET;
    }

    const seedAsset = getSeedFindShowAsset(slug);
    if (seedAsset) {
      return seedAsset;
    }

    const detail = await getCachedEventseyeDetail(slug);
    return {
      eventseyeUrl: detail.eventseyeUrl,
      bannerUrl: detail.bannerUrl,
      logoUrl: detail.logoUrl,
    } satisfies FindShowAsset;
  },
  ['find-show-eventseye-asset'],
  { revalidate: 60 * 60 * 24 }
);

export async function getFindShowAsset(slug: string) {
  return getCachedEventseyeAsset(slug);
}

export async function getFindShowDetail(slug: string) {
  return getCachedEventseyeDetail(slug);
}
