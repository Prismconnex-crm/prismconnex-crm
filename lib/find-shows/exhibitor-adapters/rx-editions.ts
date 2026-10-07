/**
 * RX site builder shows that run several editions and co-located shows from
 * one site (RX Japan's `nepconjapan.jp`, `fashion-tokyo.jp`, `wsew.jp` … and
 * any other RX site laid out the same way).
 *
 *  - Hubs: the site's `/hub/en-gb.html` (or a show's "about" page) carries no
 *    edition; it links each edition's home as `/<edition>/<locale>.html`
 *    (`/tokyo/ja-jp.html`, `/autumn/en-gb.html`). Those homes carry the
 *    edition's settings (dates, venue, directory index).
 *  - Co-located shows: one edition index can hold several shows ("NEPCON
 *    JAPAN", "AUTOMOTIVE WORLD" …). Each exhibitor's record names its own show
 *    in English in `exhibitorFilters.Exhibition` — `lvl0` the show, `lvl1`
 *    "<show> > <zone show>". A catalog event is matched to one of those names
 *    and only that show's exhibitors are listed; the whole edition is listed
 *    only when the event is the edition itself (its umbrella name). When the
 *    index does not say which show an exhibitor belongs to, a co-located show
 *    is never given the edition's list.
 *
 * Edition names are often Japanese ("ネプコン ジャパン"); the edition's dates
 * and venue identify it, and the English page title names the umbrella.
 */
import { cityTermsFor, normalize } from '../floor-plan';
import { rxSettings, type EditionTarget, type RxSettings } from '../exhibitors';
import { decodeHtml } from '../html-tree';
import { Unreachable, isOk, readHtml } from './types';
import type { Fetcher } from '../floor-plan-discovery';

/** An edition home: `/<edition>/<locale>.html`. */
const EDITION_HOME = /^\/([a-z0-9-]+)\/([a-z]{2}-[a-z]{2})\.html$/i;
/** The RX site builder's own asset paths, present on every page it renders. */
const SITE_BUILDER = /\/etc\/designs\/rx\/sitebuilder\/|\/content\/dam\/sitebuilder\//i;
const NON_LATIN = /[぀-ヿ㐀-鿿가-힯]/;
/** Pages read while following a hub: the hub, its editions, and hubs an edition redirects to. */
export const MAX_HUB_PAGES = 10;

/** Words that never tell two shows apart. "Week" and "World" do (COSME Week is not COSME OSAKA), so they stay. */
const MATCH_STOP = new Set([
  'the', 'and', 'of', 'for', 'in', 'on', 'at', 'a', 's', 'expo', 'exhibition', 'show', 'fair', 'trade', 'tradeshow', 'international', 'intl',
  'official', 'japan', 'jp', 'edition', 'spring', 'summer', 'autumn', 'fall', 'winter', 'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov',
  'dec', 'tokyo', 'osaka', 'nagoya', 'kobe', 'chiba', 'makuhari', 'yokohama', 'fukuoka', 'kansai', 'rx',
]);

/** The words that name a show, in order: Latin, no codes or years, no places or seasons, singular. */
export function showWordList(name: string, city = ''): string[] {
  const places = new Set(cityTermsFor(city).flatMap((term) => term.split(' ')));
  const words = normalize(decodeHtml(name).replace(/[［\[(（【][^\]］)）】]*[\]］)）】]/g, ' '))
    .split(' ')
    .filter((word) => word && !NON_LATIN.test(word) && !/\d/.test(word) && !MATCH_STOP.has(word) && !places.has(word))
    .map((word) => (word.length > 3 && /[^s]s$/.test(word) ? word.slice(0, -1) : word));
  return words;
}

export const showWords = (name: string, city = '') => new Set(showWordList(name, city));

const isSubset = (small: Set<string>, big: Set<string>) => Array.from(small).every((word) => big.has(word));
const sameWords = (a: Set<string>, b: Set<string>) => a.size === b.size && isSubset(a, b);

/** One show of an edition, as its index names it. */
export type RxComponent = { attribute: string; value: string; name: string; count: number };

/** "915061:4: NEPCON JAPAN > PWB EXPO" → "PWB EXPO". */
export function componentName(value: string) {
  return value.replace(/^\d+:\d+:\s*/, '').split(' > ').pop()!.replace(/\s+/g, ' ').trim();
}

/** The shows an edition's index lists, from its facet counts. */
export function rxComponents(facets: Record<string, Record<string, number>> | undefined): RxComponent[] {
  const components: RxComponent[] = [];
  for (const attribute of COMPONENT_FACETS) {
    for (const [value, count] of Object.entries(facets?.[attribute] ?? {})) {
      const name = componentName(value);
      if (name && !NON_LATIN.test(name)) components.push({ attribute, value, name, count });
    }
  }
  return components;
}

