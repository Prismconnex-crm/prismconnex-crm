/**
 * Exhibitor directories per event edition, stored so a directory is not
 * rediscovered on every page view: one gzipped JSON record per edition under
 * .next/cache/find-shows-exhibitors/v2 (override with
 * FIND_SHOWS_EXHIBITOR_STORE), keyed like the floor plans — official site
 * section + city + start date — so catalog records listing the same edition
 * share one.
 *
 * A record keeps the last verified answer (a list, or a login-only directory)
 * apart from the latest attempt. A later failure never replaces it, nor does a
 * later "not found" (a site that stopped linking a past edition's directory):
 * it is still that edition's list — unless a later search rejects that same
 * directory as another edition (see mergeAttempt). How long an answer is used before the next
 * visit refreshes it:
 *
 *  - a verified list or login-only directory: 24 hours (exhibitors keep being added);
 *  - no verified directory: 3 days, 1 day within two months of the event;
 *  - DISCOVERY_INCOMPLETE: 30 minutes.
 */
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { gunzipSync, gzipSync } from 'zlib';
import type { FindShowEvent } from '@/types/find-shows';
import { findShowEvents } from './catalog';
import { catalogueCardForDisplay } from './exhibitor-adapters/brand-card-catalogue';
import { discoverExhibitors, type ExhibitorDiscoveryOptions } from './exhibitor-discovery';
import { cleanCards, isAnotherEdition, markSharedProfileLinks, sameShow, type EditionTarget, type ExhibitorDirectory } from './exhibitors';
import { cityName, normalize, websiteDomain } from './floor-plan';
import { editionKey } from './floor-plan-resolver';

export const EXHIBITOR_STORE_VERSION = 'v2';

export function exhibitorStoreDir() {
  return process.env.FIND_SHOWS_EXHIBITOR_STORE ?? path.join(process.cwd(), '.next', 'cache', 'find-shows-exhibitors', EXHIBITOR_STORE_VERSION);
}

export type ExhibitorRecord = {
  key: string;
  edition: { name: string; startDate: string; city: string; website: string; slugs: string[] };
  /** The last VERIFIED_LIST or LOGIN_REQUIRED_DIRECTORY; sticky. */
  verified: ExhibitorDirectory | null;
  lastAttempt: ExhibitorDirectory;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const isVerified = (result: ExhibitorDirectory) => result.status === 'VERIFIED_LIST' || result.status === 'LOGIN_REQUIRED_DIRECTORY';

/** What the tab shows: the verified answer when there is one, else the latest attempt. */
export function effectiveDirectory(record: ExhibitorRecord): ExhibitorDirectory {
  return record.verified ?? record.lastAttempt;
}

/**
 * Whether a search turned down the very directory a record holds as verified — same platform, same edition
 * name — as another edition of the show (another region's: "IAAPA Expo 2026" for IAAPA Expo Europe; another
 * stop of a touring show). The stored list was never this edition's. Any other rejection — a page now
 * announcing next year's dates — leaves it: it is still that edition's list.
 */
function rejectsVerified(verified: ExhibitorDirectory | null | undefined, attempt: ExhibitorDirectory) {
  const source = verified?.source;
  if (!source) return false;
  const label = normalize(source.editionLabel);
  return (attempt.rejected ?? []).some((item) => item.platform === source.platform && normalize(item.label) === label && isAnotherEdition(item.reason));
}

export function mergeAttempt(previous: ExhibitorRecord | null, next: Omit<ExhibitorRecord, 'verified' | 'lastAttempt'>, attempt: ExhibitorDirectory): ExhibitorRecord {
  const kept = previous?.verified && !rejectsVerified(previous.verified, attempt) ? previous.verified : null;
  return {
    ...next,
    verified: isVerified(attempt) ? attempt : kept,
    // The cards live once, in `verified`; the attempt keeps only its status, time and reason.
    lastAttempt: isVerified(attempt) ? { ...attempt, exhibitors: [] } : attempt,
  };
}

/** Whether the stored answer is still recent enough to serve without searching again. */
export function isFresh(record: ExhibitorRecord, startDate: string, now = Date.now()) {
  const age = now - Date.parse(record.lastAttempt.checkedAt);
  if (record.verified || isVerified(record.lastAttempt)) return age < DAY;
  if (record.lastAttempt.status === 'DISCOVERY_INCOMPLETE') return age < 30 * 60 * 1000;
  const untilEvent = Date.parse(startDate) - now;
  return age < (untilEvent < 60 * DAY ? DAY : 3 * DAY);
}

const fileFor = (key: string) => path.join(exhibitorStoreDir(), `${createHash('sha1').update(key).digest('hex')}.json.gz`);

export async function readExhibitorRecord(key: string): Promise<ExhibitorRecord | null> {
  try {
    const record = JSON.parse(gunzipSync(await readFile(fileFor(key))).toString('utf8')) as ExhibitorRecord;
    return record.key === key ? record : null;
  } catch {
    return null;
  }
}

export async function writeExhibitorRecord(record: ExhibitorRecord) {
  const file = fileFor(record.key);
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, gzipSync(JSON.stringify(record)));
  await rename(temp, file);
}

