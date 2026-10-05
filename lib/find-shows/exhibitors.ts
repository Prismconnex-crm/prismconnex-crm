/**
 * Exhibitor directories per event edition, for the event page's Exhibitors tab
 * (GET /api/find-shows/exhibitors). The pure rules live here — which directory
 * platforms an official page links to, whether a directory is the catalog
 * edition, and how a platform's records become cards — so they are tested
 * offline; exhibitor-discovery.ts does the fetching and exhibitor-resolver.ts
 * the per-edition storage.
 *
 * Only official directories count: a platform is used when the event's own
 * website links to it (or embeds it), and only after its edition — name, year,
 * dates, city — is checked against the catalog record. Nothing is inferred: a
 * card carries only what the directory publishes, and contact details the
 * platform exposes (emails, phones) are never copied.
 *
 * Platforms:
 *  - Map Your Show (<code>.mapyourshow.com): public list JSON, public profiles.
 *    Its login is only for the personal planner.
 *  - RX site builder (reactSettings on the show site): public Algolia index;
 *    profiles public or, when the show only has a protected details page,
 *    behind the RX login.
 *  - Swapcard (app.swapcard.com, white-label hosts such as 365.ilmac.ch): a
 *    public event's list page server-renders its first page of exhibitors,
 *    which are shown with a link to the full official list; the rest is only
 *    reachable through Swapcard's own app, which is not called. A non-public
 *    event's directory requires login, so only a "log in on the official
 *    platform" entry is offered.
 *  - Messe Düsseldorf VIS, jl.medien exhibitor portals (Messe München and
 *    other German fairs) and organizer-built directories on the event's own
 *    site: see lib/find-shows/exhibitor-adapters/. Every adapter is chosen by
 *    what the official pages show, never by event.
 */
import { cityTermsFor, editionProfile, normalize, websiteDomain } from './floor-plan';
import { COUNTRIES_BY_ISO } from './country-resolution';

export type ExhibitorPlatform =
  | 'map-your-show'
  | 'rx'
  | 'swapcard'
  | 'messe-duesseldorf'
  | 'jl-portal'
  | 'dmg-portal'
  | 'dmg-marketing-manual'
  | 'eyeled'
  | 'smallworldlabs'
  | 'informa'
  | 'brand-card-catalogue'
  | 'easyfairs'
  | 'iteca'
  | 'ifema'
  | 'mtp'
  | 'hktdc'
  | 'organizer-directory';
export type ProfileAccess = 'public' | 'login-required';

export type ExhibitorCard = {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Booth/stand numbers as the directory prints them. */
  booths: string[];
  description: string | null;
  /** The exhibitor's page on the official platform. */
  profileUrl: string;
  /**
   * 'catalogue-search': the directory has no page per exhibitor, and `profileUrl` opens the official
   * catalogue filtered to this exhibitor ("Find on official catalogue"). Absent: a profile page of its own.
   */
  profileKind?: 'catalogue-search';
  access: ProfileAccess;
};

export type ExhibitorSource = {
  platform: ExhibitorPlatform;
  platformLabel: string;
  /** The directory's own name for the edition: "POWERGEN 2027". */
  editionLabel: string;
  /** The official directory page, for "view on the official site". */
  directoryUrl: string;
  /** Where a login-required profile or directory sends the user to sign in. */
  loginUrl: string | null;
  /** The official page that linked to the directory. */
  foundOn: string;
};

export type ExhibitorStatus =
  /** An official directory for this edition, with at least one exhibitor. */
  | 'VERIFIED_LIST'
  /** An official directory for this edition exists, but only behind the platform's login. */
  | 'LOGIN_REQUIRED_DIRECTORY'
  /** This edition's official directory was found and verified, but it lists no exhibitors yet. */
  | 'VERIFIED_EMPTY_DIRECTORY'
  /** This edition's official exhibitor list page was found and verified, but its list cannot be read here (it is drawn by a script we do not support). */
  | 'OFFICIAL_DIRECTORY_LINK'
  /** The official site was read and no directory for this edition was found. */
  | 'NO_VERIFIED_DIRECTORY'
  /** The search could not finish (site down, platform unreachable): says nothing either way. */
  | 'DISCOVERY_INCOMPLETE';

export type RejectedSource = { platform: ExhibitorPlatform; label: string; url: string; reason: string };

export type ExhibitorDirectory = {
  status: ExhibitorStatus;
  source: ExhibitorSource | null;
  exhibitors: ExhibitorCard[];
  reason: string;
  checkedAt: string;
  /** Directories found but not used, and why: another edition, another show. */
  rejected: RejectedSource[];
  /** How many exhibitors the directory lists, when it shows only some of them here. */
  total?: number | null;
  /** Only part of the list could be read (its pager runs in the page's script) and no total is stated. */
  partial?: boolean;
  /**
   * Why a DISCOVERY_INCOMPLETE search could not finish — all temporary, all retryable: the official
   * site could not be reached (NETWORK_ERROR), a directory was found but its list could not be read
   * (DOWNLOAD_FAILED), a site refused automated requests or showed a bot challenge (BLOCKED), or a
   * site asked us to slow down (RATE_LIMITED).
   */
  failure?: ExhibitorFailure | null;
};

export type ExhibitorFailure = 'NETWORK_ERROR' | 'DOWNLOAD_FAILED' | 'BLOCKED' | 'RATE_LIMITED';

// --- Edition matching -----------------------------------------------------------

