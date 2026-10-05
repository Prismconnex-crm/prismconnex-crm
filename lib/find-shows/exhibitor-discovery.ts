/**
 * Finds an event edition's official exhibitor directory (rules in
 * exhibitors.ts, platforms in exhibitor-adapters/):
 *
 *  1. read the official website — falling back to the organizer's root domain
 *     when the catalog's subdomain no longer exists — and the pages it links
 *     about exhibitors; on an organizer site that hosts several shows, also
 *     this edition's own page (found through the site's search);
 *  2. let every adapter spot its platform on those pages;
 *  3. read each spotted directory, which checks its edition (show, year,
 *     dates, city) before returning a list;
 *  4. keep the best verified list — a platform-specific one over the generic
 *     organizer reader, then the larger.
 *
 * A network failure is never reported as "no exhibitors": it leaves the
 * search DISCOVERY_INCOMPLETE. The fetcher is injectable, so
 * tests/integration/exhibitors*.test.ts run offline.
 */
import { extractLinks, normalize, siteKey } from './floor-plan';
import { httpFetcher, type Fetcher } from './floor-plan-discovery';
import { sortCards, type EditionTarget, type ExhibitorDirectory, type ExhibitorFailure } from './exhibitors';
import {
  EXHIBITOR_ADAPTERS,
  HTML_ACCEPT,
  PAGE_LIMIT,
  adapterRank,
  httpPoster,
  isOk,
  retryingPoster,
  type Candidate,
  type Poster,
  type Lead,
  type OfficialPage,
} from './exhibitor-adapters';

export type ExhibitorDiscoveryOptions = {
  fetcher?: Fetcher;
  /** Form POSTs, for directories whose official pages load their cards that way. */
  poster?: Poster;
  /** Official pages read besides the home page. */
  maxPages?: number;
  now?: () => Date;
  /** Pause before retrying a request that got no answer (tests pass 0). */
  retryDelayMs?: number;
};

/** Official pages worth reading for a directory link: the exhibitor list, "exhibit", visitor pages. */
const DIRECTORY_PAGE =
  /exhibitor|exhibit\b|exhibit[-_/]|directory|aussteller|exposant|expositor|espositor|standhouder|wystawc|participant|katilimci|участник|экспонент|visit|attend|explore|floor[-_ ]?plan/i;
const NOT_DIRECTORY = /login|sign[-_]?in|register|registration|book[-_]?(?:a|your)?[-_]?(?:stand|booth)|why[-_]exhibit|sponsor|press|news|blog|privacy|terms|cookie|career|contact/i;
/** Organizer list pages resolved at most per search: each may page through many list pages. */
const MAX_ORGANIZER_LISTS = 4;

/** How likely a page is to link the directory: exhibitor lists first, then "exhibit" sections, then visitor pages. */
function directoryPageScore(url: string, text: string) {
  const path = url.replace(/^https?:\/\/[^/]+/i, '');
  let score = 0;
  // A dedicated exhibitor portal of the official site ("exhibitors.cphi.com/cpww26/") outranks pages about exhibiting.
  if (/^https?:\/\/(?:exhibitors?|aussteller|exposants?|espositori|expositores)\./i.test(url)) score += 6;
  if (/exhibitor|aussteller|exposant|expositor|espositor|standhouder|wystawc|directory|participant/i.test(path)) score += 4;
  if (/exhibitor|directory|aussteller|exposant/i.test(text)) score += 3;
  if (/(?:^|\/)exhibit(?:ion)?(?:[/?]|$)/i.test(path) || /^exhibit(?:ion)?$/i.test(text.trim())) score += 3;
  if (/floor[-_ ]?plan/i.test(`${path} ${text}`)) score += 1;
  return score;
}

/** The site answered but refused or lacks the page (403, 404, 410…), or its domain does not exist: not worth retrying soon. */
class Refused extends Error {}
class Transient extends Error {}

