/**
 * Organizer-built exhibitor directories: the list the event publishes on its
 * own site (or a subdomain of it) — WordPress/Elementor pages, the ASP
 * "SHOWOFF" platform many UK/EU organizers use, organizer exhibitor portals
 * such as `exhibitors.<site>/<event>-2026/Exhibitor/…`. The catalog audit found
 * this to be the most common pattern by far, so it is read generically:
 *
 *  - the list is a set of links to one profile pattern on the official site
 *    (`/exhibitors/<company>`, `/Exhibitor/ExbDetails/<id>`), at least
 *    MIN_CARDS of them, each in its own card holding the name and, when
 *    published, the logo, booth and a short text;
 *  - the page must name this edition's year (title, heading or address), no
 *    other edition's; on a site hosting several shows or cities it must also
 *    name this show and no other city; for a show touring several cities on
 *    one site, this stop (or only this stop's dates);
 *  - "next page" links on the same list are followed;
 *  - one profile is opened: if the site sends it to a login, every card is
 *    marked login-required and opens the site's own login.
 */
import { cityTermsFor, extractLinks, normalize, siteKey } from '../floor-plan';
import { ancestors, descendants, isChrome, parseHtml, textOf, type HtmlNode } from '../html-tree';
import { ANOTHER_EDITION, NOT_THIS_EDITIONS_LIST, judgeEdition, notADescription, placeQualifiers, shortDescription, type EditionTarget, type ExhibitorCard, type ExhibitorSource, type ProfileAccess } from '../exhibitors';
import { HTML_ACCEPT, PAGE_LIMIT, Unreachable, isOk, readHtml, rejected, type ExhibitorAdapter, type OfficialPage } from './types';

const MIN_CARDS = 8;
/** A list whose profile addresses do not say "exhibitor" must be this long, on a page whose own address does. */
const MIN_UNNAMED_LIST = 15;
/** Profile addresses that name exhibitors or companies. */
const EXHIBITOR_PATH = /exhibitor|aussteller|exposant|espositor|expositor|standhouder|wystawc|katilimci|uchastnik|участник|экспонент|compan(?:y|ies)|firm(?:a|en)?|brand|marque|marca|member|profile|detail/i;
/** Link patterns that are never exhibitors: products, categories, news, programme. */
const NOT_EXHIBITOR_PATH = /product|produkt|produit|prodott|categor|kategor|tag|topic|theme|news|article|post|blog|award|winner|speaker|session|program|agenda|event(?:s)?\/|gallery|galeria|video/i;
const MAX_PAGES = 30;

/** A list page's address: the words organizers use for "exhibitor list" in the languages of the catalog. */
export const LIST_PAGE =
  /(?:^|[/_-])(?:exhibitors?|exhibitor-?(?:list|directory|catalog(?:ue)?|index|search)|our-exhibitors|who-exhibits|exhibiting-companies|participants?|aussteller(?:verzeichnis|liste|suche)?|exposants?|liste-des-exposants|espositori|expositores|lista-de-expositores|standhouders|wystawcy|katilimcilar|katılımcılar|uchastniki|eksponenty|участники|экспоненты|exhibitorlist)(?:[/_.?-]|$)/i;