export type EditionTarget = {
  name: string;
  /** ISO date; for an approximate catalog date ("April 2027 (?)"), the month's first day. */
  startDate: string;
  city: string;
  venue?: string;
  website?: string;
  /** True when the catalog date is only approximate. */
  approximate?: boolean;
  /** Cities of the site's other catalog editions: a directory naming one of them is not this edition's. */
  otherCities?: string[];
  /** Names of other catalog shows on the same official site: a directory must then name this one. */
  otherShows?: string[];
  /** Other catalog shows held at the same time in the same city: they may share this show's directory. */
  coLocated?: { name: string; website: string }[];
  /** This same show's editions in other cities on its site (a touring show): a list must say which stop it is for. */
  touringEditions?: { city: string; startDate: string }[];
};

export type EditionEvidence = {
  /** The directory's name for the edition: "POWERGEN 2027", "ISC West 2026". */
  label: string;
  /** Year named by the directory (label, show code); null when none. */
  year: number | null;
  /** Start date the platform states, when it states one. */
  startDate?: string | null;
  /** Venue/city line the platform states, when it states one. */
  location?: string | null;
};

export type EditionVerdict = { ok: boolean; reason: string };

/** Words that name the kind of event, not which one: they cannot tell two shows apart. */
const GENERIC_WORDS = new Set([
  'the', 'and', 'of', 'for', 'in', 'on', 'at', 'de', 'la', 'le', 'et', 'y', 'und', 'der', 'die', 'das',
  'show', 'shows', 'expo', 'exposition', 'exhibition', 'exhibitions', 'exhibitor', 'exhibitors', 'fair', 'trade',
  'tradeshow', 'conference', 'congress', 'convention', 'summit', 'forum', 'week', 'event', 'events', 'international',
  'intl', 'annual', 'national', 'association', 'global', 'world', 'official', 'directory', 'list', 'search', 'all',
  'edition', 'messe', 'salon', 'feria', 'fiera', 'beurs', 'targ',
  'internacional', 'internazionale', 'internationale', 'international', 'miedzynarodowe', 'targi', 'feira', 'mostra',
]);

const compact = (value: string) => normalize(value).replace(/\s+/g, '');

/** The first four-digit year in a label ("POWERGEN 2027"), or null. */
export function yearIn(text: string): number | null {
  const match = text.match(/(?:^|[^\d])(20\d{2})(?!\d)/);
  return match ? Number(match[1]) : null;
}

/**
 * The year a platform show code carries: "pg2027" → 2027, "restaurant27",
 * "packexpo26", "ge27woc", "pxse27" → 20xx. Null when the code names none.
 */
export function yearInShowCode(code: string): number | null {
  const full = yearIn(code);
  if (full) return full;
  const short = code.match(/(?:^|[a-z])(\d{2})(?:[a-z]|$)/i);
  if (!short) return null;
  const year = 2000 + Number(short[1]);
  return year >= 2015 && year <= 2040 ? year : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a directory is the catalog's edition: same show (every
 * distinguishing word of the directory's name appears in the catalog name or
 * the official domain), same year, dates within a few days when the platform
 * states them, and the same city when it states a location.
 */
export function judgeEdition(target: EditionTarget, evidence: EditionEvidence): EditionVerdict {
  const targetYear = Number(target.startDate.slice(0, 4));
  const label = evidence.label.replace(/\s*\|.*$/, '').trim();

  const ownName = compact(target.name);
  const ownDomain = compact(websiteDomain(target.website) ?? '');
  const cityWords = cityTermsFor(target.city).flatMap((term) => term.split(' '));
  // Words with digits are codes ("ALU2026", "MIPCM25", an edition id), not names: the dates judge those.
  // The official domain vouches only for real words ("restaurant" in nationalrestaurantshow.com), not for
  // short fragments: "fi" inside figlobal.com must not let Fi Europe's list pass as Natural Ingredients Europe's.
  const foreign = normalize(label)
    .split(' ')
    .filter((word) => word.length >= 2 && !GENERIC_WORDS.has(word) && !/\d/.test(word))
    .filter((word) => !ownName.includes(word) && !(word.length >= 4 && ownDomain.includes(word)) && !cityWords.includes(word));
  if (foreign.length) {
    return { ok: false, reason: `"${label}" names a different show (${foreign.join(', ')})` };
  }

  // Without dates or a location, only the name can tell a show's regional editions apart: "IAAPA Expo 2026"
  // (Orlando) is not IAAPA Expo Europe's list. See regionalEditionMismatch.
  if (!evidence.startDate && !evidence.location) {
    const missing = regionalEditionMismatch(target, label);
    if (missing.length) return { ok: false, reason: `"${label}" does not name ${missing.join(', ')} — ${ANOTHER_EDITION}` };
  }

  if (evidence.startDate) {
    const stated = Date.parse(evidence.startDate.slice(0, 10));
    const expected = Date.parse(target.startDate);
    if (!Number.isNaN(stated) && !Number.isNaN(expected)) {
      const days = Math.abs(stated - expected) / DAY_MS;
      const tolerance = target.approximate ? 45 : 7;
      if (days > tolerance) {
        return { ok: false, reason: `"${label}" starts ${evidence.startDate.slice(0, 10)}, not ${target.startDate}` };
      }
    }
  } else if (evidence.year === null) {
    return { ok: false, reason: `"${label}" does not say which year it is for` };
  }

  if (evidence.year !== null && evidence.year !== targetYear) {
    return { ok: false, reason: `"${label}" is the ${evidence.year} edition, not ${targetYear}` };
  }

  if (evidence.location) {
    const location = normalize(evidence.location);
    const inCity = cityTermsFor(target.city).some((term) => ` ${location} `.includes(` ${term} `));
    // "Javits Center" for "Jacob K. Javits Convention Center": a distinctive venue word, or its acronym.
    const venue = editionProfile({ name: target.name, startDate: target.startDate, city: target.city, venue: target.venue });
    const atVenue = [...venue.venueTokens.filter((token) => token.length >= 4), ...venue.venueAcronyms].some((word) =>
      ` ${location} `.includes(` ${word} `)
    );
    if (!inCity && !atVenue) {
      return { ok: false, reason: `"${label}" is held at ${evidence.location}, not ${target.city}` };
    }
  }

  return { ok: true, reason: `"${label}" matches the ${targetYear} edition` };
}