const withProtocol = (website: string) => (/^https?:\/\//i.test(website) ? website : `http://${website}`);

function directory(
  status: ExhibitorDirectory['status'],
  reason: string,
  now: Date,
  extra: Partial<Pick<ExhibitorDirectory, 'source' | 'exhibitors' | 'rejected' | 'total' | 'partial' | 'failure'>> = {}
): ExhibitorDirectory {
  return {
    ...(extra.failure ? { failure: extra.failure } : {}),
    status,
    reason,
    checkedAt: now.toISOString(),
    source: extra.source ?? null,
    exhibitors: extra.exhibitors ?? [],
    rejected: extra.rejected ?? [],
    total: extra.total ?? null,
    partial: extra.partial ?? false,
  };
}

/** Why a search could not finish, from its failure message: where it failed (the official site, or a directory found on it) and how. */
export function failureKind(message: string, stage: 'site' | 'directory'): ExhibitorFailure {
  if (/refuses automated|HTTP 40[13]\b|challenge|just a moment|access denied/i.test(message)) return 'BLOCKED';
  if (/HTTP 429\b|too many requests|rate.?limit/i.test(message)) return 'RATE_LIMITED';
  return stage === 'site' ? 'NETWORK_ERROR' : 'DOWNLOAD_FAILED';
}

/** "en.rastak-expo.com" → "http://rastak-expo.com": the organizer's root, when the catalog names a subdomain. */
export function rootDomainOf(website: string) {
  const url = new URL(withProtocol(website));
  const root = siteKey(url.toString());
  const host = url.hostname.replace(/^www\./, '');
  return host === root ? null : `${url.protocol}//${root}/`;
}

const NOT_RESOLVED = /ENOTFOUND|EAI_NONAME|EAI_AGAIN/;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One retry after a short pause for a request that got no answer at all:
 * DNS lookups and connections fail transiently under load, and such a
 * failure must never read as "no exhibitors".
 */
export function retrying(fetcher: Fetcher, delayMs = 1500): Fetcher {
  return async (url, options) => {
    try {
      return await fetcher(url, options);
    } catch {
      await pause(delayMs);
      return fetcher(url, options);
    }
  };
}

/** The site's own home page when the catalog names a deeper page ("big5global.com/events-eye-reg-boilerplate"). */
export function siteHomeOf(website: string) {
  const url = new URL(withProtocol(website));
  return url.pathname.replace(/\/+$/, '') || url.search ? `${url.protocol}//${url.host}/` : null;
}

/**
 * The official home page. When the catalog's address is gone, the site
 * itself is tried: a page that no longer exists (404/410) falls back to the
 * site's home page, and a subdomain that does not resolve ("en.rastak-expo.com")
 * to the organizer's root domain — the latter only counts once that root
 * answers (DNS can fail transiently). A site that refuses automated requests
 * (401/403, a bot challenge) was not checked, so that is an unfinished check,
 * never "no directory".
 */
async function readHome(website: string, fetcher: Fetcher): Promise<OfficialPage> {
  const attempt = async (url: string) => {
    let response;
    try {
      response = await fetcher(url, { accept: HTML_ACCEPT, ...PAGE_LIMIT });
    } catch (error) {
      throw new Transient((error as Error).message);
    }
    if (isOk(response.status)) return { url: response.url, html: response.body.toString('utf8') };
    if (response.status === 401 || response.status === 403) {
      throw new Transient(`the official website refuses automated requests (HTTP ${response.status})`);
    }
    const transient = response.status >= 500 || [408, 425, 429].includes(response.status);
    throw new (transient ? Transient : Refused)(`the official website answered HTTP ${response.status}`);
  };
  const address = withProtocol(website);
  try {
    return await attempt(address);
  } catch (error) {
    const unresolved = error instanceof Transient && NOT_RESOLVED.test(error.message);
    const fallbacks = [
      error instanceof Refused ? siteHomeOf(website) : null,
      unresolved || error instanceof Refused ? rootDomainOf(website) : null,
    ].filter((url, index, all): url is string => Boolean(url) && url !== address && all.indexOf(url) === index);
    for (const url of fallbacks) {
      try {
        return await attempt(url);
      } catch {
        // Try the next fallback; report the original failure if none answers.
      }
    }
    throw error;
  }
}

/**
 * On an organizer site hosting several shows, this edition's own page: the
 * site's search (WordPress exposes one) for the show's name, keeping results
 * whose title or address names this edition's year.
 */
async function editionPages(home: OfficialPage, target: EditionTarget, fetcher: Fetcher): Promise<string[]> {
  if (!/wp-content|wp-json/i.test(home.html)) return [];
  const words = normalize(target.name).split(' ').filter((word) => word.length >= 4 && !/^(?:expo|show|fair|trade|international|exhibition)$/.test(word));
  if (!words.length || normalize(home.html.slice(0, 400_000)).includes(normalize(target.name))) return [];
  const year = target.startDate.slice(0, 4);
  const origin = new URL(home.url).origin;
  const found = new Set<string>();
  for (const word of words.slice(0, 2)) {
    try {
      const response = await fetcher(`${origin}/wp-json/wp/v2/search?search=${encodeURIComponent(word)}&per_page=20`, { accept: 'application/json', ...PAGE_LIMIT });
      if (!isOk(response.status)) continue;
      const results = JSON.parse(response.body.toString('utf8')) as { url?: string; title?: string }[];
      for (const result of Array.isArray(results) ? results : []) {
        if (result.url && `${decodeURIComponent(result.url)} ${result.title ?? ''}`.includes(year)) found.add(result.url);
      }
    } catch {
      // The search is a bonus; the home page was read.
    }
  }
  return Array.from(found).slice(0, 3);
}

/** The official pages: the home page, its own links about exhibitors, and this edition's page on a multi-show site. */
async function officialPages(target: EditionTarget, fetcher: Fetcher, maxPages: number): Promise<OfficialPage[]> {
  const home = await readHome(target.website!, fetcher);
  const site = siteKey(home.url);
  const scores = new Map<string, number>();
  for (const link of extractLinks(home.html, home.url)) {
    const url = link.url.split('#')[0];
    if (link.tag !== 'a' || url === home.url || siteKey(url) !== site) continue;
    if (!DIRECTORY_PAGE.test(`${url} ${link.text}`) || NOT_DIRECTORY.test(url)) continue;
    scores.set(url, Math.max(scores.get(url) ?? 0, directoryPageScore(url, link.text)));
  }
  const urls = [
    ...(await editionPages(home, target, fetcher)),
    ...Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxPages)
      .map(([url]) => url),
  ];
  const pages: OfficialPage[] = [home];
  await Promise.all(
    Array.from(new Set(urls)).map(async (url) => {
      try {
        const response = await fetcher(url, { accept: HTML_ACCEPT, ...PAGE_LIMIT });
        if (isOk(response.status)) pages.push({ url: response.url, html: response.body.toString('utf8') });
      } catch {
        // A sub-page that fails leaves the others; the home page was read.
      }
    })
  );
  return pages;
}