let eventsByHost: Map<string, FindShowEvent[]> | null = null;

/**
 * Catalog events on the same official host (built once): what else a
 * directory there could belong to. By host, not registrable domain: fair
 * grounds give each show its own subdomain (hammaslaakaripaivat.messukeskus.com).
 */
function hostSiblings(event: FindShowEvent) {
  if (!eventsByHost) {
    eventsByHost = new Map();
    for (const item of findShowEvents) {
      const host = websiteDomain(item.website);
      if (host) eventsByHost.set(host, [...(eventsByHost.get(host) ?? []), item]);
    }
  }
  const host = websiteDomain(event.website);
  return host ? (eventsByHost.get(host) ?? []).filter((item) => item.slug !== event.slug) : [];
}

let eventsByDate: Map<string, FindShowEvent[]> | null = null;

/** Other catalog shows opening the same day in the same city (built once): co-located shows that may share a directory. */
function coLocatedShows(event: FindShowEvent) {
  if (!eventsByDate) {
    eventsByDate = new Map();
    for (const item of findShowEvents) eventsByDate.set(item.startDate, [...(eventsByDate.get(item.startDate) ?? []), item]);
  }
  const ownCity = cityName(event.city);
  const ownName = normalize(event.name);
  return (eventsByDate.get(event.startDate) ?? []).filter(
    (item) => item.slug !== event.slug && cityName(item.city) === ownCity && normalize(item.name) !== ownName && Boolean(item.website)
  );
}

/** The catalog record as the edition discovery checks directories against, with the other shows and cities its site hosts. */
export function editionTarget(event: FindShowEvent): EditionTarget {
  const siblings = hostSiblings(event);
  const ownCity = cityName(event.city);
  const ownName = normalize(event.name);
  return {
    name: event.name,
    startDate: event.startDate,
    city: event.city,
    venue: event.venue,
    website: event.website,
    approximate: /\(\?\)/.test(event.dates),
    otherCities: Array.from(new Set(siblings.map((item) => item.city).filter((city) => cityName(city) && cityName(city) !== ownCity))),
    otherShows: Array.from(new Set(siblings.map((item) => item.name).filter((name) => normalize(name) !== ownName))),
    coLocated: coLocatedShows(event).map((item) => ({ name: item.name, website: item.website })),
    touringEditions: siblings
      .filter((item) => cityName(item.city) && cityName(item.city) !== ownCity && sameShow(event, item))
      .map((item) => ({ city: item.city, startDate: item.startDate })),
  };
}

export type ResolvedExhibitors = ExhibitorDirectory & {
  cached: boolean;
  /** A stored verified list is shown while a background search refreshes it. */
  refreshing?: boolean;
  /** The search is still running; ask again shortly. */
  pending?: boolean;
};

const inFlight = new Map<string, Promise<ExhibitorRecord>>();

async function search(event: FindShowEvent, key: string, previous: ExhibitorRecord | null, options: ExhibitorDiscoveryOptions, slugs: string[] = []) {
  const attempt = await discoverExhibitors(editionTarget(event), options);
  const record = mergeAttempt(
    previous,
    {
      key,
      edition: {
        name: event.name,
        startDate: event.startDate,
        city: event.city,
        website: event.website,
        slugs: Array.from(new Set([...(previous?.edition.slugs ?? []), event.slug, ...slugs])),
      },
    },
    attempt
  );
  await writeExhibitorRecord(record).catch(() => undefined);
  return record;
}

/**
 * One edition searched now and stored exactly as the Exhibitors tab's own search would (a verified
 * list is never replaced by a failed refresh): what the catalog-wide batch runs. `slugs` are the
 * catalog records listing this edition.
 */
export async function searchEditionExhibitors(event: FindShowEvent, slugs: string[], options: ExhibitorDiscoveryOptions = {}) {
  const key = editionKey(event);
  return search(event, key, await readExhibitorRecord(key), options, slugs);
}

