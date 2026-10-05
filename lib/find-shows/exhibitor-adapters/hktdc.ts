/**
 * HKTDC fairs (hktdc.com: Electronics, Lighting, Toys, Baby Products, Wine …).
 * A fair's exhibitor list is a server-rendered Next.js page,
 * `/event/<fairCode>/en/exhibitor-list?pageNum=N&pageSize=100`, whose
 * `__NEXT_DATA__` carries:
 *
 *  - `siteSettings.fairDtl`: the edition the site is for, with its fair code,
 *    fiscal year ("2627" = April 2026 – March 2027), name
 *    ("electronicAsia 2026") and opening day (`wins_event_start_datetime`);
 *  - `exhibitorListData`: `totalSize` and one page of exhibitors, each naming
 *    its own fair (`fairSymbol`) and edition (`fairFiscalYear`), booths and
 *    logo; the official profile is `/event/<fairCode>/en/exhibitor/<urn>`.
 *
 * Fairs held together (Electronics Fair with electronicAsia) are told apart
 * by `fairSymbol`. Between editions a site can still show the previous
 * edition's list: exhibitors whose fiscal year is not the site's edition are
 * never shown for it.
 */
import { judgeOwnName, yearIn, type EditionTarget, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { Unreachable, isOk, readHtml, rejected, type Candidate, type ExhibitorAdapter } from './types';
import type { Fetcher } from '../floor-plan-discovery';

const ORIGIN = 'https://www.hktdc.com';
const HKTDC_HOST = /(?:^|\.)hktdc\.com$/i;
const PAGE_SIZE = 100;
const MAX_PAGES = 60;

type FairDetail = {
  fair_code?: string;
  fiscal_year?: string;
  wins_event_name?: string;
  wins_event_start_datetime?: string;
  fair_display_name?: { en?: string };
  fair_short_name?: { en?: string };
};
type HktdcExhibitor = { exhibitorName?: string; supplierLogo?: string | null; boothNumbers?: string | null; exhibitorUrn?: string; fairSymbol?: string; fairFiscalYear?: string };
export type HktdcPage = { fair: FairDetail; total: number; exhibitors: HktdcExhibitor[] };

/** The fair codes a page belongs to or links: `/event/<code>/<locale>`, `/fair/<code>-<locale>`, or its page data. */
export function hktdcFairCodes(html: string, pageUrl: string): string[] {
  const codes = new Set<string>();
  const add = (url: string) => {
    try {
      const parsed = new URL(url, pageUrl);
      if (!HKTDC_HOST.test(parsed.hostname)) return;
      const match = parsed.pathname.match(/^\/event\/([a-z0-9]+)\/(?:en|tc|sc)(?:\/|$)/i) ?? parsed.pathname.match(/^\/fair\/([a-z0-9]+)-(?:en|tc|sc)(?:\/|$)/i);
      if (match) codes.add(match[1].toLowerCase());
    } catch {
      // Not a URL.
    }
  };
  add(pageUrl);
  const own = html.match(/"fairOption"\s*:\s*\{[^}]*"fairCode"\s*:\s*"([a-z0-9]+)"/i)?.[1];
  if (own && HKTDC_HOST.test(new URL(pageUrl).hostname)) codes.add(own.toLowerCase());
  for (const match of Array.from(html.matchAll(/href\s*=\s*["']([^"']*\/event\/[a-z0-9]+\/en\/exhibitor-list[^"']*)["']/gi))) add(match[1]);
  return Array.from(codes);
}

export const hktdcListUrl = (fairCode: string, pageNum = 1) => `${ORIGIN}/event/${fairCode}/en/exhibitor-list?fairCode=${fairCode}&locale=en&pageNum=${pageNum}&pageSize=${PAGE_SIZE}`;

/** The edition and the exhibitors one list page carries. */
export function hktdcPage(html: string): HktdcPage | null {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;
  let props: { siteSettings?: { fairDtl?: FairDetail }; exhibitorListData?: { totalSize?: number; data?: HktdcExhibitor[] } };
  try {
    props = (JSON.parse(raw) as { props?: { pageProps?: typeof props } }).props?.pageProps ?? {};
  } catch {
    return null;
  }
  const list = props.exhibitorListData;
  if (!props.siteSettings?.fairDtl || !list || !Array.isArray(list.data)) return null;
  return { fair: props.siteSettings.fairDtl, total: Number(list.totalSize ?? list.data.length), exhibitors: list.data };
}

/** "HKTDC Hong Kong Electronics Fair (Autumn Edition)" → "Hong Kong Electronics Fair (Autumn Edition)": the organizer's brand is not the show. */
const withoutBrand = (name: string) => name.replace(/^\s*HKTDC\s+/i, '').trim();

export function hktdcCards(exhibitors: HktdcExhibitor[], fairCode: string): ExhibitorCard[] {
  const cards: ExhibitorCard[] = [];
  const seen = new Set<string>();
  for (const item of exhibitors) {
    const name = (item.exhibitorName ?? '').replace(/\s+/g, ' ').trim();
    if (!item.exhibitorUrn || !name || seen.has(item.exhibitorUrn)) continue;
    seen.add(item.exhibitorUrn);
    cards.push({
      id: item.exhibitorUrn,
      name,
      logoUrl: item.supplierLogo || null,
      booths: (item.boothNumbers ?? '').split(/\s*[,;]\s*/).filter(Boolean),
      description: null,
      profileUrl: `${ORIGIN}/event/${fairCode}/en/exhibitor/${item.exhibitorUrn}`,
      access: 'public',
    });
  }
  return cards;
}

async function readPage(fetcher: Fetcher, url: string) {
  const page = await readHtml(fetcher, url);
  if (!isOk(page.status)) throw new Unreachable(`HTTP ${page.status} from ${new URL(url).host}`);
  return { url: page.url, parsed: hktdcPage(page.html) };
}

async function resolveFair(fairCode: string, foundOn: string, target: EditionTarget, fetcher: Fetcher): Promise<Candidate> {
  const firstUrl = hktdcListUrl(fairCode);
  const first = await readPage(fetcher, firstUrl);
  if (!first.parsed) return rejected('hktdc', fairCode, firstUrl, 'the page carries no HKTDC exhibitor list');
  const { fair } = first.parsed;
  const code = (fair.fair_code ?? fairCode).toLowerCase();
  const label = withoutBrand(fair.wins_event_name || fair.fair_display_name?.en || code);
  const names = [fair.fair_display_name?.en, fair.fair_short_name?.en].filter((name): name is string => Boolean(name)).map(withoutBrand);
  const startDate = fair.wins_event_start_datetime?.slice(0, 10) ?? null;
  const verdict = judgeOwnName(target, { label, names, year: yearIn(label) ?? (startDate ? Number(startDate.slice(0, 4)) : null), startDate });
  if (!verdict.ok) return rejected('hktdc', label, firstUrl, verdict.reason);

  const directoryUrl = `${ORIGIN}/event/${code}/en/exhibitor-list`;
  const source: ExhibitorSource = { platform: 'hktdc', platformLabel: 'Official exhibitor list', editionLabel: label, directoryUrl, loginUrl: null, foundOn };
  // This fair's exhibitors, of this edition only (between editions the list can still be the last one's).
  const own = (items: HktdcExhibitor[]) => items.filter((item) => (item.fairSymbol ?? code).toLowerCase() === code && (!fair.fiscal_year || item.fairFiscalYear === fair.fiscal_year));
  const firstOwn = own(first.parsed.exhibitors);
  if (first.parsed.exhibitors.length && !firstOwn.length) {
    const shown = first.parsed.exhibitors[0].fairFiscalYear;
    return rejected('hktdc', label, directoryUrl, `the list still shows the ${shown ? `20${shown.slice(0, 2)}/${shown.slice(2)} ` : 'previous '}edition's exhibitors`);
  }
  if (!first.parsed.total) return { kind: 'empty', source };

  const exhibitors = [...firstOwn];
  const pages = Math.min(Math.ceil(first.parsed.total / PAGE_SIZE), MAX_PAGES);
  let failed = false;
  for (let pageNum = 2; pageNum <= pages; pageNum += 1) {
    try {
      const page = await readPage(fetcher, hktdcListUrl(code, pageNum));
      if (!page.parsed) {
        failed = true;
        break;
      }
      exhibitors.push(...own(page.parsed.exhibitors));
    } catch {
      // What was read stays; the list says how many the fair counts.
      failed = true;
      break;
    }
  }
  const cards = hktdcCards(exhibitors, code);
  if (!cards.length) return { kind: 'empty', source };
  const partial = failed || Math.ceil(first.parsed.total / PAGE_SIZE) > MAX_PAGES;
  return { kind: 'list', source, exhibitors: cards, total: partial ? first.parsed.total : null, partial };
}

export const hktdcAdapter: ExhibitorAdapter = {
  id: 'hktdc',
  detect(page) {
    return hktdcFairCodes(page.html, page.url).map((code) => ({ adapter: 'hktdc' as const, key: `hktdc:${code}`, foundOn: page.url, data: code }));
  },
  resolve(lead, { target, fetcher }) {
    return resolveFair(lead.data as string, lead.foundOn, target, fetcher);
  },
};