/**
 * The edition check for directories that list several shows on one site (ITECA's KIOGE site also
 * hosts NDT Kazakhstan; IFEMA, MTP and HKTDC run many shows each): the site's domain names the host
 * show, not the catalog event, so the list must be judged by the event's own name and share a real
 * word with it. `allWords` also requires every distinctive word of the event in the list's names
 * (POLAGRA-FOOD is not all of "POLAGRA 2026").
 */
export function judgeOwnName(target: EditionTarget, evidence: EditionEvidence & { names?: string[] }, options: { allWords?: boolean } = {}): EditionVerdict {
  const words = (text: string) => normalize(text).split(' ').filter((word) => word.length >= 3 && !/\d/.test(word));
  const own = new Set(words(target.name));
  const compactOwn = normalize(target.name).replace(/\s+/g, '');
  const named = [evidence.label, ...(evidence.names ?? [])];
  if (!named.some((name) => words(name).some((word) => own.has(word) || compactOwn.includes(word)))) {
    return { ok: false, reason: `"${evidence.label}" names a different show` };
  }
  if (options.allWords) {
    const places = new Set(cityTermsFor(target.city).flatMap((term) => term.split(' ')));
    // The edition's own name only: a tagline ("Food - Horeca - Foodtech") does not make POLAGRA 2026 the food show alone.
    const listed = compact(evidence.label);
    const missing = Array.from(own).filter((word) => !GENERIC_WORDS.has(word) && !places.has(word) && !listed.includes(word));
    if (missing.length) return { ok: false, reason: `"${evidence.label}" does not name ${missing.join(', ')} (it may be a wider or different show)` };
  }
  // "Caravans Salon Poland 2026": a country in the name does not change the show when the platform's own dates
  // identify the edition.
  const label = evidence.startDate ? normalize(evidence.label).split(' ').filter((word) => !COUNTRY_WORDS.has(word)).join(' ') : evidence.label;
  return judgeEdition({ ...target, website: '' }, { ...evidence, label: label || evidence.label });
}

/**
 * How a verdict says a list was never this edition's — another region's or another stop's edition of the
 * show (ANOTHER_EDITION), or no exhibitor list of this edition at all: a past edition's, another show's site,
 * the site's own pages or articles (NOT_THIS_EDITIONS_LIST) — rather than that a page has moved on (next
 * year's dates) or could not be read. Only such a verdict takes back a list stored as verified
 * (exhibitor-resolver.ts, mergeAttempt).
 */
export const ANOTHER_EDITION = 'it may be another edition of the show';
export const NOT_THIS_EDITIONS_LIST = 'not this edition’s exhibitor list';
export const isAnotherEdition = (reason: string) => reason.includes(ANOTHER_EDITION) || reason.includes(NOT_THIS_EDITIONS_LIST);

/** Regions a show's name can be qualified by ("IAAPA Expo Europe", "CPHI Middle East", "Big 5 Africa"). */
const REGIONS = [
  'europe', 'euro', 'eurasia', 'asia', 'africa', 'america', 'americas', 'latam', 'oceania', 'caribbean', 'nordic', 'nordics',
  'baltic', 'balkans', 'apac', 'emea', 'mena', 'gcc', 'gulf', 'middle east',
];
const PLACES = Array.from(new Set([...REGIONS, ...Object.values(COUNTRIES_BY_ISO).map((country) => normalize(country.name))]));

/** The regions and countries a catalog name is qualified by, whole words only: "iaapa expo europe" → ["europe"]. */
export function placeQualifiers(name: string): string[] {
  const words = ` ${normalize(name)} `;
  return PLACES.filter((place) => words.includes(` ${place} `));
}

/** A show name's distinctive words, without its places: "ESOTIKA PET SHOW - AREZZO" (Arezzo) → esotika, pet. */
function showNameWords(name: string, city: string) {
  const places = new Set([...cityTermsFor(city), ...placeQualifiers(name)].flatMap((term) => term.split(' ')));
  return new Set(normalize(name).split(' ').filter((word) => word.length >= 3 && !/\d/.test(word) && !GENERIC_WORDS.has(word) && !places.has(word)));
}

/**
 * Whether two catalog records are one show in two places ("BABY & MATERNITY EXPO NASHVILLE" / "… ATLANTA",
 * "PRINT 2 PACK - EGYPT" / "… - SAUDI ARABIA"): one's distinctive words all in the other's, or most of them
 * shared. Different shows of one organizer ("HIGHWAYS UK" / "IDENTITY WEEK") are not.
 */
export function sameShow(a: { name: string; city: string }, b: { name: string; city: string }) {
  const x = showNameWords(a.name, a.city);
  const y = showNameWords(b.name, b.city);
  if (!x.size || !y.size) return false;
  const shared = Array.from(x).filter((word) => y.has(word)).length;
  return shared === Math.min(x.size, y.size) || shared / (x.size + y.size - shared) >= 0.5;
}

