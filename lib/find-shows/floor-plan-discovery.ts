/**
 * Finds an event edition's floor plan on its official sources (rules in
 * floor-plan.ts). One search per event, run when its Floor Plan tab is opened:
 *
 *  1. the official website as listed (and its home page, if the listing is a
 *     deep link), following redirects to wherever the site now lives;
 *  2. in parallel: the site's sitemaps (robots.txt → sitemap index → pages and
 *     documents), WordPress's media library search (where plans are uploaded),
 *     and — when enabled — a web search for the event name + year/city/venue/
 *     organizer + "floor plan"/"exhibitor manual", whose results count only on
 *     the official site, a site it links as organizer/venue, or a file host
 *     named after it;
 *  3. a best-first crawl of related official pages — exhibitor information,
 *     manuals/kits, downloads, floor-plan pages, pages naming the edition's
 *     year or city, organizer/venue pages about the event — never pages about
 *     other cities or years;
 *  4. every floor-plan candidate found (PDFs, images, interactive plans,
 *     plan pages, exhibitor manuals that contain the plan, and this-year
 *     versions of other editions' plan files) is opened and judged against the
 *     edition, best evidence first.
 *
 * The result says which of three things happened: a plan was found and
 * verified; the official sources were searched through and none verified
 * ("not-found"); or the search could not finish — the site was unreachable or
 * the budget ran out with relevant pages or candidates left ("incomplete").
 * Only "not-found" means the tab may say none has been published. Every page,
 * query and candidate — and why each candidate was accepted or rejected — is
 * recorded in the trace for the debug view.
 */
import {
  blocksFraming,
  carriesBrand,
  duckDuckGoResults,
  editionDates,
  editionProfile,
  extractLinks,
  floorPlanKind,
  floorPlanMentions,
  decorationFile,
  imageSize,
  looksLikePhoto,
  isGenericLinkText,
  isInteractivePlanUrl,
  judgeCandidate,
  namesExhibitorInfo,
  namesFloorPlan,
  namesManual,
  namesNotPlan,
  normalize,
  originalImageUrl,
  pageHeadline,
  pageText,
  pdfMetadata,
  pdfText,
  saysPlanComingSoon,
  predatesPreviousEdition,
  readEvidence,
  robotsSitemaps,
  sameLocationForYear,
  siteBrand,
  siteKey,
  sitemapLocations,
  unlikelyPlanImage,
  uploadFolderDate,
  urlWords,
  websiteDomain,
  withoutUploadFolder,
  wordPressMedia,
  type EditionProfile,
  type FindShowFloorPlan,
  type FloorPlanEvent,
  type FloorPlanKind,
  type PageLink,
  type SearchResult,
  type Verdict,
} from './floor-plan';

// --- Fetching -----------------------------------------------------------------

export type Fetched = {
  /** Final URL after redirects. */
  url: string;
  status: number;
  contentType: string;
  headers: Record<string, string>;
  body: Buffer;
  /** True when the body was cut at maxBytes. */
  truncated: boolean;
};

export type FetchOptions = { accept: string; timeoutMs: number; maxBytes: number; headers?: Record<string, string> };
/** Throws on network errors and timeouts; returns non-2xx responses. */
export type Fetcher = (url: string, options: FetchOptions) => Promise<Fetched>;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Prismconnex-FindShows/1.0';

export const httpFetcher: Fetcher = async (url, { accept, timeoutMs, maxBytes, headers: extraHeaders }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'en;q=1, *;q=0.5', ...extraHeaders },
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
        size += value.byteLength;
        if (size >= maxBytes) {
          truncated = true;
          await reader.cancel().catch(() => undefined);
          break;
        }
      }
    }
    return {
      url: response.url || url,
      status: response.status,
      contentType: (headers['content-type'] ?? '').toLowerCase(),
      headers,
      body: Buffer.concat(chunks),
      truncated,
    };
  } catch (error) {
    // "fetch failed" alone hides whether DNS, the connection or the TLS handshake failed: name the cause.
    const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
    const detail = cause?.code ?? cause?.message;
    const message = error instanceof Error ? error.message : String(error);
    throw new NetworkError(detail && !message.includes(detail) ? `${message} (${detail})` : message);
  } finally {
    clearTimeout(timer);
  }
};

/** A request that never got an answer (DNS, connection, timeout): says nothing about what the site holds. */
export class NetworkError extends Error {
  name = 'NetworkError';
}

/** Responses that mean "try later", not "this is not here". */
const TRANSIENT_STATUS = /^(?:408|425|429|5\d\d)$/;

export type SearchProvider = { name: string; search: (query: string) => Promise<SearchResult[]> };

/**
 * Keyless search engines throttle bursts: one query at a time across the
 * process, spaced out, and a cool-down after the engine pushes back.
 */
const searchGate = { last: 0, chain: Promise.resolve() as Promise<unknown>, pausedUntil: 0 };
const SEARCH_SPACING_MS = 2_500;
const SEARCH_COOLDOWN_MS = 10 * 60_000;

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = searchGate.chain.then(async () => {
    if (Date.now() < searchGate.pausedUntil) throw new Error('search provider is cooling down after rate-limiting');
    const wait = searchGate.last + SEARCH_SPACING_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    searchGate.last = Date.now();
    try {
      return await task();
    } catch (error) {
      if (/HTTP (?:202|403|429)|rate-limit/.test(String(error))) searchGate.pausedUntil = Date.now() + SEARCH_COOLDOWN_MS;
      throw error;
    }
  });
  searchGate.chain = run.catch(() => undefined);
  return run;
}

/** DuckDuckGo's HTML results page: keyless. */
export function duckDuckGoSearch(fetcher: Fetcher = httpFetcher): SearchProvider {
  return {
    name: 'duckduckgo',
    search: (query) => throttled(async () => {
      const response = await fetcher(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        accept: 'text/html',
        timeoutMs: 12_000,
        maxBytes: 1_500_000,
      });
      if (response.status !== 200) throw new Error(`search returned HTTP ${response.status}`);
      const html = response.body.toString('utf8');
      const results = duckDuckGoResults(html);
      if (!results.length && /anomaly|captcha|unusual traffic/i.test(html)) throw new Error('search provider rate-limited the query');
      return results;
    }),
  };
}

/** Brave Search API, when BRAVE_SEARCH_API_KEY is set. */
export function braveSearch(apiKey: string): SearchProvider {
  return {
    name: 'brave',
    async search(query) {
      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?count=20&q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`search returned HTTP ${response.status}`);
      const body = (await response.json()) as { web?: { results?: { url: string; title?: string; description?: string }[] } };
      return (body.web?.results ?? []).map((result) => ({
        url: result.url,
        title: (result.title ?? '').replace(/<[^>]+>/g, ''),
        snippet: (result.description ?? '').replace(/<[^>]+>/g, ''),
      }));
    },
  };
}

/** The configured web search: Brave with a key, DuckDuckGo without, none when FIND_SHOWS_FLOOR_PLAN_SEARCH=off. */
export function defaultSearchProvider(): SearchProvider | null {
  if ((process.env.FIND_SHOWS_FLOOR_PLAN_SEARCH ?? '').toLowerCase() === 'off') return null;
  const brave = process.env.BRAVE_SEARCH_API_KEY;
  return brave ? braveSearch(brave) : duckDuckGoSearch();
}

// --- Trace --------------------------------------------------------------------

