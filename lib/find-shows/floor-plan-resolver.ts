/**
 * Floor plans per event edition, for the event page's Floor Plan tab
 * (GET /api/find-shows/floor-plan) and the catalog-wide batch
 * (scripts/floor-plans). Discovery (floor-plan-discovery.ts) searches the
 * official sources; this module feeds it the catalog context and keeps what it
 * establishes in the edition store (floor-plan-store.ts).
 *
 * One search per edition: catalog records listing the same show on the same
 * site section, city and dates ("Melbourne Franchising Expo" and "Franchising
 * & Business Opportunities Expo", Melbourne, 2026-08-01) share a key.
 *
 * When the tab is opened, a stored answer is used while fresh:
 *
 *  - a verified plan: 30 days, and it stays the answer after that until a
 *    newer plan is verified (failures never replace it);
 *  - verified "none published": 3 days, 1 day within two months of the event,
 *    when organizers typically publish;
 *  - DISCOVERY_INCOMPLETE / NETWORK_ERROR / DOWNLOAD_FAILED: 30 minutes, then
 *    the next visit searches again.
 */
import type { FindShowEvent } from '@/types/find-shows';
import { findShowEvents } from './catalog';
import { cityName, siteKey, websiteDomain } from './floor-plan';
import { discoverFloorPlan, sectionOf, type DiscoveryInput, type DiscoveryOptions, type FloorPlanTrace } from './floor-plan-discovery';
import { effectiveResult, isTransient, mergeResult, readRecord, toStoredResult, writeRecord, type EditionRecord, type StoredEdition, type StoredResult } from './floor-plan-store';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// --- Catalog context ----------------------------------------------------------

let siteIndex: Map<string, FindShowEvent[]> | null = null;
let knownCities: Set<string> | null = null;

/** Catalog events by official site, and every catalog city — built once, on first use. */
function catalogContext() {
  if (!siteIndex || !knownCities) {
    siteIndex = new Map();
    knownCities = new Set();
    for (const event of findShowEvents) {
      const domain = websiteDomain(event.website);
      if (domain) {
        const site = siteKey(domain);
        const list = siteIndex.get(site) ?? [];
        list.push(event);
        siteIndex.set(site, list);
      }
      const city = cityName(event.city);
      if (city.length >= 4) knownCities.add(city);
    }
  }
  return { siteIndex, knownCities };
}

function siblingsOnSite(event: FindShowEvent) {
  const domain = websiteDomain(event.website);
  return domain ? catalogContext().siteIndex.get(siteKey(domain)) ?? [] : [];
}

/** The edition's identity: official site section + city + start date (not the catalog's wording of the name). */
export function editionKey(event: Pick<FindShowEvent, 'website' | 'city' | 'startDate'>) {
  const domain = websiteDomain(event.website) ?? 'none';
  return `${domain}${sectionOf(event.website) ?? ''}|${cityName(event.city)}|${event.startDate}`.toLowerCase();
}

/** What discovery needs to know about an event: the edition, and the site's other editions and cities. */
export function discoveryInput(event: FindShowEvent, extraWebsites: (string | null | undefined)[] = []): DiscoveryInput {
  const own = websiteDomain(event.website);
  const siblings = siblingsOnSite(event);
  const ownCity = cityName(event.city);
  const name = event.name.toLowerCase();
  return {
    name: event.name,
    startDate: event.startDate,
    endDate: event.endDate,
    city: event.city,
    country: event.country,
    venue: event.venue,
    organizer: event.organizer,
    frequency: event.frequency,
    website: event.website,
    extraWebsites: extraWebsites.filter((website): website is string => Boolean(website && websiteDomain(website) && websiteDomain(website) !== own)),
    otherCities: Array.from(new Set(siblings.map((sibling) => sibling.city).filter((city) => cityName(city) !== ownCity))),
    otherEventsOnSite: siblings.filter((sibling) => sibling.name.toLowerCase() !== name).length,
    // Same site, same city, same year, weeks apart: another edition (a phase or season), not a duplicate listing.
    sameCityYearEditions: new Set(
      siblings
        .filter((sibling) => cityName(sibling.city) === ownCity && sibling.startDate.slice(0, 4) === event.startDate.slice(0, 4))
        .filter((sibling) => Math.abs(Date.parse(sibling.startDate) - Date.parse(event.startDate)) > 20 * DAY)
        .map((sibling) => sibling.startDate)
    ).size,
    knownCities: catalogContext().knownCities,
  };
}