/** Path segments that only pick a language or a home page ("/en/home.html", "/fr"), not a section of a shared site. */
const HOME_SEGMENT = /^(?:[a-z]{2}(?:[-_][a-z]{2})?|home|index|default|start)(?:\.\w+)?$/i;

/** Whether the event's website is a section of a host running several shows ("iaapa.org/expos/euro-attractions-show"). */
function isSharedHostSection(website: string | undefined) {
  if (!website) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `http://${website}`);
    return url.pathname.split('/').some((segment) => segment && !HOME_SEGMENT.test(segment));
  } catch {
    return false;
  }
}

/**
 * The places the catalog name is qualified by that a directory's name leaves out, when that means the
 * directory may be another regional edition of the show (empty when it does not):
 *
 *  - a place counts as named when the label writes it, also inside a word ("electronicAsia", "EuroBLECH");
 *  - a label naming the event's city ("CPHI Milan 2026" for CPHI Europe) or any place of its own
 *    ("Big 5 Construct Kenya" for … East Africa) is a regional edition already, judged by its words;
 *  - a label naming no show ("Exhibitor List 2026") is the official site's own page;
 *  - when the event has a domain of its own that carries the label's show name ("StocExpo 2027" on
 *    stocexpo.com, "ISE 2027" on iseurope.org), the domain is that show's. A section of a shared host
 *    (iaapa.org/expos/…) vouches for nothing: the host runs every edition.
 */
export function regionalEditionMismatch(target: EditionTarget, label: string): string[] {
  const cityTerms = cityTermsFor(target.city);
  const named = ` ${normalize(label)} `;
  const packed = compact(label);
  const names = (place: string) => named.includes(` ${place} `) || (place.length >= 4 && packed.includes(place.replace(/\s+/g, '')));
  const missing = placeQualifiers(target.name).filter((place) => !cityTerms.includes(place) && !names(place));
  if (!missing.length) return [];
  // Whole words only here: "india" inside "indiana" or "oman" inside "woman" names no place.
  if ([...cityTerms, ...PLACES].some((term) => named.includes(` ${term} `))) return [];
  const showWords = normalize(label)
    .split(' ')
    .filter((word) => word.length >= 2 && !GENERIC_WORDS.has(word) && !/\d/.test(word));
  if (!showWords.length) return [];
  const domain = compact(websiteDomain(target.website) ?? '');
  if (domain && !isSharedHostSection(target.website) && domain.includes(showWords.join(''))) return [];
  return missing;
}

const COUNTRY_WORDS = new Set(Object.values(COUNTRIES_BY_ISO).flatMap((country) => normalize(country.name).split(' ')).filter((word) => word.length >= 4));

// --- Platform references on official pages --------------------------------------

export type MapYourShowRef = { platform: 'map-your-show'; code: string; foundOn: string };

export type RxSettings = {
  eventId: string;
  eventEditionId: string;
  eventEditionName: string;
  startDate: string | null;
  location: string | null;
  mode: string | null;
  algoliaAppId: string;
  algoliaApiKey: string;
  publicDetailsUrlFormat: string | null;
  protectedDetailsUrlFormat: string | null;
  publicDirectoryUrl: string | null;
  loginUrl: string | null;
};
export type RxRef = { platform: 'rx'; settings: RxSettings; foundOn: string };

/** A Swapcard event page or exhibitor-list view, on app.swapcard.com or the organizer's own host. */
export type SwapcardRef = { platform: 'swapcard'; url: string; eventSlug: string; foundOn: string };

export type PlatformRef = MapYourShowRef | RxRef | SwapcardRef;

/** Undo the escaping pages use for URLs inside scripts: "/", "\x2F", "\/". */
function unescapeScript(text: string) {
  return text
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, '/');
}

/** Map Your Show codes that are not a show: the platform's own pages. */
const MYS_NON_SHOWS = new Set(['www', 'mys', 'cdn', 'static', 'help', 'support', 'app', 'api']);

function mapYourShowCodes(html: string) {
  const codes = new Set<string>();
  for (const match of Array.from(html.matchAll(/\/\/([a-z0-9-]+)(?:\.exh)?\.mapyourshow\.com/gi))) {
    const code = match[1].toLowerCase();
    if (!MYS_NON_SHOWS.has(code)) codes.add(code);
  }
  return Array.from(codes);
}

/** Swapcard's exhibitor-list view ids are base64 "EventView_…": they identify Swapcard on any host. */
const SWAPCARD_LIST = /https?:\/\/([a-z0-9.-]+)\/(?:widget\/)?event\/([a-z0-9-]+)\/exhibitors\/(RXZlbnRWaWV3[A-Za-z0-9+/=%]*)/gi;
const SWAPCARD_EVENT = /https?:\/\/((?:[a-z0-9-]+\.)?app\.swapcard\.com)\/(?:widget\/)?event\/([a-z0-9-]+)/gi;

