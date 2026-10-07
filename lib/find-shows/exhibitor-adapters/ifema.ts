/**
 * IFEMA MADRID show catalogues (FITUR, ARCOmadrid, Genera, MOMAD … on
 * ifema.es and IFEMA's own show sites). A show's catalogue page
 * (`/en/<show>/exhibitors/catalogue`, `/<show>/expositores/catalogo`) holds
 * a "LiveConnect" widget:
 *
 *   <section class="live-connect-exhibitors" data-base-url=
 *     "https://lc-events-web-public.ifema.es/api/v1/tenants/<tenant>/editions/<edition>">
 *
 * whose script POSTs `{page: 0, pageSize: 10000, search: "", …}` to
 * `<base>/exhibitors/search?language=en` and gets every exhibitor of that
 * edition at once: name, logo, stands (`{name: "8B17", location: "P08"}`)
 * and co-exhibitors (`parentId`). The same page's data layer names the
 * edition and its dates (`"fair_edicion": "fitur 2027"`,
 * `"fair_dates_off": "20/01/2027 - 24/01/2027"`). An exhibitor's official
 * profile opens in the catalogue with `?exp=<id>`.
 */
import { siteKey } from '../floor-plan';
import { judgeOwnName, shortDescription, yearIn, type EditionTarget, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { decodeHtml } from '../html-tree';
import { Unreachable, isOk, readHtml, rejected, type Candidate, type ExhibitorAdapter } from './types';
import type { Fetcher } from '../floor-plan-discovery';
import type { Poster } from './http';

const WIDGET = /class\s*=\s*["'][^"']*live-connect-exhibitors[^"']*["'][^>]*data-base-url\s*=\s*["'](https:\/\/[^"']+\/api\/v\d+\/tenants\/[0-9a-f-]+\/editions\/[0-9a-f-]+)["']/i;
/** A show's catalogue page, in English or Spanish. */
const CATALOGUE_PATH = /\/(?:exhibitors\/catalogue|expositores\/catalogo)\/?$/i;
const PAGE_SIZE = 10000;
/** Co-located shows checked for a shared catalogue. */
const MAX_SIBLINGS = 8;

export type IfemaCatalogue = { baseUrl: string; pageUrl: string; edition: string; startDate: string | null };

const layerValue = (html: string, key: string) => html.match(new RegExp(`["']${key}["']\\s*:\\s*["']([^"']*)["']`, 'i'))?.[1]?.trim() ?? '';

/** The catalogue a page embeds, with the edition its data layer names. */
export function ifemaCatalogue(html: string, pageUrl: string): IfemaCatalogue | null {
  const base = html.match(WIDGET)?.[1];
  if (!base) return null;
  // "20/01/2027 - 24/01/2027": the edition's first day.
  const dates = layerValue(html, 'fair_dates_off') || layerValue(html, 'fair_dates_on');
  const first = dates.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  const startDate = first ? `${first[3]}-${first[2].padStart(2, '0')}-${first[1].padStart(2, '0')}` : null;
  return { baseUrl: base, pageUrl: pageUrl.replace(/[?#].*$/, ''), edition: decodeHtml(layerValue(html, 'fair_edicion')), startDate };
}

type IfemaExhibitor = {
  id?: string;
  parentId?: string | null;
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  isDisabled?: boolean;
  standsInfo?: { name?: string | null; location?: string | null }[] | null;
};

/** Cards from the catalogue's search answer. Contact fields (email, website) are not kept. */
export function ifemaCards(data: IfemaExhibitor[], catalogue: IfemaCatalogue): ExhibitorCard[] {
  const cards: ExhibitorCard[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    const name = (item.name ?? '').replace(/\s+/g, ' ').trim();
    if (!item.id || !name || item.isDisabled || seen.has(item.id)) continue;
    seen.add(item.id);
    // "P08" + "8B17": hall and stand, as the catalogue shows them.
    const booths = (item.standsInfo ?? [])
      .map((stand) => [stand.location, stand.name].map((part) => (part ?? '').trim()).filter(Boolean).join(' · '))
      .filter(Boolean);
    const profile = new URL(catalogue.pageUrl);
    profile.searchParams.set('exp', item.id);
    cards.push({
      id: item.id,
      name,
      logoUrl: item.imageUrl && !/placeholder/i.test(item.imageUrl) ? item.imageUrl : null,
      booths: Array.from(new Set(booths)),
      description: shortDescription(item.description),
      profileUrl: profile.toString(),
      access: 'public',
    });
  }
  return cards;
}

/** The catalogue edition a show's page leads to: the page's own widget, or the catalogue page it links. */
async function catalogueOf(url: string, fetcher: Fetcher, site: string): Promise<IfemaCatalogue | null> {
  const page = await readHtml(fetcher, url);
  if (!isOk(page.status)) return null;
  const own = ifemaCatalogue(page.html, page.url);
  if (own) return own;
  const link = catalogueLinks(page.html, page.url, site)[0] ?? catalogueLinks(page.html, page.url, siteKey(page.url))[0];
  if (!link) return null;
  const linked = await readHtml(fetcher, link);
  return isOk(linked.status) ? ifemaCatalogue(linked.html, linked.url) : null;
}

/**
 * Co-located IFEMA shows can share one catalogue edition (GENERA with MATELEC, VETECO with
 * CONSTRUTEC), whose exhibitors do not say which show they belong to. A catalogue another
 * show held at the same time also uses is never given to either.
 */
async function sharedWith(catalogue: IfemaCatalogue, target: EditionTarget, fetcher: Fetcher): Promise<string | null> {
  const others = (target.coLocated ?? []).filter((show) => /ifema/i.test(show.website) || siteKey(show.website) === siteKey(catalogue.pageUrl)).slice(0, MAX_SIBLINGS);
  for (const show of others) {
    const url = /^https?:/i.test(show.website) ? show.website : `https://${show.website}`;
    const theirs = await catalogueOf(url, fetcher, siteKey(url));
    if (theirs && theirs.baseUrl.toLowerCase() === catalogue.baseUrl.toLowerCase()) return show.name;
  }
  return null;
}

async function resolveCatalogue(catalogue: IfemaCatalogue, foundOn: string, target: EditionTarget, fetcher: Fetcher, post: Poster): Promise<Candidate> {
  if (!catalogue.edition && !catalogue.startDate) return rejected('ifema', catalogue.pageUrl, catalogue.pageUrl, 'the catalogue does not say which edition it lists');
  const label = catalogue.edition || target.name;
  // Every word of the event must be in the edition's name: MATELEC INDUSTRY is not all of "matelec 2026".
  const verdict = judgeOwnName(target, { label, year: yearIn(label) ?? (catalogue.startDate ? Number(catalogue.startDate.slice(0, 4)) : null), startDate: catalogue.startDate }, { allWords: true });
  if (!verdict.ok) return rejected('ifema', label, catalogue.pageUrl, verdict.reason);
  const shared = await sharedWith(catalogue, target, fetcher);
  if (shared) {
    return rejected('ifema', label, catalogue.pageUrl, `the catalogue is shared with ${shared} and does not say which show each exhibitor belongs to`);
  }

  const url = `${catalogue.baseUrl}/exhibitors/search?language=en`;
  const answer = await post(url, {}, { json: { page: 0, pageSize: PAGE_SIZE, search: '', dynamicFields: [], countryIds: [] }, referer: catalogue.pageUrl, timeoutMs: 60_000 });
  if (!isOk(answer.status)) throw new Unreachable(`HTTP ${answer.status} from ${new URL(url).host}`);
  let body: { data?: IfemaExhibitor[]; hasMoreElements?: boolean; totalElements?: number };
  try {
    body = JSON.parse(answer.body);
  } catch {
    throw new Unreachable(`${new URL(url).host} did not return the exhibitor list`);
  }
  if (!Array.isArray(body.data)) throw new Unreachable(`${new URL(url).host} did not return the exhibitor list`);
  // The data layer writes the edition in lower case ("fitur 2027").
  const editionLabel = label === label.toLowerCase() ? label.toUpperCase() : label;
  const source: ExhibitorSource = { platform: 'ifema', platformLabel: 'Official exhibitor catalogue', editionLabel, directoryUrl: catalogue.pageUrl, loginUrl: null, foundOn };
  const cards = ifemaCards(body.data, catalogue);
  if (!cards.length) return { kind: 'empty', source };
  const partial = Boolean(body.hasMoreElements);
  return { kind: 'list', source, exhibitors: cards, total: partial ? Number(body.totalElements ?? cards.length) : null, partial };
}

type IfemaLead = { kind: 'catalogue'; catalogue: IfemaCatalogue } | { kind: 'page'; url: string };

/** Catalogue pages a show page links on its own site. */
function catalogueLinks(html: string, pageUrl: string, site: string): string[] {
  const links = new Set<string>();
  for (const match of Array.from(html.matchAll(/href\s*=\s*["']([^"'#?]+)["']/gi))) {
    try {
      const url = new URL(decodeHtml(match[1]), pageUrl);
      if (CATALOGUE_PATH.test(url.pathname) && siteKey(url.toString()) === site) links.add(url.toString());
    } catch {
      // Not a URL.
    }
  }
  return Array.from(links);
}

export const ifemaAdapter: ExhibitorAdapter = {
  id: 'ifema',
  detect(page, { site }) {
    const leads: IfemaLead[] = [];
    const catalogue = ifemaCatalogue(page.html, page.url);
    if (catalogue) leads.push({ kind: 'catalogue', catalogue });
    // A show page linking its catalogue (the widget is only on the catalogue page itself).
    else if (/ifema/i.test(page.html)) for (const url of catalogueLinks(page.html, page.url, site)) leads.push({ kind: 'page', url });
    return leads.map((lead) => ({
      adapter: 'ifema' as const,
      key: lead.kind === 'catalogue' ? `ifema:${lead.catalogue.baseUrl.toLowerCase()}` : `ifema:page:${lead.url.toLowerCase()}`,
      foundOn: page.url,
      data: lead,
    }));
  },
  async resolve(lead, { target, fetcher, post }) {
    const data = lead.data as IfemaLead;
    if (data.kind === 'catalogue') return resolveCatalogue(data.catalogue, lead.foundOn, target, fetcher, post);
    const page = await readHtml(fetcher, data.url);
    if (!isOk(page.status)) {
      if (page.status >= 500 || page.status === 429) throw new Unreachable(`HTTP ${page.status} from ${new URL(data.url).host}`);
      return rejected('ifema', data.url, data.url, `the catalogue page answered HTTP ${page.status}`);
    }
    const catalogue = ifemaCatalogue(page.html, page.url);
    if (!catalogue) return rejected('ifema', data.url, page.url, 'the page holds no IFEMA exhibitor catalogue');
    return resolveCatalogue(catalogue, lead.foundOn, target, fetcher, post);
  },
};