export type TraceSource = {
  url: string;
  via: string;
  status: 'ok' | 'error' | 'skipped';
  note: string;
  ms?: number;
};

export type TraceCandidate = {
  url: string;
  kind: FloorPlanKind;
  via: string;
  foundOn: string;
  decision: 'accepted' | 'rejected' | 'unchecked';
  reason: string;
  evidence: string[];
};

export type TraceQuery = { query: string; provider: string; results: number; used: string[]; ignored: number; error?: string };

/**
 * What a search established. Only VERIFIED_NO_PLAN means "none has been
 * published": every other failure leaves the question open.
 *
 *  - VERIFIED_PLAN: a plan verified as this edition's.
 *  - VERIFIED_NO_PLAN: the official sources were read through; nothing that
 *    could be this edition's plan is published (other editions' and other
 *    cities' plans, non-plans, "coming soon" pages are all definitive).
 *  - DISCOVERY_INCOMPLETE: the search could not settle it — the site blocks
 *    automated access or is gone, the budget ran out with relevant pages or
 *    candidates left, or plans were found whose edition cannot be verified.
 *  - NETWORK_ERROR: the official site or a floor-plan page could not be
 *    reached (DNS, timeout, connection, server error).
 *  - DOWNLOAD_FAILED: a floor-plan candidate was found but could not be
 *    downloaded to verify it.
 */
export type FloorPlanStatus = 'VERIFIED_PLAN' | 'VERIFIED_NO_PLAN' | 'DISCOVERY_INCOMPLETE' | 'NETWORK_ERROR' | 'DOWNLOAD_FAILED';

export type FloorPlanTrace = {
  event: {
    name: string;
    year: string;
    dates: string;
    city: string;
    country: string;
    venue: string;
    organizer: string;
    website: string;
    otherCitiesOnSite: string[];
  };
  officialSites: string[];
  relatedSites: { site: string; role: string }[];
  queries: TraceQuery[];
  sources: TraceSource[];
  candidates: TraceCandidate[];
  outcome: FloorPlanStatus;
  outcomeReason: string;
  pagesFetched: number;
  candidatesChecked: number;
  ms: number;
  checkedAt: string;
};

export type FloorPlanDiscovery = {
  status: FloorPlanStatus;
  floorPlan: FindShowFloorPlan | null;
  trace: FloorPlanTrace;
};

// --- Discovery ----------------------------------------------------------------

export type DiscoveryInput = FloorPlanEvent & {
  website: string;
  /** Other known addresses of the official site (e.g. the contact website on its listing). */
  extraWebsites?: string[];
  /** How many other catalog events share the official site (a venue or organizer site hosting many fairs). */
  otherEventsOnSite?: number;
};

export type Budget = {
  /** Pages (HTML, sitemaps, API responses) fetched. */
  maxPages: number;
  /** Candidates opened and judged. */
  maxCandidates: number;
  timeMs: number;
  concurrency: number;
  maxSearchQueries: number;
};

export const DEFAULT_BUDGET: Budget = { maxPages: 60, maxCandidates: 30, timeMs: 55_000, concurrency: 6, maxSearchQueries: 5 };

export type DiscoveryOptions = {
  fetcher?: Fetcher;
  search?: SearchProvider | null;
  budget?: Partial<Budget>;
};

type PageContext = {
  url: string;
  headline: string;
  /** Source page URL words + headline: what the page says it is about. */
  about: string;
  /** Visible text, for the edition's printed dates. */
  body: string;
  isPlanPage: boolean;
};

type QueueItem = { url: string; score: number; depth: number; via: string; reason: string };

type Candidate = {
  url: string;
  kind: FloorPlanKind;
  role: 'plan' | 'document';
  link: string;
  near: string;
  page: PageContext | null;
  foundOn: string;
  via: string;
  score: number;
  lead?: boolean;
  fileDate?: string | null;
  checked?: boolean;
  /** Could not be downloaded (network failure, timeout, 5xx): unverified, not rejected. */
  unreachable?: boolean;
  /** Loaded, but nothing on or around it says which edition it is: unverified, not disproved. */
  insufficient?: boolean;
  /** Shown on a plan page but named as nothing: must look like a drawn plan. */
  unnamed?: boolean;
  /** Rejected because it is another edition's (or city's) plan. */
  otherEdition?: boolean;
  accepted?: boolean;
};

/** File names of buttons and call-to-action graphics. */
export const BUTTON_IMAGE = /(?:^|[-_ .])(?:click[-_ ]?here|btn|button|cta|call[-_ ]?to[-_ ]?action|download[-_ ]?now)(?:[-_ .]|$)/i;

/** Sign-in pages a protected link redirects to. */
const LOGIN_URL = /\/(?:wp-login\.php|login|log-in|signin|sign-in|sso|auth(?:orize)?|account\/login|users?\/sign_in)(?:[/?.]|$)|[?&](?:redirect_to|returnurl|return_to)=/i;
/** Query parameters of maps plotting a place or a route. */
const DIRECTIONS_QUERY = /[?&](?:lat|lng|lon|latitude|longitude|ll|daddr|saddr|add|address|destination|origin)=/i;

/** Articles, not plans, even when their headline is about the floor plan. */
const NEWS_PATH = /\/(?:press|news|blog|blogs|articles?|stories|story|media-cent(?:re|er)|newsroom|pressemitteilungen|presse|actualites|noticias|notizie|nieuws)(?:\/|-|$)/i;

/** Exhibitor manuals/guides opened per search: they are large and rarely hold the plan. */
const MAX_DOCUMENTS = 5;
/** This-year versions of other editions' plan files tried per search. */
const MAX_LEADS = 6;
/** Unnamed images tried per floor-plan page. */
const MAX_UNNAMED_PER_PAGE = 6;

/** Images that are page furniture, not plans. */
const FURNITURE =
  /(?:^|[^a-z])(logos?|icons?|sprite|avatar|favicon|flags?|social|sponsors?|partners?|badge|button|arrow|banner|header|footer|thumb|thumbnail|placeholder|spinner|loader|qr|hero|default|slider|slide|carousel|background|bg|cover|promo|billboard|bigbox|advert|ad|speaker|people|team|portrait|testimonial|youtube|video|play)(?:[^a-z]|$)/i;
const TRACKING = /^(?:utm_\w+|fbclid|gclid|mc_cid|mc_eid|_ga|ref)$/i;
const LANGUAGE_PREFIX = /^\/(?!en(?:[-_][a-z]{2})?\/)[a-z]{2}(?:[-_][a-z]{2})?\//i;

const PAGE_IDENTIFYING = /^(?:page_id|p|id|pid|nid|lang|sc_lang|l|lng|language)$/i;

/** A page's identity for crawling: "?azletter=B" or "?page=2" variants are the same page. */
function crawlKey(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of Array.from(parsed.searchParams.keys())) if (!PAGE_IDENTIFYING.test(key)) parsed.searchParams.delete(key);
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString().toLowerCase();
  } catch {
    return url;
  }
}

function canonical(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of Array.from(parsed.searchParams.keys())) if (TRACKING.test(key)) parsed.searchParams.delete(key);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * The site section a listed deep link belongs to: "/sueffa" for
 * messe-stuttgart.de/sueffa/en, "/event/germany" for …/event/germany; null for
 * a home page. Trailing language and home segments are not part of it.
 */
