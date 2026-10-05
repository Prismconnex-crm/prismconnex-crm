/**
 * ITECA show sites (Kazakhstan, Uzbekistan, Azerbaijan: KIOGE, TransLogistica,
 * Securex, BakuBuild …). Their "Exhibitors List" pages use one of two public
 * list systems:
 *
 *  - Kazakhstan: an iframe from ITECA's registration system,
 *    `reg.iteca.kz/list/exponent/<lang>/auth_s.aspx?ExhCode=KIOGE%202026`.
 *    The edition code names the show and its year. The "full view" of the same
 *    list (`auth.aspx`) renders every exhibitor on one page: logo, name,
 *    pavilion and stand, city and a description. Exhibitors have no profile
 *    page of their own there, so a card opens the official list page.
 *  - Uzbekistan and Azerbaijan ("ERA" sites): the page sets
 *    `var dataTableURL = 'ERAForms/companies_list.php?l=en&exhibition=486'`, a
 *    DataTables feed (`recordsTotal`, rows of [name, country, stand …]) read
 *    with `start`/`length`. The page's year selector names the list's edition
 *    (`<option value="486" selected>2026 (10 - 12 November 2026)</option>`),
 *    else its title does ("Exhibitors List – BakuBuild 2025"). Rows link each
 *    exhibitor's public profile (`/en/exhibitor-info-486-51371`).
 *
 * Contact fields and the profile pages' contact forms are never read.
 */
