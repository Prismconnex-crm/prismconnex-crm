/**
 * Exact-edition resolver for Find Shows event start and end clock times.
 * Integrates store caching with official site discovery.
 */
import type { EventTimingResult, FindShowDetail, FindShowEvent } from '@/types/find-shows';
import {
  discoverEventTiming,
  cleanUrl,
  type TimingBudget,
  type TimingDiscoveryInput,
  type TimingFetcher,
} from './event-timing-discovery';
import {
  isTimingRecordFresh,
  mergeTimingRecord,
  readTimingRecord,
  writeTimingRecord,
  type StoredTimingRecord,
} from './event-timing-store';

export function websiteDomain(website: string | null | undefined): string {
  if (!website) return '';
  return website
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

export function sectionOf(website: string | null | undefined): string {
  if (!website) return '';
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length > 0 ? `/${parts[0]}` : '';
  } catch {
    return '';
  }
}

export function cityName(city: string | null | undefined): string {
  if (!city) return '';
  return city.split(/[(,-]/)[0].trim().toLowerCase();
}

/**
 * Stable edition key: domain + section + city + start date.
 * Duplicate catalog records (or shared domain listings for the exact same show edition)
 * share one key, while different years/editions receive distinct keys.
 */
export function timingEditionKey(
  event: Pick<FindShowEvent, 'website' | 'city' | 'startDate'>
): string {
  const domain = websiteDomain(event.website) || 'no-domain';
  const section = sectionOf(event.website);
  const city = cityName(event.city) || 'no-city';
  const start = event.startDate || 'no-date';
  return `${domain}${section}|${city}|${start}`.toLowerCase();
}

export type ResolveTimingOptions = {
  fetcher?: TimingFetcher;
  budget?: TimingBudget;
  /** Re-judge a stored verified time under the current rules (see mergeTimingRecord). */
  revalidate?: boolean;
};

// One search per edition at a time: concurrent requests for the same edition share it.
const inFlight = new Map<string, Promise<StoredTimingRecord>>();

/**
 * Searches the official sources for one edition now (ignoring freshness) and stores
 * the merged outcome. Used by resolveEventTiming and the catalog precompute.
 */
export function searchTimingEdition(
  event: FindShowEvent,
  detail?: FindShowDetail | null,
  options: ResolveTimingOptions = {}
): Promise<StoredTimingRecord> {
  const key = timingEditionKey(event);
  const running = inFlight.get(key);
  if (running) return running;

  const search = (async () => {
    const officialWebsite = cleanUrl(detail?.website) ?? cleanUrl(event.website);
    const extraWebsites = [detail?.website, event.website]
      .map(cleanUrl)
      .filter((w): w is string => Boolean(w && w !== officialWebsite));

    const input: TimingDiscoveryInput = {
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      city: event.city,
      website: officialWebsite,
      extraWebsites,
    };

    const result = await discoverEventTiming(input, options.fetcher, options.budget);
    const record = mergeTimingRecord(await readTimingRecord(key), result, key, {
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      city: event.city,
      website: officialWebsite ?? '',
    }, { revalidate: options.revalidate });
    await writeTimingRecord(record);
    return record;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, search);
  return search;
}

/**
 * Resolves event start and end timing for an event edition.
 * Serves the edition store while its record is fresh (see event-timing-store);
 * otherwise searches the official sources again.
 */
export async function resolveEventTiming(
  event: FindShowEvent,
  detail?: FindShowDetail | null,
  fetcherOrOptions?: TimingFetcher | ResolveTimingOptions
): Promise<EventTimingResult> {
  // If the event object already carries verified timing in-memory, return it
  if (event.timing && event.timing.status === 'VERIFIED_TIME') {
    return event.timing;
  }

  const options: ResolveTimingOptions =
    typeof fetcherOrOptions === 'function' ? { fetcher: fetcherOrOptions } : fetcherOrOptions ?? {};

  const cached = await readTimingRecord(timingEditionKey(event));
  if (cached && isTimingRecordFresh(cached)) {
    return cached;
  }

  return searchTimingEdition(event, detail, options);
}