export function sectionOf(website: string) {
  try {
    const segments = new URL(withProtocol(website)).pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.toLowerCase());
    while (segments.length && /^(?:[a-z]{2}(?:[-_][a-z]{2})?|home|index(?:\.\w+)?|default\.\w+|start|main\.\w+|[\w-]+\.html?)$/.test(segments[segments.length - 1])) {
      segments.pop();
    }
    if (!segments.length) return null;
    // The fair's own folder ("/tampa" of /tampa/visitor), or two levels under a generic one ("/event/germany").
    const generic = /^(?:events?|fairs?|shows?|expos?|exhibitions?|conferences?|e|evenement|messen?|veranstaltungen?|salons?|ferias?|trade-?shows?)$/;
    return `/${segments.slice(0, generic.test(segments[0]) ? 2 : 1).join('/')}`;
  } catch {
    return null;
  }
}

const withProtocol = (website: string) => (/^https?:\/\//i.test(website) ? website : `http://${website}`);
const origin = (url: string) => new URL(url).origin;
const elapsed = (start: number) => Date.now() - start;

class Discovery {
  readonly profile: EditionProfile;
  readonly started = Date.now();
  readonly budget: Budget;
  readonly fetcher: Fetcher;
  readonly search: SearchProvider | null;

  officialSites = new Set<string>();
  relatedSites = new Map<string, string>();
  brands = new Set<string>();
  organizerTokens: string[];
  /** On a site shared by many fairs, the listed section ("/sueffa") this event's pages live under. */
  scope: string | null;

  queue: QueueItem[] = [];
  seen = new Set<string>();
  candidates = new Map<string, Candidate>();
  pages = new Map<string, PageContext>();
  wordPressOrigins = new Set<string>();
  sitemapOrigins = new Set<string>();
  background: Promise<void>[] = [];
  pendingBackground = 0;

  sources: TraceSource[] = [];
  traceCandidates: TraceCandidate[] = [];
  queries: TraceQuery[] = [];
  pagesFetched = 0;
  candidatesChecked = 0;
  documentsChecked = 0;
  /** Floor-plan pages that could not be opened for network reasons. */
  unreachablePlanPages = 0;
  unnamedPerPage = new Map<string, Set<string>>();
  /** Plan candidates each page shows (kept even when the candidate was first found elsewhere). */
  pageShows = new Map<string, Set<string>>();
  leads = 0;
  anyOfficialPage = false;
  lastOfficialError = '';
  /** Why the official site could not be read: a network failure, a block, or a missing page. */
  lastOfficialErrorKind: 'network' | 'blocked' | 'gone' | null = null;

  accepted: { floorPlan: FindShowFloorPlan; verdict: Verdict } | null = null;
  fallback: { floorPlan: FindShowFloorPlan; verdict: Verdict } | null = null;

  constructor(readonly input: DiscoveryInput, options: DiscoveryOptions) {
    this.profile = editionProfile(input);
    this.budget = { ...DEFAULT_BUDGET, ...options.budget };
    this.fetcher = options.fetcher ?? httpFetcher;
    this.search = options.search === undefined ? defaultSearchProvider() : options.search;
    this.scope = (input.otherEventsOnSite ?? 0) > 0 ? sectionOf(input.website) : null;
    this.organizerTokens = normalize(input.organizer ?? '')
      .split(' ')
      .filter((token) => token.length >= 4 && !['group', 'gmbh', 'limited', 'events', 'exhibitions', 'international', 'company', 'corporation', 'media', 'fairs', 'messe', 'expo'].includes(token));
  }

  timeLeft() {
    return this.budget.timeMs - elapsed(this.started);
  }

  /** Too little time left to start another sitemap/API/search request (a sixth of the budget, at most 9 s). */
  lowOnTime() {
    return this.timeLeft() < Math.min(9_000, this.budget.timeMs / 6);
  }

  // --- Sites --------------------------------------------------------------

  addOfficial(url: string) {
    const site = siteKey(url);
    if (!site || site.endsWith('eventseye.com')) return;
    this.officialSites.add(site);
    const brand = siteBrand(site);
    if (brand) this.brands.add(brand);
  }

  isOfficial(url: string) {
    return this.officialSites.has(siteKey(url));
  }

  /** An official site, or one it links as the organizer's or the venue's. */
  isCrawlable(url: string) {
    return this.isOfficial(url) || this.relatedSites.has(siteKey(url));
  }

  /** A file host named after the official site ("…/franchising-expo-production/…"). */
  isBrandedHost(url: string) {
    return Array.from(this.brands).some((brand) => carriesBrand(url, brand));
  }

  /** Links from an official page to the organizer's or the venue's own site. */
  noteRelatedSite(link: PageLink) {
    const site = siteKey(link.url);
    if (this.officialSites.has(site) || this.relatedSites.has(site)) return;
    const words = normalize(`${link.text} ${siteKey(link.url).replace(/[.-]/g, ' ')}`);
    const organizerHit =
      this.organizerTokens.length > 0 &&
      this.organizerTokens.filter((token) => words.includes(token)).length / this.organizerTokens.length >= 0.6;
    const venueEvidence = readEvidence(link.text, this.profile);
    if (organizerHit) this.relatedSites.set(site, 'organizer');
    else if (venueEvidence.venue && link.tag === 'a') this.relatedSites.set(site, 'venue');
  }

  // --- Queue --------------------------------------------------------------

  enqueue(url: string, score: number, depth: number, via: string, reason: string) {
    const key = crawlKey(url);
    if (this.seen.has(key)) {
      const queued = this.queue.find((item) => crawlKey(item.url) === key);
      if (queued && score > queued.score) {
        queued.score = score;
        queued.reason = reason;
      }
      return;
    }
    this.seen.add(key);
    this.queue.push({ url: canonical(url), score, depth, via, reason });
  }

  /** How promising a same-site page is; null to leave it. */
  pageScore(link: PageLink, depth: number): { score: number; reason: string } | null {
    const words = `${urlWords(link.url)} ${link.text}`;
    const evidence = readEvidence(words, this.profile);
    const reasons: string[] = [];
    let score = 0;
    if (namesFloorPlan(words)) (score += 90), reasons.push('floor-plan page');
    if (namesManual(words)) (score += 45), reasons.push('manual/guide');
    if (namesExhibitorInfo(words)) (score += 40), reasons.push('exhibitor/visitor info');
    if (evidence.year) (score += 20), reasons.push(`names ${this.profile.year}`);
    if (evidence.city || evidence.venue) (score += 15), reasons.push('names city/venue');
    if (evidence.name && !this.isOfficialHome(link.url)) (score += 15), reasons.push('names the event');
    if (evidence.otherYears.length && !evidence.year) {
      // This city's page for another edition ("/expos/melbourne-2027" for Melbourne 2026) is still worth opening:
      // where that edition's plan file lives leads to this one's. Another city's or a bare year's page is not.
      if ((evidence.city || evidence.venue) && !evidence.otherCities.length) (score = Math.max(score - 10, 40)), reasons.push('this city, another edition (lead source)');
      else (score -= 30), reasons.push('another year');
    }
    if (evidence.otherCities.length && !evidence.city) (score -= 60), reasons.push('another city');
    if (LANGUAGE_PREFIX.test(new URL(link.url).pathname)) score -= 8;
    if (/\/(?:news|blog|press|article|articles|posts?|tag|author|category|shop|product|jobs?|careers?)\//i.test(link.url)) score -= 25;
    score -= 8 * depth;
    // Pages on the organizer's/venue's own site only when about this event.
    if (!this.isOfficial(link.url) && !(evidence.name || namesFloorPlan(words))) return null;
    // A shared venue/organizer site: pages outside this fair's section are about other fairs.
    if (this.scope && !new URL(link.url).pathname.toLowerCase().startsWith(this.scope) && !evidence.name) {
      score -= 45;
      reasons.push('outside the event’s section');
    } else if (this.scope) {
      score += 15;
    }
    return score >= 25 ? { score, reason: reasons.join(', ') } : null;
  }

  isOfficialHome(url: string) {
    try {
      return new URL(url).pathname.replace(/\/$/, '') === '';
    } catch {
      return false;
    }
  }

  // --- Candidates ---------------------------------------------------------

  addCandidate(candidate: Omit<Candidate, 'score'> & { score?: number }) {
    if (candidate.kind === 'image') candidate = { ...candidate, url: originalImageUrl(candidate.url) };
    const key = canonical(candidate.url);
    // A plan page showing hundreds of pictures (exhibitor logos) is not showing its plan in them.
    // Counted per distinct image: one plan appears as a preload, a lightbox link and an <img>.
    if (candidate.unnamed) {
      const pageUrl = candidate.page?.url ?? '';
      const seen = this.unnamedPerPage.get(pageUrl) ?? new Set<string>();
      if (!seen.has(key) && seen.size >= MAX_UNNAMED_PER_PAGE) return;
      seen.add(key);
      this.unnamedPerPage.set(pageUrl, seen);
    }
    if (candidate.page && candidate.kind !== 'page') {
      const shown = this.pageShows.get(candidate.page.url) ?? new Set<string>();
      shown.add(key);
      this.pageShows.set(candidate.page.url, shown);
    }
    if (this.candidates.has(key)) {
      const existing = this.candidates.get(key)!;
      // Keep the richest context (e.g. the floor-plan link text over a bare sitemap entry).
      if (!existing.checked && (candidate.score ?? 0) > existing.score) Object.assign(existing, candidate, { url: key });
      return;
    }
    const evidence = readEvidence(`${withoutUploadFolder(candidate.link)}`, this.profile);
    let score = candidate.score ?? 50;
    if (candidate.role === 'plan') score += 30;
    if (evidence.year) score += 25;
    if (evidence.city || evidence.venue) score += 20;
    if (evidence.otherYears.length && !evidence.year) score -= 40;
    if (evidence.otherCities.length && !evidence.city) score -= 60;
    if (candidate.kind === 'pdf' || candidate.kind === 'interactive') score += 10;
    if (candidate.kind === 'page') score -= 30;
    if (candidate.lead) score -= 15;
    // Known from its upload date alone: another edition's file (so a page showing it shows an old plan).
    const otherEdition = predatesPreviousEdition(candidate.fileDate, this.profile) || undefined;
    this.candidates.set(key, { ...candidate, url: key, score, otherEdition });
  }

  /** A link on a page (or from a sitemap/search/media listing): candidate, page to follow, or neither. */
  consider(link: PageLink, page: PageContext | null, depth: number, via: string) {
    if (!/^https?:/i.test(link.url)) return;
    if (floorPlanKind(link.url) === 'image') link = { ...link, url: originalImageUrl(link.url) };
    const words = `${urlWords(link.url)} ${link.text}`;
    // A frame showing a plan (on a plan page, or named as one) is an interactive plan, not a page to link.
    const planFrame = link.tag === 'frame' && floorPlanKind(link.url) === 'page' && (page?.isPlanPage || namesFloorPlan(words));
    const kind = planFrame ? 'interactive' : floorPlanKind(link.url);
    const official = this.isCrawlable(link.url);
    if (page && this.isOfficial(page.url) && link.tag === 'a' && !official) this.noteRelatedSite(link);

    const notPlan = namesNotPlan(words);
    // Alt text never names an image as a plan on its own: sites label event photos "exhibition hall layout" for SEO.
    const namedPlan = !notPlan && (namesFloorPlan(words) || isInteractivePlanUrl(link.url));
    // On a floor-plan page the plan is what it frames, or a download with no other name — not every PDF in
    // its menus and footer. Pictures count only when their own file name or link names a plan: across the
    // catalog, unnamed pictures on plan pages proved to be flyers, logos, icons, stock and crowd photos.
    const embeddedOnPlanPage =
      page?.isPlanPage &&
      !notPlan &&
      kind !== 'image' &&
      (link.tag === 'frame' || (kind === 'pdf' && (link.tag === 'raw' || isGenericLinkText(link.text))));

    if ((namedPlan || embeddedOnPlanPage) && kind === 'image' && decorationFile(link.url)) return;
    if (namedPlan || embeddedOnPlanPage) {
      if (kind === 'image' && FURNITURE.test(urlWords(link.url)) && !namesFloorPlan(urlWords(link.url))) return;
      if (kind === 'page') {
        // Another year's plan page is still worth opening — its files lead to this year's — but is not a candidate.
        const evidence = readEvidence(words, this.profile);
        const otherYearOnly = evidence.otherYears.length > 0 && !evidence.year;
        if (official) this.enqueue(link.url, (otherYearOnly ? 70 : 120) - depth * 5, depth, via, 'floor-plan page');
        if ((official || this.isBrandedHost(link.url)) && !otherYearOnly) {
          this.addCandidate({ url: link.url, kind, role: 'plan', link: words, near: `${link.alt} ${link.near}`, page, foundOn: link.pageUrl, via });
        }
        return;
      }
      // A brochure/manual on a plan page is still a brochure: it must itself contain the plan.
      const role = !namesFloorPlan(words) && namesManual(words) ? 'document' : 'plan';
      this.addCandidate({ url: link.url, kind, role, link: words, near: `${link.alt} ${link.near}`, page, foundOn: link.pageUrl, via, fileDate: uploadFolderDate(link.url), unnamed: !namedPlan });
      if (namedPlan) this.addLead(link, page, via);
      return;
    }
    if (kind === 'pdf' && namesManual(words) && !notPlan) {
      this.addCandidate({ url: link.url, kind, role: 'document', link: words, near: `${link.alt} ${link.near}`, page, foundOn: link.pageUrl, via, score: 10, fileDate: uploadFolderDate(link.url) });
      return;
    }
    if (kind === 'page' && official && link.tag === 'a' && depth <= 3) {
      const scored = this.pageScore(link, depth);
      if (scored) this.enqueue(link.url, scored.score, depth, via, scored.reason);
    }
  }

  /** Another edition's plan of this city: the same file location with this edition's year is a candidate. */
  addLead(link: PageLink, page: PageContext | null, via: string) {
    if (this.leads >= MAX_LEADS) return;
    const evidence = readEvidence(`${withoutUploadFolder(urlWords(link.url))} ${link.text}`, this.profile);
    if (evidence.year || evidence.otherYears.length !== 1) return;
    if (evidence.otherCities.length && !evidence.city) return;
    const url = sameLocationForYear(link.url, evidence.otherYears[0], this.profile.year);
    if (!url || url === link.url) return;
    this.leads++;
    this.addCandidate({
      url,
      kind: floorPlanKind(url),
      role: 'plan',
      link: urlWords(url),
      near: '',
      page,
      foundOn: link.pageUrl,
      via: `lead from ${evidence.otherYears[0]} plan`,
      lead: true,
      fileDate: null,
    });
  }

  // --- Fetching pages -----------------------------------------------------

  async fetchPage(item: QueueItem) {
    const started = Date.now();
    this.pagesFetched++;
    // Pages that matter (the listed site, floor-plan pages) get one retry after a network failure or "try later".
    const important = item.score >= 90;
    const request = () =>
      this.fetcher(item.url, {
        accept: 'text/html,application/xhtml+xml',
        timeoutMs: Math.min(12_000, Math.max(3_000, this.timeLeft())),
        maxBytes: 3_000_000,
      });
    try {
      let response: Fetched;
      try {
        response = await request();
        if (important && TRANSIENT_STATUS.test(String(response.status)) && this.timeLeft() > 8_000) response = await request();
      } catch (error) {
        if (!important || !(error instanceof NetworkError) || this.timeLeft() <= 8_000) throw error;
        response = await request();
      }
      if (important && item.score < 900 && TRANSIENT_STATUS.test(String(response.status))) this.unreachablePlanPages++;
      if (response.status >= 400) {
        this.sources.push({ url: item.url, via: item.via, status: 'error', note: `HTTP ${response.status}`, ms: elapsed(started) });
        if (item.via === 'official website' || item.via === 'official home') {
          this.lastOfficialError = `HTTP ${response.status}`;
          this.lastOfficialErrorKind = TRANSIENT_STATUS.test(String(response.status)) ? 'network' : /^(?:401|403|429)$/.test(String(response.status)) ? 'blocked' : 'gone';
        }
        return;
      }
      if (item.via === 'official website' || item.via === 'official home') this.addOfficial(response.url);
      const kind = floorPlanKind(response.url, response.contentType);
      if (kind === 'page' && !/html|xml/.test(response.contentType)) {
        this.sources.push({ url: item.url, via: item.via, status: 'skipped', note: `not a web page (${response.contentType || 'no type'})`, ms: elapsed(started) });
        return;
      }
      if (kind !== 'page') {
        // A "page" that is really a file (e.g. a WordPress attachment page): a candidate only if it names a plan or manual.
        const before = this.candidates.size;
        this.consider({ url: response.url, text: '', alt: '', near: '', pageUrl: item.url, tag: 'a' }, null, item.depth, item.via);
        const added = this.candidates.size > before;
        this.sources.push({ url: item.url, via: item.via, status: added ? 'ok' : 'skipped', note: `is a ${kind}${added ? ', added as candidate' : ', not a floor plan'}`, ms: elapsed(started) });
        return;
      }
      const html = response.body.toString('utf8');
      if (this.isOfficial(response.url)) this.anyOfficialPage = true;
      const headline = pageHeadline(html) ?? '';
      const page: PageContext = {
        url: response.url,
        headline,
        about: `${urlWords(response.url)} ${headline}`,
        body: pageText(html, 60_000),
        isPlanPage: namesFloorPlan(`${urlWords(response.url)} ${headline}`),
      };
      this.pages.set(crawlKey(response.url), page);
      this.pages.set(crawlKey(item.url), page);
      const links = extractLinks(html, response.url);
      const before = this.candidates.size;
      const queuedBefore = this.queue.length;
      for (const link of links) this.consider(link, page, item.depth + 1, `link on ${item.via === 'official website' ? 'official page' : 'page'}`);
      if (/\/wp-content\/|\/wp-json\//.test(html)) this.startWordPress(response.url);
      this.startSitemaps(response.url);
      this.sources.push({
        url: response.url === item.url ? item.url : `${item.url} → ${response.url}`,
        via: item.via,
        status: 'ok',
        note: `${item.reason ? `${item.reason}; ` : ''}${links.length} links, +${this.candidates.size - before} candidates, +${this.queue.length - queuedBefore} pages queued${page.isPlanPage ? '; floor-plan page' : ''}`,
        ms: elapsed(started),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (item.via === 'official website' || item.via === 'official home') {
        this.lastOfficialError = message;
        this.lastOfficialErrorKind = 'network';
      }
      if (error instanceof NetworkError && important && item.score < 900) this.unreachablePlanPages++;
      this.sources.push({ url: item.url, via: item.via, status: 'error', note: message, ms: elapsed(started) });
    }
  }

  runBackground(task: () => Promise<void>) {
    this.pendingBackground++;
    const promise = task()
      .catch(() => undefined)
      .finally(() => {
        this.pendingBackground--;
      });
    this.background.push(promise);
  }

  async fetchText(url: string, via: string, accept: string, maxBytes = 3_000_000) {
    const started = Date.now();
    this.pagesFetched++;
    try {
      const response = await this.fetcher(url, { accept, timeoutMs: Math.min(12_000, Math.max(3_000, this.timeLeft())), maxBytes });
      if (response.status >= 400) {
        this.sources.push({ url, via, status: 'error', note: `HTTP ${response.status}`, ms: elapsed(started) });
        return null;
      }
      return { text: response.body.toString('utf8'), url: response.url, contentType: response.contentType, ms: elapsed(started) };
    } catch (error) {
      this.sources.push({ url, via, status: 'error', note: error instanceof Error ? error.message : String(error), ms: elapsed(started) });
      return null;
    }
  }

  /** robots.txt → sitemaps → sitemap index children → floor-plan documents and related pages. */
  startSitemaps(pageUrl: string) {
    const site = origin(pageUrl);
    if (this.sitemapOrigins.has(site) || !this.isOfficial(pageUrl) || this.sitemapOrigins.size >= 2) return;
    this.sitemapOrigins.add(site);
    this.runBackground(async () => {
      const robots = await this.fetchText(`${site}/robots.txt`, 'robots.txt', 'text/plain', 200_000);
      let roots = robots && !/<html/i.test(robots.text) ? robotsSitemaps(robots.text) : [];
      if (robots) this.sources.push({ url: `${site}/robots.txt`, via: 'robots.txt', status: 'ok', note: `${roots.length} sitemaps listed`, ms: robots.ms });
      if (!roots.length) roots = [`${site}/sitemap.xml`, `${site}/sitemap_index.xml`, `${site}/wp-sitemap.xml`];
      const children: string[] = [];
      let entries = 0;
      for (const root of roots.slice(0, 3)) {
        if (this.lowOnTime()) break;
        const fetched = await this.fetchText(root, 'sitemap', 'application/xml,text/xml', 6_000_000);
        if (!fetched || !/<(?:urlset|sitemapindex)/i.test(fetched.text)) continue;
        const locations = sitemapLocations(fetched.text);
        if (/<sitemapindex/i.test(fetched.text)) {
          children.push(...locations);
          this.sources.push({ url: root, via: 'sitemap', status: 'ok', note: `index of ${locations.length} sitemaps`, ms: fetched.ms });
        } else {
          entries += this.considerSitemapEntries(locations, root);
          this.sources.push({ url: root, via: 'sitemap', status: 'ok', note: `${locations.length} URLs`, ms: fetched.ms });
          break;
        }
      }
      // Child sitemaps most likely to list plans and exhibitor pages first; skip products, tags, authors.
      const ranked = children
        .filter((url) => !/product|tag|author|categor|news|blog|post_tag|job|video|image-sitemap|locations?/i.test(url))
        .map((url) => ({ url, score: /page|attachment|media|upload|document|download|exhib|aussteller|expos|floor|plan|event|show|messe|fair/i.test(url) ? 2 : 1 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      for (const child of ranked) {
        if (this.lowOnTime()) break;
        const fetched = await this.fetchText(child.url, 'sitemap', 'application/xml,text/xml', 6_000_000);
        if (!fetched) continue;
        const locations = sitemapLocations(fetched.text);
        entries += this.considerSitemapEntries(locations, child.url);
        this.sources.push({ url: child.url, via: 'sitemap', status: 'ok', note: `${locations.length} URLs`, ms: fetched.ms });
      }
      void entries;
    });
  }

  considerSitemapEntries(locations: string[], sitemapUrl: string) {
    let used = 0;
    for (const url of locations.slice(0, 20_000)) {
      const before = this.candidates.size + this.queue.length;
      this.consider({ url, text: '', alt: '', near: '', pageUrl: sitemapUrl, tag: 'a' }, null, 1, 'sitemap');
      if (this.candidates.size + this.queue.length > before) used++;
    }
    return used;
  }

  /** WordPress sites: search the media library (where plan PDFs/images are uploaded) and pages. */
  startWordPress(pageUrl: string) {
    const site = origin(pageUrl);
    if (this.wordPressOrigins.has(site) || !this.isOfficial(pageUrl)) return;
    this.wordPressOrigins.add(site);
    this.runBackground(async () => {
      for (const term of ['floor', 'plan', 'map', 'layout', 'hall']) {
        if (this.lowOnTime()) break;
        const url = `${site}/wp-json/wp/v2/media?search=${encodeURIComponent(term)}&per_page=50&_fields=source_url,title,date,link`;
        const fetched = await this.fetchText(url, 'wordpress media', 'application/json', 2_000_000);
        if (!fetched) {
          if (term === 'floor') return;
          continue;
        }
        let items: ReturnType<typeof wordPressMedia> = [];
        try {
          items = wordPressMedia(JSON.parse(fetched.text));
        } catch {
          this.sources.push({ url, via: 'wordpress media', status: 'error', note: 'not a media listing', ms: fetched.ms });
          return;
        }
        let used = 0;
        for (const item of items) {
          const words = `${urlWords(item.url)} ${item.title}`;
          const kind = floorPlanKind(item.url);
          if (!namesFloorPlan(words) && !(kind === 'pdf' && namesManual(words))) continue;
          used++;
          this.addCandidate({
            url: item.url,
            kind,
            role: namesFloorPlan(words) ? 'plan' : 'document',
            link: words,
            near: '',
            page: null,
            foundOn: item.page ?? url,
            via: 'wordpress media library',
            fileDate: item.date?.slice(0, 7) ?? uploadFolderDate(item.url),
          });
        }
        this.sources.push({ url, via: 'wordpress media', status: 'ok', note: `${items.length} files, ${used} floor-plan/manual files`, ms: fetched.ms });
      }
      const pages = await this.fetchText(`${site}/wp-json/wp/v2/pages?search=exhibit&per_page=30&_fields=link,title`, 'wordpress pages', 'application/json', 1_000_000);
      if (pages) {
        try {
          const items = JSON.parse(pages.text) as { link?: string; title?: { rendered?: string } }[];
          for (const item of Array.isArray(items) ? items : []) {
            if (item.link) this.consider({ url: item.link, text: item.title?.rendered ?? '', alt: '', near: '', pageUrl: site, tag: 'a' }, null, 1, 'wordpress pages');
          }
          this.sources.push({ url: `${site}/wp-json/wp/v2/pages?search=exhibit`, via: 'wordpress pages', status: 'ok', note: `${Array.isArray(items) ? items.length : 0} pages`, ms: pages.ms });
        } catch {
          // Not JSON: not WordPress's API.
        }
      }
    });
  }

  /** Web search for the edition's plan; results count only on official/related sites or branded file hosts. */
  startSearch() {
    if (!this.search) return;
    const provider = this.search;
    const { name, venue, organizer, city } = this.input;
    const year = this.profile.year;
    const site = websiteDomain(this.input.website);
    const quotedName = `"${name.replace(/"/g, '')}"`;
    const plainCity = city.split(/[,(]/)[0].trim();
    const queries = [
      `${quotedName} ${year} floor plan`,
      site ? `site:${siteKey(site)} floor plan` : null,
      `${quotedName} ${plainCity} floor plan`,
      venue && venue !== '?' ? `${quotedName} "${venue.replace(/"/g, '')}" floor plan` : null,
      `${quotedName} exhibitor manual ${year}`,
      organizer ? `"${organizer.replace(/"/g, '')}" ${quotedName} floor plan` : null,
      `${quotedName} exhibitor kit OR "show guide" ${year}`,
    ].filter((query): query is string => Boolean(query)).slice(0, this.budget.maxSearchQueries);
    this.runBackground(async () => {
      for (const query of queries) {
        if (this.lowOnTime() || this.accepted) break;
        const entry: TraceQuery = { query, provider: provider.name, results: 0, used: [], ignored: 0 };
        this.queries.push(entry);
        try {
          const results = await provider.search(query);
          entry.results = results.length;
          for (const result of results) {
            const official = this.isCrawlable(result.url) || this.isBrandedHost(result.url);
            if (!official) {
              entry.ignored++;
              continue;
            }
            const before = this.candidates.size + this.queue.length;
            this.consider({ url: result.url, text: result.title, alt: '', near: result.snippet, pageUrl: `search: ${query}`, tag: 'a' }, null, 1, 'web search');
            // A related official page from search is worth a look even without keywords.
            if (this.candidates.size + this.queue.length === before && floorPlanKind(result.url) === 'page' && this.isCrawlable(result.url)) {
              const evidence = readEvidence(`${urlWords(result.url)} ${result.title}`, this.profile);
              if (!(evidence.otherCities.length && !evidence.city) && !(evidence.otherYears.length && !evidence.year)) {
                this.enqueue(result.url, 30, 1, 'web search', 'search result on official site');
              }
            }
            if (this.candidates.size + this.queue.length > before) entry.used.push(result.url);
          }
        } catch (error) {
          entry.error = error instanceof Error ? error.message : String(error);
          if (/rate-limit|cooling down|HTTP [245]\d\d/.test(entry.error)) break;
        }
      }
    });
  }

  // --- Judging candidates -------------------------------------------------

  async check(candidate: Candidate) {
    candidate.checked = true;
    this.candidatesChecked++;
    if (candidate.role === 'document') this.documentsChecked++;
    const trace: TraceCandidate = {
      url: candidate.url,
      kind: candidate.kind,
      via: candidate.via,
      foundOn: candidate.foundOn,
      decision: 'rejected',
      reason: '',
      evidence: [],
    };
    this.traceCandidates.push(trace);
    const reject = (reason: string) => {
      trace.reason = reason;
      if (reason.startsWith('cannot verify edition')) candidate.insufficient = true;
      else if (/edition|is for|mainly about|previous/.test(reason)) candidate.otherEdition = true;
    };
    // A file whose upload date predates the previous edition is that edition's, whatever else is wrong with it.
    if (predatesPreviousEdition(candidate.fileDate, this.profile)) candidate.otherEdition = true;
    try {
      let contentTitle: string | null = null;
      let contentBody: string | null = null;
      let fileDate = candidate.fileDate ?? null;
      let embeddable: boolean | undefined;
      let kind: FloorPlanKind;
      let finalUrl: string;

      // A floor-plan page the crawl already read is judged by what it said then.
      const crawled = candidate.kind === 'page' ? this.pages.get(crawlKey(candidate.url)) : undefined;
      if (crawled) {
        kind = 'page';
        finalUrl = crawled.url;
        contentTitle = crawled.headline;
        if (!namesFloorPlan(`${urlWords(finalUrl)} ${contentTitle}`) || namesNotPlan(contentTitle)) return reject('page is not a floor-plan page');
        if (NEWS_PATH.test(new URL(finalUrl).pathname)) return reject('a news/press article about the floor plan, not the plan');
        if (LOGIN_URL.test(finalUrl) && !LOGIN_URL.test(candidate.url)) return reject('requires a login: the link redirects to a sign-in page');
        if (DIRECTIONS_QUERY.test(new URL(finalUrl).search)) return reject('a location/directions map, not a floor plan');
        if (saysPlanComingSoon(crawled.body)) return reject('the organizer says this floor plan is not published yet (coming soon)');
        // A page headed "2027 floor plan" that still shows last year's plan is not this edition's plan.
        const shown = Array.from(this.pageShows.get(crawled.url) ?? [])
          .map((key) => this.candidates.get(key))
          .filter((entry): entry is Candidate => Boolean(entry));
        if (shown.some((entry) => entry.otherEdition) && !shown.some((entry) => entry.accepted)) {
          return reject('the plan this page shows is another edition’s');
        }
      } else {
        const isDocument = candidate.kind === 'pdf' || candidate.role === 'document';
        const request = () =>
          this.fetcher(candidate.url, {
            accept: isDocument ? 'application/pdf,*/*' : candidate.kind === 'image' ? 'image/*' : 'text/html,*/*',
            timeoutMs: Math.min(25_000, Math.max(4_000, this.timeLeft())),
            maxBytes: candidate.kind === 'image' ? 400_000 : isDocument ? 30_000_000 : 3_000_000,
          });
        // One retry for a failed connection or a "try later" answer: a flaky network is not an absent plan.
        let response: Fetched;
        try {
          response = await request();
          if (TRANSIENT_STATUS.test(String(response.status)) && this.timeLeft() > 8_000) response = await request();
        } catch (error) {
          if (!(error instanceof NetworkError) || this.timeLeft() <= 8_000) throw error;
          response = await request();
        }
        if (TRANSIENT_STATUS.test(String(response.status))) {
          candidate.unreachable = true;
          return reject(`could not be checked: HTTP ${response.status} twice`);
        }
        if (response.status >= 400) return reject(`HTTP ${response.status}`);
        // Sent to a sign-in page: the plan (if any) is behind a login, not published.
        if (LOGIN_URL.test(response.url) && !LOGIN_URL.test(candidate.url)) return reject('requires a login: the link redirects to a sign-in page');
        // A map with coordinates/an address to plot is a location or directions map, not a floor plan.
        if (DIRECTIONS_QUERY.test(new URL(response.url).search)) return reject('a location/directions map, not a floor plan');
        kind = floorPlanKind(response.url, response.contentType);
        finalUrl = response.url;
        trace.kind = kind;
        if (candidate.kind === 'pdf' && kind === 'page') return reject('PDF link returns a web page (moved or login required)');
        if (kind === 'image') {
          // "click-here-for-the-floor-plan.png" is the button that links to the plan (itself a candidate), not the plan.
          if (BUTTON_IMAGE.test(decodeURIComponent(new URL(response.url).pathname.split('/').pop() ?? ''))) {
            return reject('a button/banner graphic linking to the plan, not the plan');
          }
          const size = Number(response.headers['content-length'] ?? response.body.length);
          if (size < 12_000) return reject(`image is ${Math.round(size / 1024)} KB — too small to be a floor plan`);
          const dimensions = imageSize(response.body);
          const unlikely = unlikelyPlanImage(dimensions, candidate.unnamed);
          if (unlikely) return reject(unlikely);
          if (candidate.unnamed && looksLikePhoto(size, dimensions, response.contentType)) {
            return reject('unnamed image on the plan page looks like a photo/promo graphic, not a drawn plan');
          }
        }
        if (kind === 'pdf') {
          contentBody = pdfText(response.body);
          const meta = pdfMetadata(response.body);
          contentTitle = meta.title;
          fileDate = meta.created ?? fileDate;
          if (candidate.role === 'plan' && contentBody && !namesFloorPlan(`${candidate.link} ${contentTitle ?? ''}`) && floorPlanMentions(contentBody) === 0 && candidate.page?.isPlanPage !== true) {
            return reject('PDF text does not mention a floor plan');
          }
        } else if (kind === 'page' || kind === 'interactive') {
          const html = response.body.toString('utf8');
          contentTitle = pageHeadline(html);
          embeddable = !blocksFraming(response.headers);
          if (kind === 'page' && !namesFloorPlan(`${urlWords(response.url)} ${contentTitle ?? ''}`)) return reject('page is not a floor-plan page');
        if (kind === 'page' && NEWS_PATH.test(new URL(response.url).pathname)) return reject('a news/press article about the floor plan, not the plan');
        }
        // Last-Modified dates a file; for a live web page or interactive plan it only dates the last deploy.
        if (!fileDate && response.headers['last-modified'] && (kind === 'pdf' || kind === 'image')) {
          const modified = new Date(response.headers['last-modified']);
          if (!Number.isNaN(modified.getTime())) fileDate = modified.toISOString().slice(0, 7);
        }
      }
      const verdict = judgeCandidate(
        {
          kind,
          role: candidate.role,
          link: candidate.link,
          near: candidate.near,
          uploadDate: uploadFolderDate(candidate.url),
          contentTitle,
          contentBody,
          page: candidate.page?.about ?? '',
          pageBody: candidate.page?.body ?? null,
          fileDate,
          lead: candidate.lead,
        },
        this.profile
      );
      trace.evidence = verdict.evidence;
      if (!verdict.accept) return reject(verdict.reason);

      trace.decision = 'accepted';
      candidate.accepted = true;
      trace.reason = `${verdict.reason} (${verdict.strength} evidence)`;
      const sourceUrl = candidate.page?.url ?? (candidate.foundOn.startsWith('http') ? candidate.foundOn : finalUrl);
      const floorPlan: FindShowFloorPlan = {
        kind,
        url: finalUrl,
        ...(embeddable !== undefined ? { embeddable } : {}),
        ...(contentBody ? { edition: editionDates(contentBody, this.profile.year) } : {}),
        ...(candidate.role === 'document' ? { note: 'The floor plan is inside this exhibitor document.' } : {}),
        verification: verdict.strength === 'content' ? 'plan-content' : verdict.strength === 'link' ? 'official-link' : 'official-page',
        evidence: verdict.evidence,
        source: { label: `Official source (${siteKey(sourceUrl)})`, url: sourceUrl },
      };
      if (!floorPlan.edition) delete floorPlan.edition;
      const result = { floorPlan, verdict };
      // A plan the tab can show (PDF, image, framed map) beats a link to a plan page.
      const rank = (entry: typeof result) =>
        (entry.verdict.strength === 'content' ? 30 : entry.verdict.strength === 'link' ? 20 : 10) +
        (entry.floorPlan.kind === 'page' ? -25 : 0) +
        (entry.floorPlan.note ? -5 : 0);
      if ((verdict.strength === 'content' || verdict.strength === 'link') && kind !== 'page' && candidate.role === 'plan') {
        this.accepted = result;
      } else if (!this.fallback || rank(result) > rank(this.fallback)) {
        this.fallback = result;
      }
    } catch (error) {
      if (error instanceof NetworkError) {
        candidate.unreachable = true;
        return reject(`could not be checked: ${error.message}`);
      }
      reject(error instanceof Error ? error.message : String(error));
    }
  }

  // --- The loop -----------------------------------------------------------

  nextCandidates(count: number) {
    return Array.from(this.candidates.values())
      .filter((candidate) => !candidate.checked && (candidate.role === 'plan' || this.documentsChecked < MAX_DOCUMENTS))
      // A plan page still waiting in the crawl queue is judged once crawled (no second fetch).
      .filter((candidate) => candidate.kind !== 'page' || !this.queue.some((item) => crawlKey(item.url) === crawlKey(candidate.url)))
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  nextPages(count: number) {
    this.queue.sort((a, b) => b.score - a.score);
    return this.queue.splice(0, count);
  }

  async run(): Promise<FloorPlanDiscovery> {
    const website = withProtocol(this.input.website);
    this.addOfficial(website);
    for (const extra of this.input.extraWebsites ?? []) if (extra && websiteDomain(extra)) this.addOfficial(withProtocol(extra));

    // The listed page, its home page, and any other known address of the site.
    this.enqueue(website, 1000, 0, 'official website', 'listed website');
    const home = `${origin(website)}/`;
    if (canonical(home) !== canonical(website)) this.enqueue(home, 900, 0, 'official home', 'home page');
    for (const extra of this.input.extraWebsites ?? []) {
      if (extra && websiteDomain(extra)) this.enqueue(withProtocol(extra), 950, 0, 'official website', 'contact website on listing');
    }
    await Promise.all(this.nextPages(3).map((item) => this.fetchPage(item)));
    this.startSearch();

    const { concurrency } = this.budget;
    for (;;) {
      if (this.accepted) break;
      if (this.timeLeft() <= 0) break;
      const candidates = this.candidatesChecked < this.budget.maxCandidates ? this.nextCandidates(Math.min(4, this.budget.maxCandidates - this.candidatesChecked)) : [];
      const pages = this.pagesFetched < this.budget.maxPages ? this.nextPages(Math.min(concurrency, this.budget.maxPages - this.pagesFetched)) : [];
      if (!candidates.length && !pages.length) {
        if (this.pendingBackground > 0) {
          await Promise.race([Promise.all(this.background), new Promise((resolve) => setTimeout(resolve, Math.max(0, this.timeLeft())))]);
          if (this.pendingBackground > 0 && this.timeLeft() <= 0) break;
          continue;
        }
        break;
      }
      await Promise.all([...candidates.map((candidate) => this.check(candidate)), ...pages.map((item) => this.fetchPage(item))]);
    }
    return this.finish();
  }

  finish(): FloorPlanDiscovery {
    const found = this.accepted ?? this.fallback;
    // Unnamed pictures and manuals are long shots: leaving them unopened does not leave the search unfinished.
    const unchecked = Array.from(this.candidates.values()).filter((candidate) => !candidate.checked && candidate.role === 'plan' && !candidate.unnamed);
    for (const candidate of unchecked.sort((a, b) => b.score - a.score).slice(0, 60)) {
      this.traceCandidates.push({ url: candidate.url, kind: candidate.kind, via: candidate.via, foundOn: candidate.foundOn, decision: 'unchecked', reason: found ? 'not needed: a plan was already verified' : 'not reached within the search budget', evidence: [] });
    }
    const relevantLeft = this.queue.filter((item) => item.score >= 40);
    // A plan that could not be downloaded, or a floor-plan page that could not be opened, is unverified — not absent.
    const unreachable = Array.from(this.candidates.values()).filter((candidate) => candidate.unreachable && candidate.role === 'plan' && !candidate.unnamed);
    const insufficient = Array.from(this.candidates.values()).filter((candidate) => candidate.insufficient && candidate.role === 'plan' && !candidate.unnamed);
    let status: FloorPlanStatus;
    let outcomeReason: string;
    if (found) {
      status = 'VERIFIED_PLAN';
      outcomeReason = `verified ${found.floorPlan.kind} (${found.verdict.strength} evidence)`;
    } else if (!this.anyOfficialPage) {
      const kind = this.lastOfficialErrorKind;
      status = kind === 'blocked' || kind === 'gone' ? 'DISCOVERY_INCOMPLETE' : 'NETWORK_ERROR';
      const why = kind === 'blocked' ? 'blocks automated access' : kind === 'gone' ? 'is not found' : 'could not be reached';
      outcomeReason = `official website ${why}${this.lastOfficialError ? ` (${this.lastOfficialError})` : ''}`;
    } else if (unreachable.length) {
      status = 'DOWNLOAD_FAILED';
      outcomeReason = `${unreachable.length} floor-plan candidate${unreachable.length === 1 ? '' : 's'} could not be downloaded to verify`;
    } else if (this.unreachablePlanPages > 0) {
      status = 'NETWORK_ERROR';
      outcomeReason = `${this.unreachablePlanPages} floor-plan page${this.unreachablePlanPages === 1 ? '' : 's'} could not be reached`;
    } else if (unchecked.length || relevantLeft.length || this.pendingBackground > 0) {
      status = 'DISCOVERY_INCOMPLETE';
      outcomeReason = `search budget ran out with ${unchecked.length} candidates and ${relevantLeft.length} relevant pages left${this.pendingBackground ? ` and ${this.pendingBackground} sitemap/search lookups running` : ''}`;
    } else if (insufficient.length) {
      status = 'DISCOVERY_INCOMPLETE';
      outcomeReason = `insufficient evidence: ${insufficient.length} floor plan${insufficient.length === 1 ? '' : 's'} found whose edition could not be verified`;
    } else {
      status = 'VERIFIED_NO_PLAN';
      const rejected = this.traceCandidates.filter((candidate) => candidate.decision === 'rejected').length;
      outcomeReason = rejected
        ? `official sources searched; ${rejected} candidate${rejected === 1 ? '' : 's'} checked, none verified as this edition's plan`
        : 'official sources searched; no floor plan published';
    }
    const { input, profile } = this;
    return {
      status,
      floorPlan: found?.floorPlan ?? null,
      trace: {
        event: {
          name: input.name,
          year: profile.year,
          dates: `${input.startDate}${input.endDate && input.endDate !== input.startDate ? ` – ${input.endDate}` : ''}`,
          city: input.city,
          country: input.country ?? '',
          venue: input.venue ?? '',
          organizer: input.organizer ?? '',
          website: input.website,
          otherCitiesOnSite: profile.otherCities,
        },
        officialSites: Array.from(this.officialSites),
        relatedSites: Array.from(this.relatedSites, ([site, role]) => ({ site, role })),
        queries: this.queries,
        sources: this.sources,
        candidates: this.traceCandidates,
        outcome: status,
        outcomeReason,
        pagesFetched: this.pagesFetched,
        candidatesChecked: this.candidatesChecked,
        ms: elapsed(this.started),
        checkedAt: new Date().toISOString(),
      },
    };
  }
}

/** Searches the event's official sources for this edition's floor plan. Never throws. */
export async function discoverFloorPlan(input: DiscoveryInput, options: DiscoveryOptions = {}): Promise<FloorPlanDiscovery> {
  const discovery = new Discovery(input, options);
  try {
    return await discovery.run();
  } catch (error) {
    const result = discovery.finish();
    result.status = result.floorPlan ? 'VERIFIED_PLAN' : 'DISCOVERY_INCOMPLETE';
    result.trace.outcome = result.status;
    result.trace.outcomeReason = `search failed: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
}