export const COMPONENT_FACETS = ['exhibitorFilters.Exhibition.lvl0', 'exhibitorFilters.Exhibition.lvl1'];

export type ShowMatch =
  /** One show, or a family of zone shows under the event's name ("J-AGRI SUPPLY", "J-AGRI TECH" … for J AGRI). */
  | { kind: 'component'; components: RxComponent[]; name: string }
  | { kind: 'edition'; name: string | null }
  | { kind: 'none'; reason: string };

/**
 * Which of an edition's shows the catalog event is: one co-located show (its
 * exhibitors only), the edition itself (its umbrella name), or neither.
 *
 * `umbrellas` are the edition's own English names (its settings name, its
 * home page's title); `labelMatches` is whether the edition's stated name
 * already passed the ordinary name check.
 */
export function matchShow(target: EditionTarget, components: RxComponent[], umbrellas: string[], labelMatches: boolean): ShowMatch {
  const wanted = showWords(target.name, target.city);
  if (!wanted.size) return { kind: 'none', reason: `"${target.name}" has no name to match against the edition's shows` };
  const shows = components
    .map((component) => ({ component, order: showWordList(component.name, target.city), words: showWords(component.name, target.city) }))
    .filter((show) => show.words.size);
  const one = (component: RxComponent): ShowMatch => ({ kind: 'component', components: [component], name: component.name });
  const names = umbrellas.map((name) => ({ name, words: showWords(name, target.city) })).filter((item) => item.words.size);
  // lvl0 lists before lvl1, so a show named at both levels resolves to the whole show.
  const single = (list: typeof shows): ShowMatch | null => {
    const distinct = Array.from(new Map(list.map((show) => [Array.from(show.words).sort().join(' '), show])).values());
    return distinct.length === 1 ? one(distinct[0].component) : null;
  };

  const exact = shows.filter((show) => sameWords(show.words, wanted));
  if (exact.length) return one(exact[0].component);
  const umbrella = names.find((item) => sameWords(item.words, wanted));
  if (umbrella) return { kind: 'edition', name: umbrella.name };
  // "PWB EXPO - PRINTED WIRING BOARDS EXPO" contains "PRINTED WIRING BOARD EXPO": the largest show named inside the event.
  const inside = shows.filter((show) => isSubset(show.words, wanted));
  if (inside.length) {
    const largest = Math.max(...inside.map((show) => show.words.size));
    const best = single(inside.filter((show) => show.words.size === largest));
    if (best) return best;
    return { kind: 'none', reason: `"${target.name}" could be several of the edition's shows` };
  }
  // "EV JAPAN" inside "EV JAPAN EV,HV&FCV Technology Expo": only when one show alone fits.
  const around = shows.filter((show) => isSubset(wanted, show.words));
  if (around.length) {
    const alone = single(around);
    if (alone) return alone;
    // Zone shows that all start with the event's name ("J-AGRI SUPPLY", "J-AGRI TECH" for J AGRI) are that
    // event together — never the edition's other shows (GARDEX, TOOL JAPAN).
    const lead = showWordList(target.name, target.city);
    const family = around.filter((show) => show.component.attribute === around[0].component.attribute && lead.every((word, index) => show.order[index] === word));
    // Two words at least ("J AGRI"): one word ("FASHION") is too loose to name a family.
    if (lead.length >= 2 && family.length === around.length && family.length >= 2) {
      return { kind: 'component', components: family.map((show) => show.component), name: target.name };
    }
    return { kind: 'none', reason: `"${target.name}" could be several of the edition's shows` };
  }
  if (shows.some((show) => Array.from(show.words).some((word) => wanted.has(word)))) {
    return { kind: 'none', reason: `"${target.name}" is none of the edition's shows exactly` };
  }
  if (labelMatches) return { kind: 'edition', name: null };
  // "WORLD SMART ENERGY WEEK" for an edition titled "SMART ENERGY WEEK".
  const within = names.find((item) => item.words.size >= 2 && isSubset(item.words, wanted));
  if (within) return { kind: 'edition', name: within.name };
  if (!names.length && !components.length) {
    return { kind: 'none', reason: `the edition names no show in English and its index does not say which co-located show each exhibitor belongs to` };
  }
  const shown = [...names.map((item) => item.name), ...components.map((component) => component.name)].slice(0, 4);
  return { kind: 'none', reason: `the edition (${shown.join(', ')}) names a different show` };
}

