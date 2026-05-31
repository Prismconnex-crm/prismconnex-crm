import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const EVENTSEYE_BASE_URL = 'https://www.eventseye.com';
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_ATTEMPTS = 4;

const REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

const MONTHS = {
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

const HTML_ENTITIES = {
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
  bull: '*',
  middot: '*',
};

function parseArgs(argv) {
  const flags = {
    append: false,
    preview: false,
    limit: null,
    output: 'data/find-shows-seed.json',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--append') {
      flags.append = true;
      continue;
    }

    if (argument === '--preview') {
      flags.preview = true;
      continue;
    }

    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const key = argument.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    flags[key] = value;
    index += 1;
  }

  if (!flags.listingUrl) {
    throw new Error('Missing required flag --listingUrl');
  }

  if (!flags.country) {
    throw new Error('Missing required flag --country');
  }

  if (!flags.years) {
    throw new Error('Missing required flag --years');
  }

  if (flags.limit !== null && String(flags.limit).toLowerCase() !== 'all') {
    const numericLimit = Number(flags.limit);

    if (!Number.isInteger(numericLimit) || numericLimit <= 0) {
      throw new Error(`Invalid --limit value: ${flags.limit}`);
    }

    flags.limit = numericLimit;
  } else {
    flags.limit = null;
  }

  return flags;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => HTML_ENTITIES[name.toLowerCase()] ?? match);
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, ' ');
}

function cleanText(value) {
  return decodeHtmlEntities(stripTags(value)).replace(/\s+/g, ' ').trim();
}