function swapcardRefs(html: string, pageUrl: string): SwapcardRef[] {
  const bySlug = new Map<string, SwapcardRef>();
  for (const match of Array.from(html.matchAll(SWAPCARD_LIST))) {
    const eventSlug = match[2].toLowerCase();
    const view = decodeURIComponent(match[3]);
    if (!bySlug.has(eventSlug)) bySlug.set(eventSlug, { platform: 'swapcard', url: `https://${match[1].toLowerCase()}/event/${eventSlug}/exhibitors/${view}`, eventSlug, foundOn: pageUrl });
  }
  for (const match of Array.from(html.matchAll(SWAPCARD_EVENT))) {
    const eventSlug = match[2].toLowerCase();
    if (!bySlug.has(eventSlug)) bySlug.set(eventSlug, { platform: 'swapcard', url: `https://${match[1].toLowerCase()}/event/${eventSlug}`, eventSlug, foundOn: pageUrl });
  }
  return Array.from(bySlug.values());
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** "exhibitor-directory.html.html" → "exhibitor-directory.html": a doubled extension some shows configure. */
const repairRxUrl = (url: string | null) => (url ? url.replace(/(\.html)+$/i, '.html') : null);

/** The RX site builder's page settings (`reactSettings… = JSON.parse("…")`) that carry an edition and a directory index. */
export function rxSettings(html: string): RxSettings | null {
  for (const match of Array.from(html.matchAll(/JSON\.parse\("((?:[^"\\]|\\.)*)"\)/g))) {
    if (!match[1].includes('eventEditionId') || !match[1].includes('algoliaConfig')) continue;
    let parsed: { props?: Record<string, unknown> };
    try {
      // A JS string literal: turn its \xNN and \' escapes into JSON ones, read the string, then its JSON.
      const literal = match[1].replace(/\\x([0-9a-f]{2})/gi, '\\u00$1').replace(/\\'/g, "'");
      parsed = JSON.parse(JSON.parse(`"${literal}"`) as string);
    } catch {
      continue;
    }
    const props = (parsed.props ?? {}) as Record<string, Record<string, unknown> | undefined>;
    const context = props.context ?? {};
    const navigation = props.navigation ?? {};
    const algolia = props.algoliaConfig ?? {};
    const showInfo = (props.showInfo ?? {}) as Record<string, unknown>;
    const eventId = text(context.eventId);
    const eventEditionId = text(context.eventEditionId);
    const algoliaAppId = text(algolia.appId);
    const algoliaApiKey = text(algolia.apiKey);
    if (!eventId || !eventEditionId || !algoliaAppId || !algoliaApiKey) continue;
    const idp = text(props.idpUrl);
    const directory = repairRxUrl(text(navigation.exhibitorPublicDirectoryUrlFormat));
    const details = (format: string | null) => {
      // A show configured as ".../exhibitor-details.html.{0}.html" redirects to the directory and drops the
      // exhibitor: its working pages are the platform's usual "<directory>/exhibitor-details.{0}.html".
      if (format && /\.html\.\{0\}/.test(format) && directory) return `${directory.replace(/\.html$/, '')}/exhibitor-details.{0}.html`;
      return format;
    };
    return {
      eventId,
      eventEditionId,
      eventEditionName: text(context.eventEditionName) ?? '',
      startDate: text(showInfo.startDate),
      location: text(showInfo.location),
      mode: text(context.mode),
      algoliaAppId,
      algoliaApiKey,
      publicDetailsUrlFormat: details(text(navigation.exhibitorPublicDetailsUrlFormat)),
      protectedDetailsUrlFormat: details(text(navigation.exhibitorProtectedDetailsUrlFormat)),
      publicDirectoryUrl: directory,
      loginUrl: idp,
    };
  }
  return null;
}

/** Every exhibitor-directory platform an official page links to or embeds. */
export function platformRefs(html: string, pageUrl: string): PlatformRef[] {
  const source = unescapeScript(html.slice(0, 3_000_000));
  const refs: PlatformRef[] = [];
  for (const code of mapYourShowCodes(source)) refs.push({ platform: 'map-your-show', code, foundOn: pageUrl });
  const rx = rxSettings(html);
  if (rx) refs.push({ platform: 'rx', settings: rx, foundOn: pageUrl });
  refs.push(...swapcardRefs(source, pageUrl));
  return refs;
}

// --- Map Your Show --------------------------------------------------------------

export const mapYourShowBase = (code: string) => `https://${code}.mapyourshow.com/8_0`;

/** The show's name and id from its exhibitor list page: `<title>POWERGEN 2027 | …` and `showid = "PG2027"`. */
export function mapYourShowIdentity(html: string): { label: string; showId: string } | null {
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.split('|')[0]?.trim();
  const showId = html.match(/showid\s*=\s*"([A-Za-z0-9_-]+)"/)?.[1];
  return title && showId ? { label: title, showId } : null;
}

type MysHit = { id?: string; fields?: Record<string, unknown> };

const SHORT_DESCRIPTION = 280;

/** HTML's Latin-1 entities, U+00A0 … U+00FF in order ("&Auml;", "&eacute;", "&reg;"). */
const LATIN1_ENTITIES =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest ' +
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig ' +
  'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml';

const NAMED_ENTITIES: Record<string, string> = {
  ...Object.fromEntries(LATIN1_ENTITIES.split(' ').map((name, index) => [name, String.fromCharCode(0xa0 + index)])),
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', sbquo: '‚', bdquo: '„', ndash: '–', mdash: '—', hellip: '…',
  bull: '•', trade: '™', euro: '€', OElig: 'Œ', oelig: 'œ', Scaron: 'Š', scaron: 'š', Yuml: 'Ÿ', ensp: ' ', emsp: ' ', thinsp: ' ',
};

/** Directory text arrives HTML-encoded ("Sant&#8217; Andrea", "&Auml;tztechnik"): decode it for display as plain text. */
export function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    // Case matters ("&Auml;" Ä, "&auml;" ä); "&AMP;" and other upper-cased spellings fall back to lower case.
    return NAMED_ENTITIES[code] ?? NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** Cut a description to a card-sized excerpt at a word boundary. */
export function shortDescription(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  // Inline tags (<b>, <a>…) vanish; block tags and line breaks become spaces.
  const clean = decodeEntities(raw.replace(/<\/?(?:b|i|u|em|strong|span|a|sup|sub|small|font)\b[^>]*>/gi, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
  if (clean.length <= SHORT_DESCRIPTION) return clean || null;
  const cut = clean.slice(0, SHORT_DESCRIPTION);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 200 ? cut.lastIndexOf(' ') : SHORT_DESCRIPTION).trim()}…`;
}

const booth = (value: string) => value.replace(/randomstring/gi, '').trim();

/** Cards from the exhibitor gallery JSON (`remote-proxy.cfm?action=search&searchtype=exhibitorgallery`). */
export function mapYourShowCards(json: unknown, code: string, showId: string): ExhibitorCard[] | null {
  const results = (json as { DATA?: { results?: { exhibitor?: { hit?: MysHit[] } } } })?.DATA?.results?.exhibitor?.hit;
  if (!Array.isArray(results)) return null;
  const cards: ExhibitorCard[] = [];
  const seen = new Set<string>();
  for (const hit of results) {
    const fields = hit.fields ?? {};
    const id = text(fields.exhid_l);
    const name = text(fields.exhname_t);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const logo = text(fields.exhlogo_t);
    const booths = Array.isArray(fields.boothsdisplay_la) ? fields.boothsdisplay_la.map(String).map(booth).filter(Boolean) : [];
    cards.push({
      id,
      name: decodeEntities(name).replace(/\s{2,}/g, ' '),
      logoUrl: logo ? `https://${code}.mapyourshow.com/mys_shared/${showId.toLowerCase()}/logos/${encodeURIComponent(logo)}` : null,
      booths: Array.from(new Set(booths)),
      description: shortDescription(fields.exhdesc_t),
      profileUrl: `${mapYourShowBase(code)}/exhibitor/exhibitor-details.cfm?exhid=${encodeURIComponent(id)}`,
      access: 'public',
    });
  }
  return cards;
}