import { siteKey } from '../floor-plan';
import { judgeOwnName, shortDescription, yearIn, type EditionTarget, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { decodeHtml, descendants, parseHtml, textOf, type HtmlNode } from '../html-tree';
import { statedStartDates } from './organizer-directory';
import { Unreachable, isOk, readHtml, rejected, type Candidate, type ExhibitorAdapter } from './types';
import type { Fetcher } from '../floor-plan-discovery';

/** The registration system's exhibitor list, wherever a page embeds it. */
const EXPONENT = /https?:\/\/reg\.iteca\.[a-z]{2,3}\/list\/exponent\/([a-z]{2})\/(?:auth|auth_s|auth_k)\.aspx\?ExhCode=([^"'&<>\s]+)/gi;
const ERA_FEED = /dataTableURL\s*=\s*['"]([^'"]*companies_list\.php\?[^'"]*exhibition=(\d+)[^'"]*)['"]/i;
/** An ITECA site's exhibitor-list page: `/en/exhibitors-list`, `/en/exhibition/exhibitors-list/2026`. */
const LIST_PAGE = /\/exhibitors-list(?:\/[^/?#]*)?\/?$/i;
const ITECA_SITE = /reg\.iteca\.|\/projects\/iteca\/|iteca exhibitions|ERAForms\//i;
const ERA_PAGE_SIZE = 100;
// Built from a string: the project targets ES5, where `u`-flag regex literals are not allowed.
const HAS_WORD = new RegExp('[\\p{L}\\p{N}]', 'u');
const MAX_ERA_ROWS = 5000;

const hasClass = (node: HtmlNode, name: string) => (node.attrs.class ?? '').split(/\s+/).includes(name);
const clean = (value: string) => decodeHtml(value).replace(/\s+/g, ' ').trim();

// --- Kazakhstan: reg.iteca exponent lists ---------------------------------------

export type ExponentList = { origin: string; language: string; code: string };

/** The exponent lists a page embeds (iframe `src` or `data-src`). */
export function exponentLists(html: string): ExponentList[] {
  const lists = new Map<string, ExponentList>();
  for (const match of Array.from(html.matchAll(EXPONENT))) {
    const code = decodeURIComponent(match[2].replace(/\+/g, ' ')).trim();
    const origin = new URL(match[0]).origin;
    if (code && !lists.has(code.toLowerCase())) lists.set(code.toLowerCase(), { origin, language: match[1].toLowerCase(), code });
  }
  return Array.from(lists.values());
}

/** The full view of an exponent list: every exhibitor on one page. */
export const exponentUrl = (list: ExponentList) => `${list.origin}/list/exponent/${list.language}/auth.aspx?ExhCode=${encodeURIComponent(list.code)}`;

/** Exhibitor cards from an exponent list's full view. `profileUrl` is the official page the list is shown on. */
export function exponentCards(html: string, listPage: string): ExhibitorCard[] {
  const cards: ExhibitorCard[] = [];
  const seen = new Set<string>();
  for (const cell of descendants(parseHtml(html))) {
    if (cell.tag !== 'td' || !hasClass(cell, 'exhib-td')) continue;
    const inside = descendants(cell);
    const nameNode = inside.find((node) => hasClass(node, 'exhib-name'));
    const name = nameNode ? clean(textOf(nameNode)) : '';
    // A placeholder row ("-") is not an exhibitor.
    if (!HAS_WORD.test(name) || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    // "<span>Pavilion</span>" and "<span>stand</span>D-88": the labels are not the values.
    const value = (className: string) => {
      const node = inside.find((child) => hasClass(child, className));
      return node ? clean(node.text.join(' ')) : '';
    };
    const pavilion = value('exhib-pav');
    const stand = value('exhib-stand');
    // Stands often repeat their pavilion ("11-219" in pavilion 11).
    const booth = pavilion && stand && !stand.startsWith(pavilion) ? `${pavilion}, ${stand}` : stand || pavilion;
    const image = inside.find((node) => node.tag === 'img' && node.attrs.src);
    // Exhibitors without a logo show the show's own logo (`loadedimages/logoexh/<Show>.jpg`).
    const logo = image?.attrs.src && !/\/logoexh\//i.test(image.attrs.src) ? new URL(image.attrs.src, listPage).toString() : null;
    const text = inside.find((node) => node.tag === 'p' && hasClass(node, 'bg_t_onsite'));
    cards.push({
      id: logo?.match(/0x[0-9a-f]+/i)?.[0] ?? `exponent:${name.toLowerCase()}`,
      name,
      logoUrl: logo,
      booths: booth ? [booth] : [],
      description: text ? shortDescription(textOf(text)) : null,
      profileUrl: listPage,
      access: 'public',
    });
  }
  return cards;
}

async function resolveExponent(list: ExponentList, listPage: string, foundOn: string, target: EditionTarget, fetcher: Fetcher): Promise<Candidate> {
  const verdict = judgeOwnName(target, { label: list.code, year: yearIn(list.code) });
  if (!verdict.ok) return rejected('iteca', list.code, listPage, verdict.reason);
  const url = exponentUrl(list);
  // The full view is one large page (about 1 MB for KIOGE): give it time.
  const page = await readHtml(fetcher, url, { timeoutMs: 90_000, maxBytes: 12_000_000 });
  if (!isOk(page.status)) throw new Unreachable(`HTTP ${page.status} from ${new URL(url).host}`);
  if (!/exhib-td/.test(page.html)) throw new Unreachable(`${new URL(url).host} did not return the exhibitor list`);
  const source: ExhibitorSource = { platform: 'iteca', platformLabel: 'Official exhibitor list', editionLabel: list.code, directoryUrl: listPage, loginUrl: null, foundOn };
  const cards = exponentCards(page.html, listPage);
  return cards.length ? { kind: 'list', source, exhibitors: cards } : { kind: 'empty', source };
}

// --- Uzbekistan / Azerbaijan: ERA DataTables feeds ------------------------------

export type EraList = { feedUrl: string; exhibitionId: string; pageUrl: string; label: string; year: number | null; startDate: string | null };

/** The feed an ERA list page loads, and the edition the page says it is. */
export function eraList(html: string, pageUrl: string): EraList | null {
  const feed = html.match(ERA_FEED);
  if (!feed) return null;
  const exhibitionId = feed[2];
  // The year selector: "<option value="486" selected>2026 (10 - 12 November 2026)</option>".
  const option = Array.from(html.matchAll(/<option\s+value\s*=\s*["'](\d+)["'][^>]*>([^<]*)<\/option>/gi)).find((match) => match[1] === exhibitionId);
  const optionText = option ? clean(option[2]) : '';
  const optionYear = /^20\d{2}\b/.test(optionText) ? Number(optionText.slice(0, 4)) : null;
  // The show's name: the heading that carries the list's id ("Securex Uzbekistan <!-- 486 -->"), else the title.
  const heading = html.match(new RegExp(`>([^<>]{2,80}?)\\s*<!--\\s*${exhibitionId}\\s*-->`))?.[1];
  const title = clean(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').replace(/^exhibitors?\s+list\s*[–—|:-]?\s*/i, '').replace(/\s*[|–—-]\s*$/, '');
  const label = clean(heading ?? '') || title;
  return {
    // The page's <base href> (the site root) is what the relative feed address resolves against.
    feedUrl: new URL(feed[1].replace(/&amp;/g, '&'), new URL(html.match(/<base\s[^>]*href\s*=\s*["']([^"']+)["']/i)?.[1] ?? pageUrl, pageUrl)).toString(),
    exhibitionId,
    pageUrl,
    label,
    year: optionYear ?? yearIn(title) ?? yearIn(label),
    startDate: optionText ? statedStartDates(optionText)[0] ?? null : null,
  };
}

/** One page of an ERA feed. */
export function eraPageUrl(list: EraList, start: number) {
  const url = new URL(list.feedUrl);
  url.searchParams.set('draw', '1');
  url.searchParams.set('start', String(start));
  url.searchParams.set('length', String(ERA_PAGE_SIZE));
  return url.toString();
}

/** Cards from ERA feed rows: [name cell, country, stand, venue?, …]. Group headings ("<!--group-head-->ICE") are not exhibitors. */
export function eraCards(rows: unknown[][], list: EraList): ExhibitorCard[] {
  const cards: ExhibitorCard[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const cell = typeof row[0] === 'string' ? row[0] : '';
    if (!cell || /group-head/.test(cell)) continue;
    const name = clean(cell.replace(/<[^>]+>/g, ' '));
    if (!HAS_WORD.test(name)) continue;
    const href = cell.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const profile = href ? new URL(decodeHtml(href), list.pageUrl).toString() : null;
    const id = profile?.match(/exhibitor-info-\d+-(\d+)/)?.[1] ?? `era:${name.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const stand = typeof row[2] === 'string' ? clean(row[2].replace(/<[^>]+>/g, ' ')) : '';
    const logo = cell.match(/<img[^>]*src\s*=\s*["']([^"']+)["']/i)?.[1];
    cards.push({
      id,
      name,
      logoUrl: logo ? new URL(decodeHtml(logo), list.pageUrl).toString() : null,
      booths: stand ? [stand] : [],
      description: null,
      profileUrl: profile ?? list.pageUrl,
      access: 'public',
    });
  }
  return cards;
}

const parseFeed = (body: unknown) => {
  const data = body as { recordsTotal?: number; data?: unknown[][] };
  return Array.isArray(data?.data) ? { total: Number(data.recordsTotal ?? data.data.length), rows: data.data } : null;
};

async function readFeed(fetcher: Fetcher, url: string) {
  const response = await fetcher(url, { accept: 'application/json,text/html;q=0.5', timeoutMs: 30_000, maxBytes: 10_000_000, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (!isOk(response.status)) throw new Unreachable(`HTTP ${response.status} from ${new URL(url).host}`);
  const text = response.body.toString('utf8');
  try {
    // Some ERA sites print blank lines before the JSON.
    return parseFeed(JSON.parse(text.slice(text.indexOf('{'))));
  } catch {
    throw new Unreachable(`${new URL(url).host} did not return the exhibitor list`);
  }
}

async function resolveEra(list: EraList, foundOn: string, target: EditionTarget, fetcher: Fetcher): Promise<Candidate> {
  if (!list.label) return rejected('iteca', list.pageUrl, list.pageUrl, 'the list page does not name its show');
  if (list.year === null && !list.startDate) return rejected('iteca', list.label, list.pageUrl, `"${list.label}" does not say which year it is for`);
  const verdict = judgeOwnName(target, { label: list.label, year: list.year, startDate: list.startDate });
  if (!verdict.ok) return rejected('iteca', list.label, list.pageUrl, verdict.reason);
  const editionLabel = list.year && !yearIn(list.label) ? `${list.label} ${list.year}` : list.label;
  const source: ExhibitorSource = { platform: 'iteca', platformLabel: 'Official exhibitor list', editionLabel, directoryUrl: list.pageUrl, loginUrl: null, foundOn };

  const first = await readFeed(fetcher, eraPageUrl(list, 0));
  if (!first) throw new Unreachable(`${new URL(list.feedUrl).host} did not return the exhibitor list`);
  const rows = [...first.rows];
  let failed = false;
  for (let start = ERA_PAGE_SIZE; start < Math.min(first.total, MAX_ERA_ROWS); start += ERA_PAGE_SIZE) {
    try {
      const page = await readFeed(fetcher, eraPageUrl(list, start));
      if (!page?.rows.length) break;
      rows.push(...page.rows);
    } catch {
      // What was read stays; the list says how many the feed counts.
      failed = true;
      break;
    }
  }
  const cards = eraCards(rows, list);
  if (!cards.length && failed) throw new Unreachable(`the exhibitor list on ${new URL(list.feedUrl).host} could not be read`);
  if (!cards.length) return { kind: 'empty', source };
  // The feed's count includes group headings, so it is an upper bound: shown only when pages are missing.
  const partial = failed || first.total > MAX_ERA_ROWS;
  return { kind: 'list', source, exhibitors: cards, total: partial ? Math.max(first.total, cards.length) : null, partial };
}

// --- The adapter ----------------------------------------------------------------

type ItecaLead = { kind: 'exponent'; list: ExponentList; url: string } | { kind: 'era'; list: EraList; url: string } | { kind: 'page'; url: string };

/** Leads on one page: embedded lists, and (on an ITECA site) its exhibitor-list pages for this edition's year. */
function leadsOn(html: string, pageUrl: string, site: string, target: EditionTarget): ItecaLead[] {
  const leads: ItecaLead[] = exponentLists(html).map((list) => ({ kind: 'exponent' as const, list, url: pageUrl }));
  const era = eraList(html, pageUrl);
  if (era) leads.push({ kind: 'era', list: era, url: pageUrl });
  if (!ITECA_SITE.test(html)) return leads;
  const year = target.startDate.slice(0, 4);
  for (const match of Array.from(html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi))) {
    try {
      const url = new URL(decodeHtml(match[1]), pageUrl);
      url.hash = '';
      if (!LIST_PAGE.test(url.pathname) || siteKey(url.toString()) !== site || url.toString() === pageUrl) continue;
      // A list page for another year ("…/exhibitors-list-2022") is not read.
      const years = url.pathname.match(/20\d{2}/g);
      if (years && !years.includes(year)) continue;
      leads.push({ kind: 'page', url: url.toString() });
    } catch {
      // Not a URL.
    }
  }
  return leads;
}

const leadKey = (lead: ItecaLead) =>
  lead.kind === 'exponent' ? `iteca:exponent:${lead.list.code.toLowerCase()}` : lead.kind === 'era' ? `iteca:era:${new URL(lead.list.feedUrl).host}:${lead.list.exhibitionId}` : `iteca:page:${lead.url.toLowerCase()}`;

async function resolveLead(lead: ItecaLead, foundOn: string, target: EditionTarget, fetcher: Fetcher, site: string): Promise<Candidate> {
  if (lead.kind === 'exponent') return resolveExponent(lead.list, lead.url, foundOn, target, fetcher);
  if (lead.kind === 'era') return resolveEra(lead.list, foundOn, target, fetcher);
  // An exhibitor-list page: read it, then the list it embeds.
  const page = await readHtml(fetcher, lead.url);
  if (!isOk(page.status)) {
    if (page.status >= 500 || page.status === 429) throw new Unreachable(`HTTP ${page.status} from ${new URL(lead.url).host}`);
    return rejected('iteca', lead.url, lead.url, `the exhibitor list page answered HTTP ${page.status}`);
  }
  const inner = leadsOn(page.html, page.url, site, target).filter((item) => item.kind !== 'page');
  if (!inner.length) return rejected('iteca', lead.url, page.url, 'the page embeds no ITECA exhibitor list');
  const results = await Promise.all(inner.map((item) => resolveLead(item, foundOn, target, fetcher, site)));
  const rank = (candidate: Candidate) => ({ list: 0, login: 1, link: 2, empty: 3, failed: 4, rejected: 5 })[candidate.kind];
  return results.sort((a, b) => rank(a) - rank(b))[0];
}

export const itecaAdapter: ExhibitorAdapter = {
  id: 'iteca',
  detect(page, { site, target }) {
    return leadsOn(page.html, page.url, site, target).map((lead) => ({ adapter: 'iteca' as const, key: leadKey(lead), foundOn: page.url, data: lead }));
  },
  resolve(lead, { target, fetcher, site }) {
    return resolveLead(lead.data as ItecaLead, lead.foundOn, target, fetcher, site);
  },
};