/**
 * The event's own `exhibitors.<domain>` portal, when it has one: a subdomain
 * of the official site, so still an official source (dmg's portals redirect
 * it to the current edition's list, `…/gitex-global-2026/Exhibitor`).
 */
async function exhibitorSubdomain(homeUrl: string, fetcher: Fetcher): Promise<OfficialPage | null> {
  const site = siteKey(homeUrl);
  const home = new URL(homeUrl).hostname.replace(/^www\./, '');
  if (home.startsWith('exhibitors.')) return null;
  try {
    const response = await fetcher(`https://exhibitors.${site}/`, { accept: HTML_ACCEPT, ...PAGE_LIMIT });
    if (!isOk(response.status) || siteKey(response.url) !== site) return null;
    return { url: response.url, html: response.body.toString('utf8') };
  } catch {
    return null; // Most sites have no such subdomain.
  }
}

/** Every lead the adapters spot, once each; an address a platform adapter claims is not also read generically. */
function collectLeads(pages: OfficialPage[], target: EditionTarget, site: string): Lead[] {
  const leads = new Map<string, Lead>();
  for (const page of pages) {
    for (const adapter of EXHIBITOR_ADAPTERS) {
      for (const lead of adapter.detect(page, { site, target })) if (!leads.has(lead.key)) leads.set(lead.key, lead);
    }
  }
  const all = Array.from(leads.values());
  // Addresses a platform adapter reads (its lead is a URL, or a reference holding one) are not also read generically.
  const leadUrl = (lead: Lead) => {
    if (typeof lead.data === 'string') return lead.data;
    const data = (lead.data ?? {}) as { url?: unknown; listUrl?: unknown; pageUrl?: unknown };
    return data.url ?? data.listUrl ?? data.pageUrl;
  };
  const claimed = new Set(
    all
      .filter((lead) => lead.adapter !== 'organizer-directory')
      .map(leadUrl)
      .filter((url): url is string => typeof url === 'string')
      .map((url) => url.replace(/\/$/, ''))
  );
  const organizer = all
    .filter((lead) => lead.adapter === 'organizer-directory' && !claimed.has(String(lead.data).replace(/\/$/, '')))
    // Addresses that name an exhibitor list most plainly first.
    .sort((a, b) => Number(/exhibitor-?list|list-of-exhibitors|exhibitor-?directory|aussteller|exposants/i.test(String(b.data))) - Number(/exhibitor-?list|list-of-exhibitors|exhibitor-?directory|aussteller|exposants/i.test(String(a.data))))
    .slice(0, MAX_ORGANIZER_LISTS);
  return [...all.filter((lead) => lead.adapter !== 'organizer-directory'), ...organizer];
}

const listSize = (candidate: Extract<Candidate, { kind: 'list' }>) => candidate.total ?? candidate.exhibitors.length;