// --- RX -------------------------------------------------------------------------

/** Fields read from the RX index — deliberately no email, phone or contact fields. */
export const RX_ATTRIBUTES = ['exhibitorName', 'companyName', 'logo', 'standReference', 'exhibitorDescription', 'organisationGuid', 'eventEditionId', 'recordType', 'locale'];

type RxHit = Record<string, unknown>;

const formatUrl = (format: string, value: string) => format.replace('{0}', encodeURIComponent(value));

/** Cards from the RX directory index, for one edition only. */
export function rxCards(json: unknown, settings: RxSettings): ExhibitorCard[] | null {
  const hits = (json as { hits?: RxHit[] })?.hits;
  if (!Array.isArray(hits)) return null;
  const cards: ExhibitorCard[] = [];
  // An exhibitor indexed in several languages (RX Japan: ja-jp and en-gb) is listed once, in English when it can be.
  const seen = new Map<string, { index: number; english: boolean }>();
  for (const hit of hits) {
    if (hit.recordType !== 'exhibitor' || hit.eventEditionId !== settings.eventEditionId) continue;
    const guid = text(hit.organisationGuid);
    const name = text(hit.exhibitorName) ?? text(hit.companyName);
    if (!guid || !name) continue;
    const english = /^en/i.test(text(hit.locale) ?? '');
    const earlier = seen.get(guid);
    if (earlier && (earlier.english || !english)) continue;
    const access: ProfileAccess = settings.publicDetailsUrlFormat ? 'public' : 'login-required';
    const format = settings.publicDetailsUrlFormat ?? settings.protectedDetailsUrlFormat;
    const profileUrl = format ? formatUrl(format, guid) : settings.publicDirectoryUrl;
    if (!profileUrl) continue;
    const stand = text(hit.standReference);
    const card: ExhibitorCard = {
      id: guid,
      name: decodeEntities(name),
      logoUrl: text(hit.logo),
      booths: stand ? stand.split(/\s*[,;]\s*/).filter(Boolean) : [],
      description: shortDescription(hit.exhibitorDescription),
      profileUrl,
      access,
    };
    if (earlier) cards[earlier.index] = card;
    else cards.push(card);
    seen.set(guid, { index: earlier?.index ?? cards.length - 1, english });
  }
  return cards;
}

/** Co-located shows of an edition: facet values their exhibitors carry. */
export type RxShowFilter = { attribute: string; value: string }[];

const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const rxFilters = (settings: RxSettings, shows?: RxShowFilter) =>
  `recordType:exhibitor AND eventEditionId:${settings.eventEditionId}` +
  (shows?.length ? ` AND (${shows.map((show) => `${show.attribute}:${quoted(show.value)}`).join(' OR ')})` : '');

const rxIndexUrl = (settings: RxSettings, params: URLSearchParams) =>
  `https://${settings.algoliaAppId.toLowerCase()}-dsn.algolia.net/1/indexes/${encodeURIComponent(`${settings.eventId}-index`)}?${params}`;

/** Algolia's GET search URL for one edition's exhibitors (the key is the page's public search-only key), or one of its shows'. */
export function rxQueryUrl(settings: RxSettings, page = 0, show?: RxShowFilter) {
  const params = new URLSearchParams({
    'x-algolia-application-id': settings.algoliaAppId,
    'x-algolia-api-key': settings.algoliaApiKey,
    query: '',
    hitsPerPage: '1000',
    page: String(page),
    filters: rxFilters(settings, show),
    attributesToRetrieve: RX_ATTRIBUTES.join(','),
    attributesToHighlight: '',
  });
  return rxIndexUrl(settings, params);
}