function normalizeMonthToken(token) {
  return token.toLowerCase().replace(/\./g, '');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function toIsoDate(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function getMonthNumber(token, rawDates) {
  const month = MONTHS[normalizeMonthToken(token)];

  if (!month) {
    throw new Error(`Unsupported date format: ${rawDates}`);
  }

  return month;
}

function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function sanitizeDateText(rawDates) {
  return cleanText(rawDates).replace(/\s*\(\?\)\s*$/i, '').trim();
}

function parseDateParts(rawDates) {
  const normalized = sanitizeDateText(rawDates);

  const isoDate = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (isoDate) {
    const month = Number(isoDate[1]);
    const day = Number(isoDate[2]);
    const year = Number(isoDate[3]);
    const startDate = toIsoDate(year, month, day);

    return {
      startDate,
      endDate: startDate,
      startYear: year,
      approximate: false,
    };
  }

  const singleDay = normalized.match(/^(?:on\s+)?([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (singleDay) {
    const month = getMonthNumber(singleDay[1], rawDates);
    const year = Number(singleDay[3]);
    const startDate = toIsoDate(year, month, Number(singleDay[2]));

    return {
      startDate,
      endDate: startDate,
      startYear: year,
      approximate: false,
    };
  }

  const multiDay = normalized.match(/^([A-Za-z.]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})$/i);
  if (multiDay) {
    const month = getMonthNumber(multiDay[1], rawDates);
    const year = Number(multiDay[4]);

    return {
      startDate: toIsoDate(year, month, Number(multiDay[2])),
      endDate: toIsoDate(year, month, Number(multiDay[3])),
      startYear: year,
      approximate: false,
    };
  }

  const crossMonth = normalized.match(
    /^([A-Za-z.]+)\s+(\d{1,2})\s*-\s*([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
  );
  if (crossMonth) {
    const startMonth = getMonthNumber(crossMonth[1], rawDates);
    const endMonth = getMonthNumber(crossMonth[3], rawDates);
    const year = Number(crossMonth[5]);

    return {
      startDate: toIsoDate(year, startMonth, Number(crossMonth[2])),
      endDate: toIsoDate(year, endMonth, Number(crossMonth[4])),
      startYear: year,
      approximate: false,
    };
  }

  const monthOnly = normalized.match(/^(?:on\s+)?([A-Za-z.]+)\s+(\d{4})$/i);
  if (monthOnly) {
    const month = getMonthNumber(monthOnly[1], rawDates);
    const year = Number(monthOnly[2]);

    return {
      startDate: toIsoDate(year, month, 1),
      endDate: toIsoDate(year, month, getDaysInMonth(year, month)),
      startYear: year,
      approximate: true,
    };
  }

  throw new Error(`Unsupported date format: ${rawDates}`);
}

function parseStartDate(rawDates) {
  return parseDateParts(rawDates).startDate;
}

function normalizeComparableText(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

function resolveUrl(value) {
  const sanitizedValue = value.replace(/\s+/g, '');

  if (/^https?:\/\//i.test(sanitizedValue)) {
    return sanitizedValue;
  }

  if (sanitizedValue.startsWith('/')) {
    return new URL(sanitizedValue, EVENTSEYE_BASE_URL).toString();
  }

  return new URL(sanitizedValue, `${EVENTSEYE_BASE_URL}/fairs/`).toString();
}

function parseAttributes(rawAttributes) {
  const attributes = {};

  for (const match of rawAttributes.matchAll(/([:@a-z0-9_-]+)\s*=\s*"([^"]*)"/gi)) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2]);
  }

  return attributes;
}

function extractAnchors(html) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => ({
    attributes: parseAttributes(match[1]),
    text: cleanText(match[2]),
  }));
}

function extractImages(html) {
  return [...html.matchAll(/<img\b([^>]*?)\/?>/gi)].map((match) => ({
    attributes: parseAttributes(match[1]),
  }));
}

function getSection(html, startMarker, endMarker) {
  const startIndex = html.indexOf(startMarker);
  if (startIndex === -1) {
    return '';
  }

  const endIndex = endMarker ? html.indexOf(endMarker, startIndex) : -1;
  return html.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchHtml(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        if (attempt < FETCH_ATTEMPTS && response.status >= 500) {
          await sleep(attempt * 500);
          continue;
        }

        throw new Error(`Eventseye request failed for ${url}: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      return new TextDecoder('latin1').decode(buffer);
    } catch (error) {
      lastError = error;

      if (attempt === FETCH_ATTEMPTS) {
        break;
      }

      await sleep(attempt * 750);
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`Failed to fetch ${url}: ${lastError.message}`);
  }

  throw new Error(`Failed to fetch ${url}`);
}

function buildListingPageUrl(listingUrl, pageNumber) {
  const url = new URL(listingUrl);
  url.pathname = url.pathname.replace(/_(\d+)\.html$/, '.html');

  if (pageNumber > 1) {
    url.pathname = url.pathname.replace(/\.html$/, `_${pageNumber}.html`);
  }

  return url.toString();
}

function getListingPageCount(listingHtml) {
  const pageMatch = listingHtml.match(/<div class="pagenum"[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*<\/div>/i);
  return pageMatch ? Number(pageMatch[2]) : 1;
}

function extractListingRows(listingHtml) {
  const bodyMatch = listingHtml.match(
    /<table class="tradeshows">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i
  );
  if (!bodyMatch) {
    return [];
  }

  return [...bodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
    .map((match) => {
      const cells = [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
      const detailLinkMatch = cells[0]?.match(
        /<a href="([^"]*f-[^"]+\.html)">[\s\S]*?<b>([\s\S]*?)<\/b>/i
      );

      if (!detailLinkMatch) {
        return null;
      }

      return {
        detailUrl: resolveUrl(detailLinkMatch[1]),
        name: cleanText(detailLinkMatch[2]),
        listDate: cleanText(cells[3] ?? ''),
      };
    })
    .filter(Boolean);
}

function extractDateRows(detailHtml) {
  const tableMatch = detailHtml.match(
    /<table class="dates"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>\s*<\/table>/i
  );
  if (!tableMatch) {
    return [];
  }

  return [...tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((match) => {
    const cells = [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((cell) =>
      cleanText(cell[1])
    );

    return {
      dates: cells[0] ?? '',
      city: cells[1] ?? '',
      venue: cells[2] ?? '',
    };
  });
}

function extractCategories(detailHtml) {
  const industriesSection = getSection(
    detailHtml,
    '<div class="industries"',
    '<div class="ac-group">'
  );

  return extractAnchors(industriesSection)
    .map((anchor) => anchor.text)
    .filter(Boolean);
}

function extractImageUrl(detailHtml, predicate) {
  const image = extractImages(detailHtml).find(({ attributes }) => predicate(attributes));
  return image?.attributes.src ? resolveUrl(image.attributes.src) : null;
}

function extractContactInfo(detailHtml) {
  const organizersSection = getSection(detailHtml, '<div class="orgs"', '<div class="me-group">');
  const moreInfoSection = getSection(
    detailHtml,
    '<div class="more-info"',
    '<div class="error-reporting">'
  );

  const organizerAnchors = extractAnchors(organizersSection);
  const infoAnchors = extractAnchors(moreInfoSection);

  const officialWebsite =
    infoAnchors.find(
      ({ attributes, text }) =>
        (attributes.class ?? '').includes('ev-web') && text.toLowerCase() === 'official web site'
    )?.attributes.href ??
    organizerAnchors.find(({ attributes }) => (attributes.class ?? '').includes('ev-web'))
      ?.attributes.href ??
    null;

  const eventEmail =
    infoAnchors.find(
      ({ attributes, text }) =>
        (attributes.class ?? '').includes('ev-mail') &&
        text.toLowerCase().startsWith("event's e-mail") &&
        attributes.href?.toLowerCase().startsWith('mailto:') &&
        attributes.href !== 'mailto:'
    )?.attributes.href ??
    organizerAnchors.find(
      ({ attributes }) =>
        (attributes.class ?? '').includes('ev-mail') &&
        attributes.href?.toLowerCase().startsWith('mailto:') &&
        attributes.href !== 'mailto:'
    )?.attributes.href ??
    null;

  const organizer =
    organizerAnchors.find(({ attributes }) => (attributes.class ?? '').includes('orglink'))?.text ??
    '';

  return {
    organizer,
    website: officialWebsite,
    email: eventEmail ? eventEmail.replace(/^mailto:/i, '') : '',
  };
}

function getCountryLocationSuffix(country) {
  if (country.toLowerCase() === 'united kingdom') {
    return 'UK - United Kingdom';
  }

  if (country.toLowerCase() === 'united states') {
    return 'USA - United States';
  }

  return country;
}

function normalizeCity(rawCity, country) {
  const cleanedCity = cleanText(rawCity).replace(/\s*\(\?\)\s*$/i, '').trim();

  if (!cleanedCity || cleanedCity === '?' || cleanedCity.startsWith('? ')) {
    return `City to be announced (${getCountryLocationSuffix(country)})`;
  }

  if (cleanedCity.includes('(') && cleanedCity.includes(')')) {
    return cleanedCity;
  }

  return `${cleanedCity} (${getCountryLocationSuffix(country)})`;
}

function normalizeVenue(rawVenue) {
  const cleanedVenue = cleanText(rawVenue).replace(/\s*\(\?\)\s*$/i, '').trim();
  return !cleanedVenue || cleanedVenue === '?' ? 'Venue to be announced' : cleanedVenue;
}

function cityMatchesCountry(city, country) {
  const normalizedCity = normalizeComparableText(city);
  const aliases =
    country.toLowerCase() === 'united states'
      ? ['united states', 'usa', 'u s a']
      : country.toLowerCase() === 'united kingdom'
        ? ['united kingdom', 'uk', 'u k']
        : [country];

  return aliases.some((alias) => normalizedCity.includes(normalizeComparableText(alias)));
}

function parseDetailPage(detailHtml, fallbackName, allowedYears, country) {
  const dateRows = extractDateRows(detailHtml);
  const selectedRow =
    dateRows.find((row) => {
      try {
        return allowedYears.has(parseDateParts(row.dates).startYear);
      } catch {
        return false;
      }
    }) ??
    dateRows[0];

  if (!selectedRow) {
    throw new Error(`Missing date row for ${fallbackName}`);
  }

  const canonicalUrl =
    detailHtml.match(/<link rel="canonical" href="([^"]+)"/i)?.[1]?.trim() ?? null;
  const frequency =
    cleanText(
      detailHtml.match(/<div class="cycle"[\s\S]*?<h2>Cycle<\/h2>([\s\S]*?)<\/div>/i)?.[1] ?? ''
    ) || 'unknown';
  const { organizer, website, email } = extractContactInfo(detailHtml);
  const categories = extractCategories(detailHtml);
  const parsedDates = parseDateParts(selectedRow.dates);

  return {
    name: fallbackName,
    dates: cleanText(selectedRow.dates),
    city: normalizeCity(selectedRow.city, country),
    venue: normalizeVenue(selectedRow.venue),
    organizer,
    categories,
    frequency,
    website: website ?? canonicalUrl ?? '',
    email,
    eventseyeUrl: canonicalUrl,
    bannerUrl:
      extractImageUrl(detailHtml, (attributes) => (attributes.alt ?? '').startsWith('Venue for')) ??
      extractImageUrl(detailHtml, (attributes) => (attributes.alt ?? '').startsWith('logo for')) ??
      extractImageUrl(detailHtml, (attributes) =>
        (attributes.title ?? '').startsWith('All events from')
      ),
    logoUrl:
      extractImageUrl(detailHtml, (attributes) => (attributes.alt ?? '').startsWith('logo for')) ??
      extractImageUrl(detailHtml, (attributes) =>
        (attributes.title ?? '').startsWith('All events from')
      ) ??
      extractImageUrl(detailHtml, (attributes) => (attributes.alt ?? '').startsWith('Venue for')),
    approximateDate: parsedDates.approximate,
  };
}

function createRecordIdentity(record) {
  let startDate = '';

  try {
    startDate = parseStartDate(record.dates);
  } catch {
    startDate = normalizeComparableText(record.dates);
  }

  return `${normalizeComparableText(record.name)}|${normalizeComparableText(record.city)}|${startDate}`;
}

function buildIndexes(records) {
  const identities = new Map();
  const websites = new Map();
  const eventseyeUrls = new Map();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    identities.set(createRecordIdentity(record), index);

    if (record.website) {
      const normalizedWebsite = normalizeUrl(record.website);
      const existingIndexes = websites.get(normalizedWebsite) ?? [];
      existingIndexes.push(index);
      websites.set(normalizedWebsite, existingIndexes);
    }

    if (record.eventseyeUrl) {
      eventseyeUrls.set(normalizeUrl(record.eventseyeUrl), index);
    }
  }

  return { identities, websites, eventseyeUrls };
}

function looksLikeSameEvent(left, right) {
  const leftName = normalizeComparableText(left.name);
  const rightName = normalizeComparableText(right.name);
  const nameMatch =
    leftName === rightName || leftName.includes(rightName) || rightName.includes(leftName);

  if (!nameMatch) {
    return false;
  }

  try {
    return parseDateParts(left.dates).startYear === parseDateParts(right.dates).startYear;
  } catch {
    return false;
  }
}

function findMatchingRecord(candidate, records, indexes) {
  const normalizedEventseyeUrl = candidate.eventseyeUrl
    ? normalizeUrl(candidate.eventseyeUrl)
    : null;

  if (normalizedEventseyeUrl && indexes.eventseyeUrls.has(normalizedEventseyeUrl)) {
    return {
      index: indexes.eventseyeUrls.get(normalizedEventseyeUrl),
      reason: 'eventseyeUrl',
    };
  }

  const identity = createRecordIdentity(candidate);
  if (indexes.identities.has(identity)) {
    return {
      index: indexes.identities.get(identity),
      reason: 'identity',
    };
  }

  const normalizedWebsite = candidate.website ? normalizeUrl(candidate.website) : null;
  const websiteCandidates = normalizedWebsite ? indexes.websites.get(normalizedWebsite) ?? [] : [];
  const websiteMatch = websiteCandidates.find((recordIndex) =>
    looksLikeSameEvent(records[recordIndex], candidate)
  );

  if (websiteMatch !== undefined) {
    return {
      index: websiteMatch,
      reason: 'website',
    };
  }

  return null;
}

function registerRecord(record, index, indexes) {
  indexes.identities.set(createRecordIdentity(record), index);

  if (record.website) {
    const normalizedWebsite = normalizeUrl(record.website);
    const existingIndexes = indexes.websites.get(normalizedWebsite) ?? [];

    if (!existingIndexes.includes(index)) {
      existingIndexes.push(index);
      indexes.websites.set(normalizedWebsite, existingIndexes);
    }
  }

  if (record.eventseyeUrl) {
    indexes.eventseyeUrls.set(normalizeUrl(record.eventseyeUrl), index);
  }
}

function mergeEventseyeFields(existingRecord, candidate) {
  const existingCity = existingRecord.city?.trim() ?? '';
  const existingVenue = existingRecord.venue?.trim() ?? '';

  return {
    ...existingRecord,
    city:
      !existingCity || existingCity === '?' || existingCity.startsWith('? ')
        ? candidate.city
        : existingRecord.city,
    venue:
      !existingVenue || existingVenue === '?'
        ? candidate.venue
        : existingRecord.venue,
    eventseyeUrl: candidate.eventseyeUrl ?? existingRecord.eventseyeUrl ?? null,
    bannerUrl: candidate.bannerUrl ?? existingRecord.bannerUrl ?? null,
    logoUrl: candidate.logoUrl ?? existingRecord.logoUrl ?? null,
  };
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const leftDate = parseStartDate(left.dates);
    const rightDate = parseStartDate(right.dates);

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    if (left.name !== right.name) {
      return left.name.localeCompare(right.name);
    }

    return left.city.localeCompare(right.city);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const allowedYears = new Set(
    String(options.years)
      .split(/[,\-]/)
      .map((value) => Number(value.trim()))
      .filter(Number.isInteger)
  );

  const outputPath = path.resolve(options.output);
  const existingRecords = JSON.parse(await readFile(outputPath, 'utf8'));
  const nextRecords = options.append ? [...existingRecords] : [];
  const indexes = buildIndexes(nextRecords);
  const summary = {
    totalExistingRecords: existingRecords.length,
    totalRecords: 0,
    listingPages: 0,
    listingRows: 0,
    detailPagesInspected: 0,
    importedCount: 0,
    mergedCount: 0,
    approximateDateCount: 0,
    placeholderCityCount: 0,
    placeholderVenueCount: 0,
    skippedYearCount: 0,
    skippedCountryCount: 0,
    failedCount: 0,
  };

  const firstPageHtml = await fetchHtml(options.listingUrl);
  const pageCount = getListingPageCount(firstPageHtml);
  const importedRecords = [];
  const mergedRecords = [];
  const inspectedUrls = new Set();

  summary.listingPages = pageCount;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    if (options.limit !== null && importedRecords.length >= options.limit) {
      break;
    }

    let listingHtml = firstPageHtml;

    if (pageNumber !== 1) {
      try {
        listingHtml = await fetchHtml(buildListingPageUrl(options.listingUrl, pageNumber));
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('Eventseye request failed') &&
          error.message.includes(': 404')
        ) {
          break;
        }

        throw error;
      }
    }
    const rows = extractListingRows(listingHtml);
    summary.listingRows += rows.length;

    for (const row of rows) {
      if (
        inspectedUrls.has(row.detailUrl) ||
        (options.limit !== null && importedRecords.length >= options.limit)
      ) {
        continue;
      }

      inspectedUrls.add(row.detailUrl);
      summary.detailPagesInspected += 1;

      let candidate;

      try {
        const detailHtml = await fetchHtml(row.detailUrl);
        candidate = parseDetailPage(detailHtml, row.name, allowedYears, options.country);
      } catch (error) {
        summary.failedCount += 1;
        console.warn(error instanceof Error ? error.message : error);
        continue;
      }

      const parsedStart = parseDateParts(candidate.dates);

      if (!allowedYears.has(parsedStart.startYear)) {
        summary.skippedYearCount += 1;
        continue;
      }

      if (!cityMatchesCountry(candidate.city, options.country)) {
        summary.skippedCountryCount += 1;
        continue;
      }

      if (candidate.approximateDate) {
        summary.approximateDateCount += 1;
      }

      if (candidate.city.startsWith('City to be announced')) {
        summary.placeholderCityCount += 1;
      }

      if (candidate.venue === 'Venue to be announced') {
        summary.placeholderVenueCount += 1;
      }

      const match = findMatchingRecord(candidate, nextRecords, indexes);

      if (match) {
        const mergedRecord = mergeEventseyeFields(nextRecords[match.index], candidate);
        nextRecords[match.index] = mergedRecord;
        registerRecord(mergedRecord, match.index, indexes);
        mergedRecords.push({
          name: mergedRecord.name,
          dates: mergedRecord.dates,
          city: mergedRecord.city,
          eventseyeUrl: mergedRecord.eventseyeUrl,
          mergedBy: match.reason,
        });
        summary.mergedCount += 1;
        continue;
      }

      const recordToAppend = {
        name: candidate.name,
        dates: candidate.dates,
        city: candidate.city,
        venue: candidate.venue,
        organizer: candidate.organizer,
        categories: candidate.categories,
        frequency: candidate.frequency,
        website: candidate.website,
        email: candidate.email,
        eventseyeUrl: candidate.eventseyeUrl,
        bannerUrl: candidate.bannerUrl,
        logoUrl: candidate.logoUrl,
      };

      nextRecords.push(recordToAppend);
      registerRecord(recordToAppend, nextRecords.length - 1, indexes);
      importedRecords.push(recordToAppend);
      summary.importedCount += 1;
    }
  }

  if (options.limit !== null && importedRecords.length !== options.limit) {
    throw new Error(`Expected ${options.limit} unique records but found ${importedRecords.length}`);
  }

  const sortedRecords = sortRecords(nextRecords);
  summary.totalRecords = sortedRecords.length;

  if (options.preview) {
    console.log(
      JSON.stringify(
        {
          summary,
          importedRecords: importedRecords.map((record) => ({
            name: record.name,
            dates: record.dates,
            city: record.city,
            website: record.website,
            eventseyeUrl: record.eventseyeUrl,
          })),
          mergedRecords,
        },
        null,
        2
      )
    );
    return;
  }

  await writeFile(outputPath, `${JSON.stringify(sortedRecords, null, 2)}\n`, 'utf8');
  console.log(
    `Imported ${summary.importedCount} Eventseye records and merged ${summary.mergedCount} duplicates into ${outputPath}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