/** The English names a page gives its edition: its `<title>`, whole and in parts, when the page is an edition's home. */
export function editionTitles(html: string, pageUrl: string): string[] {
  let path = '';
  try {
    path = new URL(pageUrl).pathname;
  } catch {
    return [];
  }
  // Only an edition home speaks for the whole edition; a co-located show's own page has that show's title.
  if (!EDITION_HOME.test(path) && !/^\/[a-z]{2}-[a-z]{2}\.html$/i.test(path)) return [];
  const title = decodeHtml(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  if (!title || NON_LATIN.test(title)) return [];
  const parts = title.split(/\s*[|｜]\s*/).filter(Boolean);
  const pieces = parts.flatMap((part) => part.split(/\s+[-–—]\s+/)).filter(Boolean);
  return Array.from(new Set([title.replace(/\s*[|｜].*$/, ''), ...parts, ...pieces]));
}

/** Whether a page is rendered by the RX site builder. */
export const isRxSiteBuilder = (html: string) => SITE_BUILDER.test(html) || Boolean(rxSettings(html));

/** Edition homes a page links on its own host, English first: `/tokyo/ja-jp.html` → `/tokyo/en-gb.html`, then itself. */
export function editionHomeLinks(html: string, pageUrl: string): string[] {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }
  const found = new Set<string>();
  const add = (href: string) => {
    try {
      const url = new URL(decodeHtml(href), base);
      if (url.host.toLowerCase() !== base.host.toLowerCase() || !EDITION_HOME.test(url.pathname)) return;
      const [, segment, locale] = url.pathname.match(EDITION_HOME)!;
      const origin = `${base.protocol}//${base.host.toLowerCase()}`;
      found.add(`${origin}/${segment.toLowerCase()}/en-gb.html`);
      found.add(`${origin}/${segment.toLowerCase()}/${locale.toLowerCase()}.html`);
    } catch {
      // Not a URL.
    }
  };
  add(base.pathname);
  for (const match of Array.from(html.matchAll(/href\s*=\s*["']([^"'#?]+)/gi))) add(match[1]);
  return Array.from(found);
}

/** Whether a page's own settings already identify this edition (then its hub need not be followed). */
export function settingsFitTarget(settings: RxSettings | null, target: EditionTarget) {
  if (!settings?.startDate || !settings.location || NON_LATIN.test(settings.location)) return false;
  const days = Math.abs(Date.parse(settings.startDate.slice(0, 10)) - Date.parse(target.startDate)) / 86_400_000;
  return days <= (target.approximate ? 45 : 7);
}

export type RxEditionPage = { settings: RxSettings; titles: string[]; url: string };

/**
 * Follow a site's edition homes (and the hubs they redirect to) to the
 * editions they describe, once each. Throws `Unreachable` only when nothing
 * could be read at all.
 */
export async function followEditionHomes(start: string[], fetcher: Fetcher): Promise<{ editions: RxEditionPage[]; failures: string[] }> {
  const queue = start.map((url) => ({ url, depth: 0 }));
  const seen = new Set<string>();
  const editions = new Map<string, RxEditionPage>();
  const failures: string[] = [];
  const read = new Set<string>();
  let reads = 0;
  while (queue.length && reads < MAX_HUB_PAGES) {
    const { url, depth } = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    // A Japanese home is read only when its English twin could not be.
    const twin = url.replace(/\/[a-z]{2}-[a-z]{2}\.html$/i, '/en-gb.html');
    if (twin !== url && read.has(twin)) continue;
    reads += 1;
    let page: { url: string; status: number; html: string };
    try {
      page = await readHtml(fetcher, url);
    } catch (error) {
      failures.push(`${url}: ${(error as Error).message}`);
      continue;
    }
    if (!isOk(page.status)) continue;
    read.add(url);
    seen.add(page.url);
    const settings = rxSettings(page.html);
    if (settings) {
      const known = editions.get(settings.eventEditionId);
      // The English page's settings name its venue in Latin letters: keep those.
      if (!known || (known.settings.location && NON_LATIN.test(known.settings.location) && settings.location && !NON_LATIN.test(settings.location))) {
        editions.set(settings.eventEditionId, { settings, titles: editionTitles(page.html, page.url), url: page.url });
      }
      continue;
    }
    // No edition here (a hub, or an edition that has ended and redirects to its hub): follow its editions.
    if (depth < 2) for (const link of editionHomeLinks(page.html, page.url)) if (!seen.has(link)) queue.push({ url: link, depth: depth + 1 });
  }
  if (!editions.size && failures.length) throw new Unreachable(`the edition pages could not be read (${failures[0]})`);
  return { editions: Array.from(editions.values()), failures };
}

export { NON_LATIN };