/** The counts of an edition's exhibitors per value of some facets (which co-located show each belongs to); no records. */
export function rxFacetUrl(settings: RxSettings, facets: string[]) {
  const params = new URLSearchParams({
    'x-algolia-application-id': settings.algoliaAppId,
    'x-algolia-api-key': settings.algoliaApiKey,
    query: '',
    hitsPerPage: '0',
    filters: rxFilters(settings),
    facets: JSON.stringify(facets),
    maxValuesPerFacet: '200',
  });
  return rxIndexUrl(settings, params);
}

// --- Swapcard -------------------------------------------------------------------

export type SwapcardPage = {
  title: string;
  beginsAt: string | null;
  isPublic: boolean;
  /** The first page of the list, as the page renders it; empty on an event page or a closed event. */
  cards: ExhibitorCard[];
  total: number | null;
};

type Apollo = Record<string, Record<string, unknown>>;

/** Swapcard logos are full-size uploads (often 2000px+): ask its own resizer for the card size its list page uses. */
export function swapcardThumbnail(url: string | null) {
  if (!url || !/^https:\/\/(?:cdn-api|static)\.swapcard\.com\//.test(url)) return url;
  return `https://img.swapcard.com/?o=webp&u=${encodeURIComponent(url)}&q=0.8&m=fit&w=448&h=224`;
}

/** A Swapcard page's own server-rendered data (`__NEXT_DATA__` Apollo state): the event, and the list's first page. */
export function swapcardPage(html: string, pageUrl: string): SwapcardPage | null {
  const data = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!data) return null;
  let apollo: Apollo;
  try {
    apollo = (JSON.parse(data) as { props?: { apolloState?: Apollo } }).props?.apolloState ?? {};
  } catch {
    return null;
  }
  const slug = pageUrl.match(/\/event\/([a-z0-9-]+)/i)?.[1]?.toLowerCase();
  const event = Object.entries(apollo).find(([key, value]) => key.startsWith('Core_Event:') && (!slug || String(value.slug).toLowerCase() === slug))?.[1];
  if (!event) return null;
  const field = (record: Record<string, unknown>, name: string) => record[Object.keys(record).find((key) => key === name || key.startsWith(`${name}(`)) ?? ''];

  const cards: ExhibitorCard[] = [];
  let total: number | null = null;
  const view = Object.entries(apollo).find(([key]) => key.startsWith('Core_EventExhibitorListView'))?.[1];
  const connection = view ? (field(view, 'exhibitors') as { nodes?: { __ref?: string }[]; totalCount?: number } | undefined) : undefined;
  const origin = new URL(pageUrl).origin;
  const access: ProfileAccess = event.isPublic === true ? 'public' : 'login-required';
  for (const node of connection?.nodes ?? []) {
    const exhibitor = node.__ref ? apollo[node.__ref] : undefined;
    const id = exhibitor && text(exhibitor._id);
    const name = exhibitor && text(exhibitor.name);
    if (!exhibitor || !id || !name) continue;
    const booth = text((field(exhibitor, 'withEvent') as { booth?: unknown } | undefined)?.booth);
    cards.push({
      id,
      name: decodeEntities(name),
      logoUrl: swapcardThumbnail(text(exhibitor.logoUrl)),
      booths: booth ? [booth] : [],
      description: shortDescription(exhibitor.htmlDescription),
      profileUrl: `${origin}/event/${slug}/exhibitor/${encodeURIComponent(id)}`,
      access,
    });
  }
  if (typeof connection?.totalCount === 'number') total = connection.totalCount;

  return {
    title: text(event.title) ?? '',
    beginsAt: text(field(event, 'beginsAt')),
    isPublic: event.isPublic === true,
    cards,
    total,
  };
}

/** "weftec-2026" → "WEFTEC 2026". */
export const swapcardLabel = (eventSlug: string) => eventSlug.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());

// --- Browsing -------------------------------------------------------------------