export function storedEdition(event: FindShowEvent, slugs: string[] = [event.slug]): StoredEdition {
  return {
    name: event.name,
    startDate: event.startDate,
    city: event.city,
    country: event.country,
    venue: event.venue,
    organizer: event.organizer,
    website: event.website,
    slugs,
  };
}

// --- Freshness ----------------------------------------------------------------

const age = (result: StoredResult) => Date.now() - Date.parse(result.checkedAt);

/** Whether a stored answer can be shown without searching again. */
export function isFresh(record: EditionRecord, startDate: string) {
  const answer = effectiveResult(record);
  if (answer.status === 'VERIFIED_PLAN') return age(answer) < 30 * DAY;
  if (answer.status === 'VERIFIED_NO_PLAN') {
    const daysToEvent = (Date.parse(startDate) - Date.now()) / DAY;
    return age(answer) < (daysToEvent >= 0 && daysToEvent < 60 ? 1 : 3) * DAY;
  }
  return age(record.lastAttempt) < 30 * 60 * 1000;
}

// --- Resolving ----------------------------------------------------------------

export type ResolvedFloorPlan = StoredResult & {
  /** True when served from the store without searching. */
  cached: boolean;
  /** The latest search, when it differs from the answer (e.g. a failed refresh of a verified plan). */
  lastAttempt?: { status: StoredResult['status']; reason: string; checkedAt: string };
  trace: FloorPlanTrace;
};

const inFlight = new Map<string, Promise<EditionRecord>>();

function answer(record: EditionRecord, cached: boolean): ResolvedFloorPlan {
  const result = effectiveResult(record);
  const latest = record.lastAttempt;
  return {
    ...result,
    cached,
    ...(latest !== result ? { lastAttempt: { status: latest.status, reason: latest.reason, checkedAt: latest.checkedAt } } : {}),
  };
}

/** Searches an edition now and stores the outcome (merged: a failure never erases a verified answer). */
export async function searchEdition(
  event: FindShowEvent,
  options: { slugs?: string[]; extraWebsites?: (string | null | undefined)[]; discovery?: DiscoveryOptions; revalidate?: boolean } = {}
): Promise<EditionRecord> {
  const key = editionKey(event);
  const running = inFlight.get(key);
  if (running) return running;
  const search = (async () => {
    const discovery = await discoverFloorPlan(discoveryInput(event, options.extraWebsites), options.discovery);
    const previous = await readRecord(key);
    const record = mergeResult(previous, key, storedEdition(event, options.slugs), toStoredResult(discovery), { revalidate: options.revalidate });
    await writeRecord(record).catch(() => undefined);
    return record;
  })();
  inFlight.set(key, search);
  try {
    return await search;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * This edition's floor plan: the stored answer while fresh, otherwise a new
 * search. `fresh` always searches (debug). `extraWebsites` are other addresses
 * of the official site, e.g. the contact website on the event's listing.
 */
export async function resolveFloorPlan(
  event: FindShowEvent,
  options: { fresh?: boolean; retry?: boolean; extraWebsites?: () => Promise<(string | null | undefined)[]> } = {}
): Promise<ResolvedFloorPlan> {
  const record = await readRecord(editionKey(event));
  // "Try again" searches an unsettled edition now (at most once a minute); a verified answer is never re-searched for it.
  const retryNow =
    options.retry && record && isTransient(effectiveResult(record).status) && Date.now() - Date.parse(record.lastAttempt.checkedAt) > 60_000;
  if (record && !options.fresh && !retryNow && isFresh(record, event.startDate)) return answer(record, true);
  // Other addresses of the site are looked up only when a search actually runs.
  const extraWebsites = options.extraWebsites ? await options.extraWebsites() : [];
  return answer(await searchEdition(event, { extraWebsites }), false);
}

/** The stored answer for an edition, without searching (for serving the plan file). */
export async function storedFloorPlan(event: FindShowEvent) {
  const record = await readRecord(editionKey(event));
  return record ? effectiveResult(record) : null;
}

export { isTransient };