/** The edition's exhibitor directory: the stored answer while fresh, else a new search (one at a time per edition). */
export type ResolveOptions = ExhibitorDiscoveryOptions & {
  /** Search again whatever is stored (development only). */
  refresh?: boolean;
  /** The visitor pressed "Try again": search again if the stored answer is an unfinished check. Never touches a verified list. */
  retry?: boolean;
  /** Answer within this long; a search still running then keeps going and stores its result for the next request. */
  waitMs?: number;
};

/** The edition's search, started once and shared by every request that needs it. */
function searchOnce(event: FindShowEvent, key: string, stored: ExhibitorRecord | null, options: ExhibitorDiscoveryOptions) {
  let pending = inFlight.get(key);
  if (!pending) {
    pending = search(event, key, stored, options).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

const STILL_CHECKING = Symbol('still checking');

/**
 * The edition's exhibitor directory, on demand — the Exhibitors tab calls
 * this when opened:
 *
 *  - a stored answer still fresh is returned at once;
 *  - a stored verified list past its refresh time is also returned at once,
 *    while a new search refreshes it in the background (a failed refresh
 *    keeps it: see mergeAttempt);
 *  - otherwise the official directory is searched now. If that takes longer
 *    than `waitMs`, the answer is "still checking" (`pending`), and the
 *    search carries on and stores its result for the tab's next request.
 */
export async function resolveExhibitors(event: FindShowEvent, options: ResolveOptions = {}): Promise<ResolvedExhibitors> {
  const key = editionKey(event);
  const stored = await readExhibitorRecord(key);
  // A search already running for this edition (a "Try again", a refresh) is what the visitor is waiting
  // for: follow it rather than replay an older, unverified answer.
  const running = inFlight.has(key) && !stored?.verified;
  if (stored && !options.refresh && !running) {
    const answer = effectiveDirectory(stored);
    const retrying = options.retry && answer.status === 'DISCOVERY_INCOMPLETE';
    if (isFresh(stored, event.startDate) && !retrying) return { ...answer, cached: true };
    if (stored.verified) {
      void searchOnce(event, key, stored, options).catch(() => undefined);
      return { ...stored.verified, cached: true, refreshing: true };
    }
  }
  const pending = searchOnce(event, key, stored, options);
  const winner = options.waitMs
    ? await Promise.race([pending, new Promise<typeof STILL_CHECKING>((resolve) => setTimeout(() => resolve(STILL_CHECKING), options.waitMs))])
    : await pending;
  if (winner === STILL_CHECKING) {
    // Keep the search's eventual failure from surfacing as an unhandled rejection.
    pending.catch(() => undefined);
    return {
      status: 'DISCOVERY_INCOMPLETE',
      reason: 'Still checking the official exhibitor directory.',
      checkedAt: new Date().toISOString(),
      source: null,
      exhibitors: [],
      rejected: [],
      cached: false,
      pending: true,
    };
  }
  return { ...effectiveDirectory(winner), cached: false };
}

/** The stored directory for an edition, without searching (null when none is stored yet). */
export async function storedExhibitors(event: FindShowEvent): Promise<ExhibitorDirectory | null> {
  const record = await readExhibitorRecord(editionKey(event));
  return record ? effectiveDirectory(record) : null;
}

/**
 * Platforms whose logo files refuse to load on other sites (Map Your Show sends
 * Cross-Origin-Resource-Policy: same-site): their cards point at this site's
 * logo route instead, which serves the stored card's own logo.
 */
const PROXIED_LOGOS = new Set(['map-your-show']);

export function withDisplayLogos(directory: ExhibitorDirectory, slug: string): ExhibitorDirectory {
  if (!directory.source || !PROXIED_LOGOS.has(directory.source.platform)) return directory;
  return {
    ...directory,
    exhibitors: directory.exhibitors.map((card) =>
      card.logoUrl
        ? { ...card, logoUrl: `/api/find-shows/exhibitors/logo?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(card.id)}` }
        : card
    ),
  };
}

/** Every list as cards should be shown, whenever it was stored (see cleanCards, markSharedProfileLinks). */
export function withCleanCards(directory: ExhibitorDirectory): ExhibitorDirectory {
  if (!directory.exhibitors.length) return directory;
  return { ...directory, exhibitors: markSharedProfileLinks(cleanCards(directory.exhibitors)) };
}

/** Brand-card catalogue lists stored before their cards searched the catalogue: shown as cards are built now. */
export function withCatalogueLinks(directory: ExhibitorDirectory): ExhibitorDirectory {
  const source = directory.source;
  if (!source || source.platform !== 'brand-card-catalogue') return directory;
  return { ...directory, exhibitors: directory.exhibitors.map((card) => catalogueCardForDisplay(card, source.directoryUrl)) };
}