/** The A–Z bucket a name files under: its first letter, or "#" for a digit or symbol. */
export function initialOf(name: string) {
  const first = normalize(name).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

/** Cards in directory order: by name, case- and accent-insensitive. */
export function sortCards(cards: ExhibitorCard[]) {
  return [...cards].sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
}

/** Names a directory prints on cards that are not exhibitors: placeholders, pager and menu buttons. */
const PLACEHOLDER_NAME =
  /^(?:exhibitors?|test|tba|tbc|tbd|n\/?a|all|0\s*-\s*9|first page|last page|next page|previous page|skip to main content|reg[ií]strate ya|register now|sign up to the newsletter|stand booking\b.*)$/i;
/** Booths a directory prints before stands are allotted. */
const PLACEHOLDER_BOOTH = /^(?:unsettled\s*\/\s*nn|nn|tba|tbc|tbd|n\/?a|-+)$/i;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// "+44(0)1202 662 180", "0049 9221 878479 0", "800-860-2872", "(812) 324-70-05" — never "ISO 9001 14001" or a run of years.
const PHONE = /(?:\+|\b00)\d[\d\s().\/-]{7,}\d\b|\b\d{3}[-.]\d{3}[-.]\d{4}\b|\(\d{2,4}\)\s?\d[\d\s-]{5,}\d\b/g;

const STREET = /^(?:via|viale|strada|corso|piazza|p\.?\s?zza|largo|vicolo|rue|avenue|av\.|boulevard|bd|chemin|route|place|calle|avenida|avda|carrer|stra(?:ss|ß)e|str\.|street|road|lane)\b/i;
const DATE_WORDS = new RegExp(`\\b(?:${'january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec'.split(' ').join('|')})\\b`, 'gi');

/**
 * A card text that is not a description: only the exhibitor's postal address ("Via Fossana, 14, 27029
 * Vigevano") or only the dates it attends ("4 - 6 December 2026 11 - 13 December 2026"), its own name aside.
 */
export function notADescription(text: string, name = '') {
  const value = (name ? text.split(name).join(' ') : text).trim();
  if (STREET.test(value) && /\b\d{4,5}\b/.test(value) && value.length < 160) return true;
  return value.replace(DATE_WORDS, '').replace(NOT_LETTER, '').length < 4;
}

// Built from a string: the project targets ES5, where `u`-flag regex literals are not allowed.
const NOT_LETTER = new RegExp('[^\\p{L}]+', 'gu');

/** "Hall 6|Hall 4 / 6E110|4D400" (one entry per stand, joined): "Hall 6 / 6E110", "Hall 4 / 4D400". */
function splitJoinedBooths(value: string): string[] {
  const [halls, stands] = value.split(' / ');
  if (!stands || !halls.includes('|')) return [value];
  const h = halls.split('|');
  const s = stands.split('|');
  return h.length === s.length ? h.map((hall, index) => `${hall.trim()} / ${s[index].trim()}`) : [value];
}

/**
 * Cards as a directory should show them, whatever the platform stored: entities decoded ("&Auml;tztechnik"),
 * placeholder and menu cards ("TEST", "Next Page") left out, the same entry listed twice shown once, contact
 * details the exhibitor wrote into its text (emails, phone numbers) never shown, placeholder booths dropped —
 * then A–Z again, since decoding can move a name. Nothing is added: every remaining value is the directory's.
 */
export function cleanCards(cards: ExhibitorCard[]): ExhibitorCard[] {
  const seen = new Set<string>();
  const out: ExhibitorCard[] = [];
  for (const card of cards) {
    // A name the directory ran into its card text ("… moreno.pisapia@gmail.com Via …") keeps no contact details either.
    const name = decodeEntities(card.name).replace(EMAIL, ' ').replace(PHONE, ' ').replace(/\s+/g, ' ').trim();
    if (!name || PLACEHOLDER_NAME.test(name)) continue;
    const booths = Array.from(new Set(card.booths.flatMap((value) => splitJoinedBooths(decodeEntities(value).trim())).filter((value) => value && !PLACEHOLDER_BOOTH.test(value))));
    const text = card.description
      ? decodeEntities(card.description).replace(EMAIL, '').replace(PHONE, '').replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim()
      : '';
    const description = text && !notADescription(text, name) ? text : null;
    // The same entry printed twice: same profile, name, booths and text. Two official records of one company
    // (RX lists each brand or representative with its own profile) are separate entries and both stay.
    const key = `${card.profileUrl}|${normalize(name)}|${booths.join(',')}|${description ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...card, name, booths, description });
  }
  return sortCards(out);
}

/**
 * Cards that all open the same official page (a list with no profile per exhibitor: ITECA's list page,
 * SPIEL's directory) are shown as "Find on official catalogue", not as a profile of their own.
 */
export function markSharedProfileLinks(cards: ExhibitorCard[]): ExhibitorCard[] {
  if (cards.length < 2) return cards;
  const counts = new Map<string, number>();
  for (const card of cards) if (!card.profileKind) counts.set(card.profileUrl, (counts.get(card.profileUrl) ?? 0) + 1);
  const shared = new Set(Array.from(counts).filter(([, count]) => count >= Math.max(2, cards.length / 2)).map(([url]) => url));
  return shared.size ? cards.map((card) => (shared.has(card.profileUrl) ? { ...card, profileKind: 'catalogue-search' as const } : card)) : cards;
}

/**
 * The one action in an exhibitor's details that leaves Prismconnex, for any platform's card: its official
 * profile, the official catalogue filtered to it (no page of its own), or a profile the official platform
 * keeps behind its own sign-in. `note` says what the visitor will find there, when that needs saying.
 */
export function officialProfileLink(card: Pick<ExhibitorCard, 'profileUrl' | 'profileKind' | 'access'>, source: Pick<ExhibitorSource, 'platformLabel'> | null) {
  // "Official exhibitor list/index/portal/directory" are the event's own sites; platforms are named.
  const where = !source || /^official\b/i.test(source.platformLabel) ? 'the official event website' : source.platformLabel;
  if (card.access === 'login-required') {
    return { href: card.profileUrl, label: 'Open official profile', note: `${where} asks you to sign in there to see this profile.` };
  }
  if (card.profileKind === 'catalogue-search') {
    return { href: card.profileUrl, label: 'Find on official catalogue', note: `${where} has no page of its own for each exhibitor; this opens its catalogue filtered to this one.` };
  }
  return { href: card.profileUrl, label: 'Open official profile', note: null };
}

export const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

/** How many cards file under each A–Z bucket, for the letter row (a letter with none is disabled). */
export function letterCounts(cards: ExhibitorCard[]) {
  const counts: Record<string, number> = Object.fromEntries(ALPHABET.map((letter) => [letter, 0]));
  for (const card of cards) counts[initialOf(card.name)] += 1;
  return counts;
}

/** The cards a search and letter select: every word of the query in the name (accents and case ignored). */
export function filterCards(cards: ExhibitorCard[], { query = '', letter = null }: { query?: string; letter?: string | null }) {
  const words = normalize(query).split(' ').filter(Boolean);
  return cards.filter((card) => {
    if (letter && initialOf(card.name) !== letter) return false;
    if (!words.length) return true;
    const name = normalize(card.name);
    return words.every((word) => name.includes(word));
  });
}