export async function discoverExhibitors(target: EditionTarget, options: ExhibitorDiscoveryOptions = {}): Promise<ExhibitorDirectory> {
  const fetcher = retrying(options.fetcher ?? httpFetcher, options.retryDelayMs);
  // A probe for a subdomain most sites lack is not retried.
  const probe = options.fetcher ?? httpFetcher;
  const now = (options.now ?? (() => new Date()))();
  if (!target.website) return directory('NO_VERIFIED_DIRECTORY', 'The event lists no official website.', now);

  let pages: OfficialPage[];
  try {
    pages = await officialPages(target, fetcher, options.maxPages ?? 8);
  } catch (error) {
    const status = error instanceof Refused ? 'NO_VERIFIED_DIRECTORY' : 'DISCOVERY_INCOMPLETE';
    const message = (error as Error).message;
    return directory(status, `The official website could not be read: ${message}.`, now, status === 'DISCOVERY_INCOMPLETE' ? { failure: failureKind(message, 'site') } : {});
  }
  const site = siteKey(pages[0].url);
  let leads = collectLeads(pages, target, site);
  if (!leads.some((lead) => lead.adapter !== 'organizer-directory')) {
    // No platform linked from the pages read (menus drawn by script link nothing):
    // look at the organizer's own exhibitor subdomain, where many portals live.
    const portal = await exhibitorSubdomain(pages[0].url, probe);
    if (portal) {
      pages.push(portal);
      leads = collectLeads(pages, target, site);
    }
  }
  const post = retryingPoster(options.poster ?? httpPoster, options.retryDelayMs);
  const context = { target, fetcher, post, site, pages };

  const candidates = await Promise.all(
    leads.map(async (lead): Promise<Candidate & { adapter: Lead['adapter'] }> => {
      const adapter = EXHIBITOR_ADAPTERS.find((item) => item.id === lead.adapter)!;
      try {
        return { ...(await adapter.resolve(lead, context)), adapter: lead.adapter };
      } catch (error) {
        return { kind: 'failed', reason: (error as Error).message, adapter: lead.adapter };
      }
    })
  );

  const rejected = candidates.flatMap((candidate) => (candidate.kind === 'rejected' ? [candidate.rejected] : []));
  const lists = candidates.flatMap((candidate) => (candidate.kind === 'list' ? [candidate] : []));
  if (lists.length) {
    const best = lists.reduce((a, b) => {
      const rank = adapterRank(a.adapter) - adapterRank(b.adapter);
      if (rank !== 0) return rank < 0 ? a : b;
      return listSize(b) > listSize(a) ? b : a;
    });
    const partial = best.total && best.total > best.exhibitors.length ? best.total : null;
    return directory(
      'VERIFIED_LIST',
      `${best.exhibitors.length}${partial ? ` of ${partial}` : ''} exhibitors from ${best.source.editionLabel} (${best.source.platformLabel}).`,
      now,
      { source: best.source, exhibitors: sortCards(best.exhibitors), rejected, total: partial, partial: !partial && Boolean(best.partial) }
    );
  }
  const login = candidates.find((candidate) => candidate.kind === 'login');
  if (login?.kind === 'login') {
    return directory('LOGIN_REQUIRED_DIRECTORY', `${login.source.editionLabel}'s directory on ${login.source.platformLabel} requires login.`, now, {
      source: login.source,
      rejected,
    });
  }
  const link = candidates.find((candidate) => candidate.kind === 'link');
  if (link?.kind === 'link') {
    return directory('OFFICIAL_DIRECTORY_LINK', `${link.source.editionLabel}'s official exhibitor directory is on the organizer's site and cannot be read here.`, now, {
      source: link.source,
      rejected,
    });
  }
  const failed = candidates.find((candidate) => candidate.kind === 'failed');
  if (failed?.kind === 'failed') {
    return directory('DISCOVERY_INCOMPLETE', `An exhibitor directory could not be read: ${failed.reason}.`, now, { rejected, failure: failureKind(failed.reason, 'directory') });
  }
  const empty = candidates.find((candidate) => candidate.kind === 'empty');
  if (empty?.kind === 'empty') {
    return directory('VERIFIED_EMPTY_DIRECTORY', `${empty.source.editionLabel}'s directory lists no exhibitors yet.`, now, { source: empty.source, rejected });
  }
  return directory(
    'NO_VERIFIED_DIRECTORY',
    rejected.length
      ? `No directory for this edition: ${rejected.map((item) => item.reason).join('; ')}.`
      : 'The official website publishes no exhibitor directory that could be read.',
    now,
    { rejected }
  );
}