const NOT_PROFILE = /\/(?:page|category|tag|author|feed|wp-|login|sign-?in|register|search|news|blog|press|contact|privacy|terms|cookie|cart|checkout|account)(?:[/?#]|$)|\.(?:pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?)(?:$|[?#])/i;

/** Link texts that are actions, not names. */
const GENERIC_TEXT =
  /^(?:details?|more|more info(?:rmation)?|read more|learn more|view(?: profile| details| more| exhibitor)?|profile|see more|visit(?: website| stand)?|website|open|go|link|contact|info|\+|→|»|›|mehr|weiterlesen|details ansehen|voir(?: plus| la fiche)?|en savoir plus|ver más|leggi(?: tutto)?|dettagli|подробнее)$/i;

const BOOTH =
  // A booth token holds a digit ("F31", "3a29", "Hall 5 / B12", "11-A136") and ends at a word boundary, so "More Info" after it is not taken.
  /(?:\b(?:stand|booth|hall|halle|pavilion|stand\s*no\.?|stand\s*n[°º]|standnr\.?|booth\s*no\.?|stand\s*number|booth\s*number)|стенд|павильон)\s*[:#.]?\s*([A-Z]{0,4}[.-]?\d[A-Z0-9./-]{0,12}(?:\s*[/,]\s*[A-Z]{0,4}[.-]?\d[A-Z0-9./-]{0,12})?)(?=$|[\s,;|)])/i;

/** A hall and a stand printed together: "HALL B1 Stand : F30", "Halle 4, Stand A12". */
const HALL_AND_STAND = /\b(hall|halle|pavilion)\s+([A-Z0-9][\w.-]{0,5})\s*[,/·-]?\s*(?:stand|booth)\s*(?:no\.?|n[°º])?\s*[:#.]?\s*([A-Z]{0,4}[.-]?\d[A-Z0-9./-]{0,12})(?=$|[\s,;|)])/i;
/** An Italian hall with its stand: "Pad. Oval 05", "Padiglione 3 B12" (a hall alone, "Pad. Oval", is no booth). */
const PADIGLIONE = /\b(?:pad\.|padiglione)\s*(?:[A-Za-z]+\s+)?[A-Z]{0,3}\d{1,4}[A-Z]?\b/i;

const hostOf = (url: string) => new URL(url).host.toLowerCase();

function resolveUrl(href: string | undefined, base: string) {
  if (!href || /^(?:#|javascript:|mailto:|tel:)/i.test(href.trim())) return null;
  try {
    const url = new URL(href.trim(), base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** Links to profiles of one kind share everything but their last path segment (or their id parameter). */
function patternKey(url: string) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const query = Array.from(parsed.searchParams.keys()).filter((key) => !/^(?:utm_|lang|lng|l|elb|uls)/i.test(key)).sort();
  if (!segments.length) return null;
  const idInQuery = query.some((key) => /id$|^id|^p$|^slug$|^exh/i.test(key));
  const path = idInQuery ? segments : segments.slice(0, -1);
  return `${parsed.host.toLowerCase()}/${path.join('/')}${idInQuery ? `?${query.join('&')}` : '/*'}`;
}

function imageUrl(node: HtmlNode, base: string) {
  const raw =
    node.attrs['data-src'] ||
    node.attrs['data-lazy-src'] ||
    node.attrs['data-original'] ||
    (node.attrs.srcset || node.attrs['data-srcset'] || '').split(',')[0]?.trim().split(/\s+/)[0] ||
    node.attrs.src;
  if (!raw || /^data:/i.test(raw) || /(?:placeholder|blank|spacer|pixel|loading|lazy|default[-_]?logo|no[-_]?image)/i.test(raw)) return null;
  return resolveUrl(raw, base);
}

/** Class names of the element holding a card's company name. */
const NAME_CLASS = /(?:^|[\s_-])(?:name|title|titre|titolo|company|brand|enseigne|nombre|firmenname)(?:$|[\s_-])/i;

const cleanName = (value: string) =>
  value
    .replace(/^(?:logo(?:\s+of)?|company logo)\s*[:-]?\s*/i, '')
    .replace(/\s+(?:logo|exhibitor)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Names of pages *for* exhibitors (registration, prices, FAQ…): a group of links like these is a menu, not a list. */
const INFO_PAGE =
  /\b(?:registration|register|application|apply|anmeldung|preise|prices?|pricing|faq|fragen|questions|marketing|services?|downloads?|contact[oa]?|kontakt|overview|überblick|ueberblick|why|warum|tips|dates|deadlines|termine|logistics|logistik|stand ?(?:building|construction|packages?)|standbau|shop|tickets?|press|presse|news|programm?e?|agenda|hotels?|travel|anreise|booking|become|werden|manual|guide|terms|inscription|tarifs|precios|about|über uns|sponsor(?:s|ing|ship)?|media ?kit|brochure|floor ?plan|hallenplan|site ?plan|partners?|cookies?|policy|privacy|legal|notice|impressum|imprint|galeria|gallery|galerie|galleria|evento|event|ateliers?|conf[ée]rences?|intervenants|th[ée]matiques|advertising|feedback|how to|open(?:ing)? hours|winners?|awards?|charity|visit(?:ors?)?|visiteurs|besucher|home|accueil|inicio|dove|quando|mappa|mapa|plan|expositores|exposants|espositori|aussteller|exhibitors?|como ser|por qu[ée]|qui[ée]nes)\b/i;

// Built from a string: the project targets ES5, where `u`-flag regex literals are not allowed.
const HAS_LETTER_OR_DIGIT = new RegExp('[\\p{L}\\p{N}]', 'u');

const usableName = (value: string) =>
  value.length >= 2 &&
  value.length <= 120 &&
  // Punctuation alone ("...", "–") is a placeholder, not a company name.
  HAS_LETTER_OR_DIGIT.test(value) &&
  !GENERIC_TEXT.test(value) &&
  // A bare number or booth code ("A001", "3a29") is not a company name.
  !/^[A-Z]{0,3}[.-]?\d{1,5}[A-Z]?$/i.test(value);

export type DirectoryPage = {
  cards: ExhibitorCard[];
  /** Other pages of the same list ("?page=2", "/page/3/"). */
  nextPages: string[];
  /** The profile link pattern the cards share. */
  pattern: string;
};

/**
 * The exhibitor cards a list page shows: the largest group of links to one
 * profile pattern on the official site, outside the page's menus and footer,
 * with each card's name, logo, booth and short text as the page prints them.
 */
export function extractDirectoryPage(html: string, pageUrl: string, site: string, minCards = MIN_CARDS): DirectoryPage | null {
  const root = parseHtml(html);
  const anchors = descendants(root).filter((node) => node.tag === 'a' && node.attrs.href);
  const groups = new Map<string, Map<string, HtmlNode[]>>();
  const page = new URL(pageUrl);
  for (const anchor of anchors) {
    const url = resolveUrl(anchor.attrs.href, pageUrl);
    if (!url || url === page.toString() || NOT_PROFILE.test(url) || isChrome(anchor)) continue;
    let sameSite = false;
    try {
      sameSite = siteKey(url) === site;
    } catch {
      sameSite = false;
    }
    if (!sameSite) continue;
    const key = patternKey(url);
    if (!key) continue;
    const group = groups.get(key) ?? new Map<string, HtmlNode[]>();
    group.set(url, [...(group.get(url) ?? []), anchor]);
    groups.set(key, group);
  }

  let best: { key: string; links: Map<string, HtmlNode[]>; score: number } | null = null;
  for (const [key, all] of Array.from(groups.entries())) {
    // A–Z navigation (/exhibitors/a, /exhibitors/b) and numbered pages share the profiles' pattern but are not profiles.
    const links = new Map(
      Array.from(all.entries()).filter(([url]) => {
        const segment = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
        return segment.length > 1 && !/^\d{1,3}$/.test(segment);
      })
    );
    if (NOT_EXHIBITOR_PATH.test(key.replace(/^[^/]+/, ''))) continue;
    // Profiles named as exhibitors in their address; otherwise only a long list on a page that is itself the exhibitor list.
    const named = EXHIBITOR_PATH.test(key.replace(/^[^/]+/, ''));
    const needed = named ? minCards : Math.max(minCards, minCards === MIN_CARDS ? MIN_UNNAMED_LIST : 1);
    if (!named && minCards === MIN_CARDS && !LIST_PAGE.test(page.pathname)) continue;
    const score = links.size * (named ? 2 : 1);
    if (links.size >= needed && (!best || score > best.score)) best = { key, links, score };
  }
  if (!best) return null;

  // Each profile's card: the outermost element holding that profile's links and no other profile's.
  const owners = new Map<HtmlNode, Set<string>>();
  for (const [url, nodes] of Array.from(best.links.entries())) {
    for (const node of nodes) {
      for (const holder of ancestors(node)) {
        const set = owners.get(holder) ?? new Set<string>();
        set.add(url);
        owners.set(holder, set);
      }
    }
  }

  const cards: ExhibitorCard[] = [];
  const seenNames = new Set<string>();
  for (const [url, nodes] of Array.from(best.links.entries())) {
    let card: HtmlNode = nodes[0];
    for (const holder of ancestors(nodes[0])) {
      if ((owners.get(holder)?.size ?? 0) > 1 || holder.tag === '#root' || holder.tag === 'body') break;
      card = holder;
    }
    // The innermost element naming the card: "exhibitor_listing_title" also holds the dates, its <h3> only the name;
    // "titre", "brand", "enseigne" name it on French/Italian sites, beside separate category, stand and address lines.
    const isNaming = (node: HtmlNode) => /^h[1-6]$/.test(node.tag) || NAME_CLASS.test(node.attrs.class ?? '');
    const heading = descendants(card).find((node) => isNaming(node) && !descendants(node).some((inner) => inner !== node && isNaming(inner)));
    const imgs = [card, ...descendants(card)].filter((node) => node.tag === 'img');
    const names = [
      heading ? textOf(heading) : '',
      ...nodes.map((node) => cleanName(textOf(node))),
      ...nodes.map((node) => cleanName(node.attrs.title ?? '')),
      ...imgs.map((img) => cleanName(img.attrs.alt ?? img.attrs.title ?? '')),
    ]
      .map(cleanName)
      .filter(usableName);
    const name = names[0];
    if (!name) continue;
    const key = normalize(name);
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    const text = textOf(card);
    const boothMatch = text.match(BOOTH);
    const hallAndStand = text.match(HALL_AND_STAND);
    const padiglione = text.match(PADIGLIONE);
    // "HALL A Stand : ART17" → "HALL A / ART17"; "Pad. Oval 05" (padiglione) as printed; "Hall 5 / B12" keeps its hall
    // word; "Stand F31" / "Booth 1714" become "F31" / "1714".
    const booth = hallAndStand
      ? `${hallAndStand[1]} ${hallAndStand[2]} / ${hallAndStand[3]}`
      : padiglione
        ? padiglione[0].replace(/\s+/g, ' ').trim()
        : boothMatch
          ? `${/^(?:hall|halle|pavilion|павильон)/i.test(boothMatch[0]) ? `${boothMatch[0].split(/\s/)[0]} ` : ''}${boothMatch[1]}`.replace(/\s+/g, ' ').replace(/[.]$/, '').trim()
          : null;
    const blocks = descendants(card)
      .filter((node) => /^(?:p|div|span)$/.test(node.tag) && !node.children.some((child) => /^(?:p|div)$/.test(child.tag)))
      .map(textOf)
      // A text block of the card that is not just its name or booth line, nor an address or a run of dates; it may start with the name.
      .filter((value) => value.length >= 40 && normalize(value) !== key && !BOOTH.test(value.slice(0, 30)) && !notADescription(value, name));
    const logo = imgs.map((img) => imageUrl(img, pageUrl)).find(Boolean) ?? null;
    cards.push({
      id: url,
      name,
      logoUrl: logo,
      booths: booth ? [booth] : [],
      description: shortDescription(blocks.sort((a, b) => b.length - a.length)[0]),
      profileUrl: url,
      access: 'public',
    });
  }
  if (cards.length < minCards) return null;
  if (cards.filter((card) => INFO_PAGE.test(card.name)).length >= Math.max(2, cards.length / 4)) return null;

  const listPath = page.pathname.replace(/\/page\/\d+\/?$/, '').replace(/\/$/, '');
  const nextPages = Array.from(
    new Set(
      extractLinks(html, pageUrl)
        .map((link) => link.url)
        .filter((url) => {
          const next = new URL(url);
          if (next.host !== page.host) return false;
          const samePath = next.pathname.replace(/\/page\/\d+\/?$/, '').replace(/\/$/, '') === listPath;
          return samePath && (/\/page\/\d+\/?$/.test(next.pathname) || ['page', 'p', 'paged', 'pg', 'pagenum'].some((key) => /^\d+$/.test(next.searchParams.get(key) ?? '')));
        })
    )
  );
  return { cards, nextPages, pattern: best.key };
}

/** The headline parts of a page that say which edition it is for: title, headings, address. */
export function pageIdentity(html: string, url: string) {
  const root = parseHtml(html);
  const nodes = descendants(root);
  const title = nodes.find((node) => node.tag === 'title');
  const headings = nodes.filter((node) => /^h[12]$/.test(node.tag) && !isChrome(node)).slice(0, 6);
  return [title ? textOf(title) : '', ...headings.map(textOf), decodeURIComponent(new URL(url).pathname)].join(' | ');
}

const MONTHS: Record<string, number> = {};
const MONTH_NAMES: [string, number][] = [
  ['january jan janvier janv januar jän jaen enero ene gennaio gen', 1],
  ['february feb fevrier février fev févr februar febrero febbraio', 2],
  ['march mar mars märz maerz marzo', 3],
  ['april apr avril abril aprile', 4],
  ['may mai mayo maggio mag', 5],
  ['june jun juin juni junio giugno giu', 6],
  ['july jul juillet juli julio luglio lug', 7],
  ['august aug aout août agosto ago', 8],
  ['september sep sept septembre septiembre settembre set', 9],
  ['october oct octobre oktober okt octubre ottobre ott', 10],
  ['november nov novembre noviembre', 11],
  ['december dec décembre decembre dezember dez diciembre dic dicembre', 12],
];
MONTH_NAMES.forEach(([names, month]) => names.split(' ').forEach((name) => (MONTHS[name] = month)));

const MONTH = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const WEEKDAY = '(?:(?:mon|tue|wed|thu|fri|sat|sun|lun|mer|jeu|ven|sam|dim)[a-zäéèû]*\\.?,?\\s+)?';
const DAY = '(\\d{1,2})(?:st|nd|rd|th|er|\\.)?';
// "9-11 October 2026", "Thur 9 - Sun 12 September 2027", "10 - 13 September, 2026", "16. bis 19. November 2026"
const DAY_FIRST = new RegExp(
  `${WEEKDAY}${DAY}(?:\\s*(?:-|–|to|au|bis|al)\\s*${WEEKDAY}\\d{1,2}(?:st|nd|rd|th|er|\\.)?)?\\s+(${MONTH})\\.?(?:\\s*(?:-|–|to|au|bis|al)\\s*${WEEKDAY}\\d{1,2}(?:st|nd|rd|th|er|\\.)?\\s+(?:${MONTH})\\.?)?,?\\s+(20\\d{2})`,
  'gi'
);
// "October 9-11, 2026", "September 10 - 13, 2026"
const MONTH_FIRST = new RegExp(`\\b(${MONTH})\\.?\\s+${DAY}(?:\\s*(?:-|–|to)\\s*(?:(?:${MONTH})\\.?\\s+)?\\d{1,2})?,?\\s+(20\\d{2})`, 'gi');

/** The show dates a page announces, in page order, as ISO start dates. */
export function statedStartDates(text: string): string[] {
  const found: { index: number; date: string }[] = [];
  const iso = (year: string, month: number, day: string) => `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
  for (const match of Array.from(text.matchAll(DAY_FIRST))) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month && Number(match[1]) >= 1 && Number(match[1]) <= 31) found.push({ index: match.index ?? 0, date: iso(match[3], month, match[1]) });
  }
  for (const match of Array.from(text.matchAll(MONTH_FIRST))) {
    const month = MONTHS[match[1].toLowerCase()];
    if (month && Number(match[2]) >= 1 && Number(match[2]) <= 31) found.push({ index: match.index ?? 0, date: iso(match[3], month, match[2]) });
  }
  return found.sort((a, b) => a.index - b.index).map((item) => item.date);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A page of an earlier edition's exhibitors: "Past Exhibitors", "/previous-event-2026/", "anciens exposants". */
const PAST_LIST = /\b(?:past|previous|former)[\s-]+(?:exhibitors?|edition|event)|\b(?:anciens|précédents|precedenti|anteriores)[\s-]+(?:exposants|espositori|expositores)/i;
const LIST_WORD = 'exhibitors?|exhibitor list|exposants|espositori|expositores|aussteller\\w*|exposanten|участник\\w*|экспонент\\w*';
/**
 * Years the title and headings tie to the list: "List of exhibitors 2026", "Our 2026 Exhibitors". Not the
 * address, which organizers reuse ("/exhibitor-list-2025" for the 2026 list, "/2025-…/2027-exhibitors-catalogue/").
 */
function listYears(identity: string) {
  const headline = identity.split(' | ').slice(0, -1).join(' | ');
  const pattern = new RegExp(`(?:${LIST_WORD})[^\\d|]{0,25}?(20\\d{2})(?!\\d)|(?:^|[^\\d])(20\\d{2})[^\\d|]{0,15}?(?:${LIST_WORD})`, 'gi');
  return Array.from(headline.matchAll(pattern)).map((match) => Number(match[1] ?? match[2]));
}

/** Query keys that filter a list rather than name an exhibitor. */
const FILTER_PARAM = /^(?:cat|cats|category|categories|subcat|subcategory|sector|sectors|tag|tags|filter|letter|azletter|atoz|alpha|page|paged|sortby)$/i;

/** Link texts and addresses that are the site's own pages, never exhibitors. */
const SITE_PAGE =
  /(?:^|[\s/_.-])(?:cookies?|privacy|policy|disclaimer|imprint|impressum|terms|conditions|agb|allgemeine-geschaeftsbedingungen|datenschutz|book-?a-?(?:booth|stand)|stand-?booking|download|faq|contact|about|accommodation|hotels?|travel|traffic|visa|visiting|register|registration|registro|inscription|inscripcion|anmeldung|login|sitemap|press|news|media|schedule|agenda|programm?e?|video|audience|visitors?|tips|invite|book|advertis(?:e|ing)|sponsorship|services?|process|why-exhibit|want-to-exhibit|become-an?|accessibility|tickets?|buy-tickets|faqs?|floor-?plans?|getting-here|policies|photo-ops|sign-?up|discounts?|coupons?|rewards|mobile-app|past-exhibitors|celebrities|suggest-a-guest)(?:$|[\s/_.-])/i;

/**
 * Why a page is not where an exhibitor directory lives, if it is not: the site's home page (featured
 * exhibitors or speakers, not the list) or a news article ("/fiera-della-musica-…-oltre-400-espositori-…/").
 */
export function notListPage(url: string): string | null {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const last = decodeURIComponent(segments[segments.length - 1] ?? '').replace(/\.\w+$/, '');
  if (!segments.length || (segments.length === 1 && /^(?:[a-z]{2}(?:[-_][a-z]{2})?|home|index|default)$/i.test(last))) {
    return `the page is the site's home page, not its exhibitor list — ${NOT_THIS_EDITIONS_LIST}`;
  }
  if (last.split(/[-_]/).filter(Boolean).length >= 8) return `the page is an article, not the exhibitor list — ${NOT_THIS_EDITIONS_LIST}`;
  if (SALES_PAGE.test(last)) return `the page is for booking a stand, not the exhibitor list — ${NOT_THIS_EDITIONS_LIST}`;
  return null;
}

/** Pages that sell stands rather than list exhibitors: "/become-an-exhibitor/", "/aussteller-werden", "/devenir-exposant/". */
const SALES_PAGE = /^(?:become-an?-exhibitor|why-exhibit|exhibit-with-us|book-a-(?:stand|booth)|aussteller-werden|devenir-exposant|diventa-espositore|hazte-expositor)$/i;
/** Cards under these sections are a show's partners or speakers, not its exhibitors. */
const NOT_EXHIBITOR_SECTION = /\/(?:partners|media-partners|speakers|speaker)\//i;

/** Why a run of profile-like links is not an exhibitor list, if it is not: the site's own pages (cookie policy, book a stand, travel guide). */
export function notExhibitorLinks(cards: { name: string; profileUrl: string }[]): string | null {
  const sitePages = cards.filter((card) => {
    let page = '';
    try {
      // "ServiceHotel.html" → "Service Hotel".
      page = decodeURIComponent(new URL(card.profileUrl).pathname.split('/').filter(Boolean).pop() ?? '')
        .replace(/\.\w+$/, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2');
    } catch {
      // Keep the name check.
    }
    // The address only: a company may well be called "Acme Media" or "Travel Shop".
    return SITE_PAGE.test(` ${page} `);
  });
  if (sitePages.length >= Math.max(2, cards.length / 4)) return `the links are the site's own pages (${sitePages.slice(0, 3).map((card) => card.name).join(', ')}), not exhibitors — ${NOT_THIS_EDITIONS_LIST}`;
  // "?cat=beauty", "?category=acoustics", "?azletter=0-9", "?page=2": the list's own filters and pager, not exhibitors.
  const filters = cards.filter((card) => {
    try {
      return Array.from(new URL(card.profileUrl).searchParams.keys()).some((key) => FILTER_PARAM.test(key));
    } catch {
      return false;
    }
  });
  const section = cards.filter((card) => NOT_EXHIBITOR_SECTION.test(card.profileUrl));
  if (section.length >= cards.length / 2) return `the links are the show's partners or speakers, not exhibitors — ${NOT_THIS_EDITIONS_LIST}`;
  if (filters.length >= cards.length / 2 || new Set([...sitePages, ...filters]).size >= cards.length / 2) {
    return `the links are the list's categories, letters or pages (${filters.slice(0, 3).map((card) => card.name).join(', ')}), not exhibitors — ${NOT_THIS_EDITIONS_LIST}`;
  }
  return null;
}

/**
 * Whether an organizer's list page is this edition's. Its headline (title,
 * headings, address) must not name another year. The show dates the page
 * announces first — organizers print them in the page header — must be this
 * edition's; a page announcing none must name this year and no earlier one.
 * On a site hosting several shows it must name this show, and it must not name
 * another city of the site without naming this one. When the site runs this
 * same show in other cities, the list must name this stop, or announce this
 * stop's dates and no other stop's.
 */
export function judgeOrganizerPage(target: EditionTarget, identity: string, fullText: string, host?: string): { ok: boolean; reason: string } {
  const year = Number(target.startDate.slice(0, 4));
  // "Past Exhibitors", ".../previous-event-2026/", "List of exhibitors 2026" for the 2027 edition: an earlier edition's list.
  if (PAST_LIST.test(identity)) return { ok: false, reason: `the page lists past exhibitors — ${NOT_THIS_EDITIONS_LIST}` };
  const tied = listYears(identity);
  const listYear = tied.includes(year) ? null : tied.find((value) => value < year);
  if (listYear) return { ok: false, reason: `the list is headed ${listYear}’s exhibitors, not ${year}’s — ${NOT_THIS_EDITIONS_LIST}` };
  const headlineYears = Array.from(identity.matchAll(/(?:^|[^\d])(20\d{2})(?!\d)/g)).map((match) => Number(match[1]));
  if (headlineYears.length && !headlineYears.includes(year)) {
    return { ok: false, reason: `the list is headed ${headlineYears[0]}, not ${year}` };
  }
  const stated = statedStartDates(fullText.slice(0, 200_000));
  if (stated.length) {
    const days = Math.abs(Date.parse(stated[0]) - Date.parse(target.startDate)) / DAY_MS;
    if (days > (target.approximate ? 45 : 7)) return { ok: false, reason: `the page announces the edition of ${stated[0]}, not ${target.startDate}` };
  } else if (!headlineYears.length) {
    const years = new Set(Array.from(fullText.matchAll(/(?:^|[^\d])(20\d{2})(?!\d)/g)).map((match) => Number(match[1])));
    if (!years.has(year)) return { ok: false, reason: `the list does not say it is for ${year}` };
    const earlier = Array.from(years).filter((other) => other < year && other >= year - 3);
    if (earlier.length) return { ok: false, reason: `the list does not say which edition it is for (it names ${[year, ...earlier].join(', ')})` };
  }
  const place = normalize(identity);
  const ownCity = cityTermsFor(target.city).some((term) => ` ${place} `.includes(` ${term} `));
  const otherCity = (target.otherCities ?? []).flatMap(cityTermsFor).find((term) => term && ` ${place} `.includes(` ${term} `));
  if (otherCity && !ownCity) return { ok: false, reason: `the list is for ${otherCity}, not ${target.city}` };
  // One show touring several cities on one site (Esotika Pet Show, Baby & Maternity Expo, Print 2 Pack): a list
  // naming no stop — neither the city nor the country/region in the show's name, in its headline, address or
  // host (ulm.kpa-messe.de) — is this edition's only when the dates it announces first are this stop's, not
  // another's, and it is no tour calendar (two or more other stops' dates). "Next show: London" is allowed.
  const touring = target.touringEditions ?? [];
  const where = ` ${place} ${normalize(host ?? '')} `;
  const namesStop = [...cityTermsFor(target.city), ...placeQualifiers(target.name)].some((term) => where.includes(` ${term} `));
  if (touring.length && !namesStop) {
    const stops = Array.from(new Set(touring.map((edition) => edition.city)));
    if (!stated.length) {
      return { ok: false, reason: `the show also runs in ${stops.join(', ')} and this list names neither ${target.city} nor this edition's dates — ${ANOTHER_EDITION}` };
    }
    // Pages print a stop's first or last day and catalog dates can be approximate: the edition tolerance applies.
    const gap = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;
    const ownGap = gap(stated[0], target.startDate);
    const first = touring.find((edition) => gap(stated[0], edition.startDate) < ownGap);
    const others = Array.from(new Set(touring.filter((edition) => stated.some((date) => gap(date, edition.startDate) <= 7)).map((edition) => edition.city)));
    if (first || others.length >= 2) {
      return { ok: false, reason: `the list announces ${first ? `${first.city}'s dates` : `several stops of the show (${others.join(', ')})`} — ${ANOTHER_EDITION}` };
    }
  }
  const own = normalize(target.name).split(' ').filter((word) => word.length >= 4 && !/^(?:expo|show|fair|trade|international|exhibition)$/.test(word));
  if (target.otherShows?.length) {
    if (own.length && !own.some((word) => place.includes(word))) {
      return { ok: false, reason: 'the site hosts several shows and this list does not name this one' };
    }
  }
  // A list on another organizer's site (the Ideal Home Show's for the Eat & Drink Festival it hosts) must name this
  // show in its headline or host: otherwise it is that site's own show's list.
  const ownSite = target.website ? siteKey(target.website) : null;
  if (host && ownSite && siteKey(host) !== ownSite && own.length) {
    const packedHost = host.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const named = `${place} ${normalize(host)} ${packedHost}`;
    // "pmw-expo.com" for Professional Motorsport World, "jdcgardentrends.com" for Journées des Collections: the show's initials.
    const words = normalize(target.name).split(' ').filter(Boolean);
    const initials = words.map((_, index) => words.slice(index, index + 3).map((word) => word[0]).join('')).filter((run) => run.length === 3);
    if (!own.some((word) => named.includes(word)) && !initials.some((run) => packedHost.includes(run))) {
      return { ok: false, reason: `the list is on ${siteKey(host)}, not the show's own site, and does not name this show — ${NOT_THIS_EDITIONS_LIST}` };
    }
  }
  return { ok: true, reason: stated.length ? `the official list announces ${stated[0]}` : `the official list names the ${year} edition` };
}

/** The exhibitor count a list states ("447 Results", data-totalcount="447"), when it states one. */
export function statedTotal(html: string): number | null {
  const found =
    html.match(/Showing\s+\d+\s*(?:to|-|–)\s*\d+\s+of\s+([\d,]+)/i)?.slice(0, 2).map((value, index) => (index ? value.replace(/,/g, '') : value)) ??
    html.match(/data-total-?count="(\d+)"/i) ?? html.match(/>\s*(\d{1,5})\s+(?:results|exhibitors|aussteller|exposants|espositori|expositores)\s*</i);
  return found ? Number(found[1]) : null;
}

/** A pager that only works through the page's script ("searchFilter(24)", href="javascript:…"): its other pages cannot be read here. */
export function hasScriptPager(html: string) {
  return /onclick="[a-z_$][\w$]*\(\s*\d+\s*\)"[^>]*>\s*\d+\s*</i.test(html) || /href="javascript:[^"]*"[^>]*>\s*(?:\d+|next|›|»)\s*</i.test(html);
}

/**
 * The edition label when a page is, positively, this edition's official exhibitor list: its address
 * is an exhibitor-list address, its title or heading says "exhibitor list/directory", and it names
 * this edition — its headline year, or the show dates it announces. Otherwise null.
 */
export function verifiedListPage(target: EditionTarget, html: string, url: string): string | null {
  if (!LIST_PAGE.test(new URL(url).pathname) && !/exhibitor/i.test(new URL(url).host)) return null;
  const identity = pageIdentity(html, url);
  const title = identity.split(' | ')[0].trim();
  if (!/exhibitor(?:s)?[ -]?(?:list|directory|catalog|index)|list of exhibitors|ausstellerverzeichnis|liste des exposants|catalogo espositori/i.test(identity)) return null;
  const year = Number(target.startDate.slice(0, 4));
  const headlineYears = Array.from(identity.matchAll(/(?:^|[^\d])(20\d{2})(?!\d)/g)).map((match) => Number(match[1]));
  const stated = statedStartDates(textOf(parseHtml(html)).slice(0, 200_000));
  const datesMatch = stated.length > 0 && Math.abs(Date.parse(stated[0]) - Date.parse(target.startDate)) / DAY_MS <= (target.approximate ? 45 : 7);
  const yearMatch = headlineYears.length > 0 && headlineYears.every((value) => value === year);
  if (!yearMatch && !datesMatch) return null;
  if (!judgeOrganizerPage(target, identity, textOf(parseHtml(html)), hostOf(url)).ok) return null;
  // "Fi Europe 2026 Exhibitor List" → "Fi Europe 2026": the edition, not the page's name.
  const edition = title.replace(/\s*[-–|:]?\s*(?:exhibitors?[ -]?(?:list|directory|catalog(?:ue)?|index)|list of exhibitors)\s*$/i, '').trim();
  if (!/(?:^|[^\d])20\d{2}(?!\d)/.test(edition)) return `${target.name} ${year}`;
  // A page naming a show must name this one (a co-located show's list is not this show's).
  return judgeEdition(target, { label: edition, year }).ok ? edition : null;
}

const LOGIN_PAGE = /\/(?:wp-login\.php|login|log-in|signin|sign-in|sso|auth(?:orize)?|account\/login|users?\/sign_in)(?:[/?.]|$)|[?&](?:redirect_to|returnurl|return_to)=/i;

/** Whether the site sends a profile to its login (or refuses it without one). Null when it could not tell. */
async function profileAccess(url: string, fetcher: Parameters<ExhibitorAdapter['resolve']>[1]['fetcher']): Promise<ProfileAccess | null> {
  try {
    // Read directly, not through readHtml: here a 401/403 answer means "sign in", not "not checked".
    const response = await fetcher(url, { accept: HTML_ACCEPT, ...PAGE_LIMIT });
    const page = { url: response.url, status: response.status, html: response.body.toString('utf8') };
    if (/challenge/.test(response.headers['cf-mitigated'] ?? '')) return null;
    if (page.status === 401 || page.status === 403 || LOGIN_PAGE.test(page.url)) return 'login-required';
    if (!isOk(page.status)) return null;
    const hasPassword = /<input[^>]+type=["']?password/i.test(page.html);
    return hasPassword && /log\s?in|sign\s?in|anmelden|connexion/i.test(page.html) && !/<h1/i.test(page.html) ? 'login-required' : 'public';
  } catch {
    return null;
  }
}

/** Official pages worth reading as a list: an exhibitor-list address on the official site. */
function listPageLinks(page: OfficialPage, site: string) {
  const urls = new Set<string>();
  if (LIST_PAGE.test(new URL(page.url).pathname)) urls.add(page.url);
  for (const link of extractLinks(page.html, page.url)) {
    if (link.tag !== 'a') continue;
    try {
      const url = new URL(link.url);
      url.hash = '';
      if (siteKey(url.toString()) !== site || NOT_PROFILE.test(url.pathname)) continue;
      if (LIST_PAGE.test(url.pathname) || /^(?:exhibitors?|exhibitor (?:list|directory)|list of exhibitors|aussteller(?:verzeichnis)?|exposants|espositori|expositores)$/i.test(link.text.trim())) {
        urls.add(url.toString());
      }
    } catch {
      // Not a URL.
    }
  }
  return Array.from(urls);
}

export const organizerDirectoryAdapter: ExhibitorAdapter = {
  id: 'organizer-directory',
  detect: (page, { site }) =>
    listPageLinks(page, site).map((url) => ({ adapter: 'organizer-directory' as const, key: `org:${url.replace(/\/$/, '')}`, foundOn: page.url, data: url })),

  async resolve(lead, { target, fetcher, site }) {
    const listUrl = lead.data as string;
    const first = await readHtml(fetcher, listUrl);
    if (!isOk(first.status)) {
      if (first.status >= 500 || first.status === 429) throw new Unreachable(`HTTP ${first.status} from ${hostOf(listUrl)}`);
      return rejected('organizer-directory', listUrl, listUrl, `the list page answered HTTP ${first.status}`);
    }
    const parsed = extractDirectoryPage(first.html, first.url, site);
    if (!parsed) {
      // The edition's own list page, drawn by a script we cannot read: worth a link, never "no exhibitors".
      const link = verifiedListPage(target, first.html, first.url);
      if (link) {
        return {
          kind: 'link',
          source: { platform: 'organizer-directory', platformLabel: 'Official exhibitor list', editionLabel: link, directoryUrl: first.url, loginUrl: null, foundOn: lead.foundOn },
        };
      }
      return rejected('organizer-directory', listUrl, first.url, 'the page shows no exhibitor list');
    }
    const identity = pageIdentity(first.html, first.url);
    const verdict = judgeOrganizerPage(target, identity, textOf(parseHtml(first.html)), hostOf(first.url));
    // A page titled only "Exhibitor list" is named by the edition it was verified as.
    const title = identity.split(' | ')[0].trim();
    const label = /(?:^|[^\d])20\d{2}(?!\d)/.test(title) ? title : `${target.name} ${target.startDate.slice(0, 4)}`;
    if (!verdict.ok) return rejected('organizer-directory', label, first.url, verdict.reason);
    const notList = notListPage(first.url);
    if (notList) return rejected('organizer-directory', label, first.url, notList);

    const cards = new Map(parsed.cards.map((card) => [card.profileUrl, card]));
    // Later pages in page order; a pager links only nearby pages, so each page read may add more.
    const pageNumber = (url: string) => Number(url.match(/(?:[?&](?:page|p|paged|pg|pagenum)=|\/page\/)(\d+)/)?.[1] ?? 0);
    const queue = [...parsed.nextPages];
    const visited = new Set([first.url, listUrl]);
    let stale = 0;
    while (queue.length && visited.size <= MAX_PAGES) {
      queue.sort((a, b) => pageNumber(a) - pageNumber(b));
      const next = queue.shift()!;
      if (visited.has(next)) continue;
      visited.add(next);
      let page;
      try {
        page = await readHtml(fetcher, next);
      } catch {
        break; // Keep what was read; the first page is verified.
      }
      if (!isOk(page.status)) break;
      // A last page may hold only a few cards: any count, as long as they are the verified list's kind.
      const more = extractDirectoryPage(page.html, page.url, site, 1);
      const before = cards.size;
      if (more && more.pattern === parsed.pattern) {
        for (const card of more.cards) if (!cards.has(card.profileUrl)) cards.set(card.profileUrl, card);
        for (const url of more.nextPages) if (!visited.has(url)) queue.push(url);
      }
      // A pager also links the page already read ("?page=1"): skip it, stop after two pages add nothing.
      stale = cards.size === before ? stale + 1 : 0;
      if (stale >= 2) break;
    }

    const list = Array.from(cards.values());
    // Judged on every page read: the pager's own "First Page" / "Next Page" links often come in from the later pages.
    const notExhibitors = notExhibitorLinks(list);
    if (notExhibitors) return rejected('organizer-directory', label, first.url, notExhibitors);
    const access = await profileAccess(list[0].profileUrl, fetcher);
    const loginRequired = access === 'login-required';
    const source: ExhibitorSource = {
      platform: 'organizer-directory',
      platformLabel: 'Official exhibitor list',
      editionLabel: label,
      directoryUrl: first.url,
      loginUrl: loginRequired ? list[0].profileUrl : null,
      foundOn: lead.foundOn,
    };
    const total = statedTotal(first.html);
    const statedMore = total && total > list.length ? total : null;
    return {
      kind: 'list',
      source,
      exhibitors: loginRequired ? list.map((card) => ({ ...card, access: 'login-required' })) : list,
      total: statedMore,
      // More pages exist behind a script pager that was not followed, and no total says how many.
      partial: !statedMore && !parsed.nextPages.length && hasScriptPager(first.html),
    };
  },
};
