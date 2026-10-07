/**
 * dmg events' "marketing manual" exhibitor lists (ADIPEC and similar dmg
 * energy shows): the official exhibitor-list page is a script app whose own
 * bundle names a public API on the organizer's domain —
 * `https://marketingmanual.<site>/api/exhibitor/getallexhibitorslist` — the
 * profile address (`/exhibition/exhibitordetails?exhibitorid=${id}`) and the
 * logo host. The adapter reads those from the bundle the official page loads,
 * then the list: company, stand, hall, logo.
 *
 * Edition: every stand record carries the edition in its id ("ADIPEC26-178-3")
 * and the list page announces its dates; both must be this edition's.
 */
import { siteKey } from '../floor-plan';
import { judgeEdition, type EditionTarget, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { parseHtml, textOf } from '../html-tree';
import { LIST_PAGE, judgeOrganizerPage } from './organizer-directory';
import { Unreachable, isOk, readJson, rejected, type ExhibitorAdapter } from './types';

export type MarketingManualLead = { pageUrl: string; scriptUrl: string };

export type MarketingManualConfig = { apiBase: string; profileTemplate: string; logoBase: string };

/** What the official list page's own bundle says: API base, profile address template, logo host — all on the official site. */
export function marketingManualConfig(bundle: string, site: string): MarketingManualConfig | null {
  const apiBase = bundle.match(/["'`](https:\/\/[a-z0-9.-]+\/api\/exhibitor\/)["'`]/i)?.[1];
  if (!apiBase || siteKey(apiBase) !== site) return null;
  const profile = bundle.match(/["'`](\/[a-z0-9/_-]*exhibitordetails\?exhibitorid=)\$\{[a-z_$.]+\}/i)?.[1];
  const logoBase = bundle.match(/src:\s*["'`](https:\/\/[a-z0-9.-]+\/)["'`]\s*\+\s*[a-z_$.]*companyLogo/i)?.[1] ?? `${new URL(apiBase).origin}/`;
  return profile ? { apiBase, profileTemplate: profile, logoBase } : null;
}

type ManualRecord = { id?: number | string; standOppId?: string; companyName?: string; companyLogo?: string | null; standNumber?: string; hall?: string };

/** The edition year the stand ids name ("ADIPEC26-178-3" → 2026), when most records agree. */
export function standEditionYear(records: ManualRecord[]): number | null {
  const years = new Map<number, number>();
  for (const record of records) {
    const yy = record.standOppId?.match(/^[a-z]+(\d{2})-/i)?.[1];
    if (yy) years.set(2000 + Number(yy), (years.get(2000 + Number(yy)) ?? 0) + 1);
  }
  const [best] = Array.from(years.entries()).sort((a, b) => b[1] - a[1]);
  return best && best[1] >= records.length / 2 ? best[0] : null;
}

export function marketingManualCards(records: ManualRecord[], config: MarketingManualConfig, origin: string): ExhibitorCard[] {
  const cards: ExhibitorCard[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const name = (record.companyName ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    const id = record.id === undefined || record.id === null ? '' : String(record.id);
    if (!name || !id || seen.has(id)) continue;
    seen.add(id);
    const booth = [record.hall?.trim(), record.standNumber?.trim()].filter(Boolean).join(' / ');
    const logo = record.companyLogo?.trim();
    cards.push({
      id,
      name,
      logoUrl: logo ? `${config.logoBase}${logo.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}` : null,
      booths: booth ? [booth] : [],
      description: null,
      profileUrl: `${origin}${config.profileTemplate}${encodeURIComponent(id)}`,
      access: 'public',
    });
  }
  return cards;
}

/** The show dates an official page announces, for the edition check. */
function pageText(html: string) {
  return textOf(parseHtml(html));
}

export const dmgMarketingManualAdapter: ExhibitorAdapter = {
  id: 'dmg-marketing-manual',
  detect(page, { site }) {
    if (!LIST_PAGE.test(new URL(page.url).pathname)) return [];
    // Script sources from the raw page: the HTML tree drops script elements.
    const scripts = Array.from(page.html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi))
      .map((match) => {
        try {
          return new URL(match[1], page.url).toString();
        } catch {
          return '';
        }
      })
      // The list app's own bundle, served from the official site.
      .filter((url) => url && siteKey(url) === site && /exhibitor/i.test(new URL(url).pathname));
    return scripts.map((scriptUrl) => ({ adapter: 'dmg-marketing-manual' as const, key: `mm:${scriptUrl.split('?')[0]}`, foundOn: page.url, data: { pageUrl: page.url, scriptUrl } }));
  },

  async resolve(raw, { target, fetcher, site, pages }) {
    const lead = raw.data as MarketingManualLead;
    const bundle = await fetcher(lead.scriptUrl, { accept: 'application/javascript,*/*;q=0.5', timeoutMs: 30_000, maxBytes: 6_000_000 });
    if (!isOk(bundle.status)) throw new Unreachable(`HTTP ${bundle.status} from ${new URL(lead.scriptUrl).host}`);
    const config = marketingManualConfig(bundle.body.toString('utf8'), site);
    if (!config) return rejected('dmg-marketing-manual', lead.pageUrl, lead.pageUrl, 'the list page’s script names no exhibitor list');
    const answer = (await readJson(fetcher, `${config.apiBase}getallexhibitorslist`)) as { result?: ManualRecord[] } | ManualRecord[];
    const records = Array.isArray(answer) ? answer : answer.result;
    if (!Array.isArray(records)) throw new Unreachable('the exhibitor list returned an unexpected response');

    const year = standEditionYear(records);
    const label = `${target.name} ${year ?? ''}`.trim();
    const verdict = checkEdition(target, label, year, pages.find((page) => page.url === lead.pageUrl)?.html);
    if (!verdict.ok) return rejected('dmg-marketing-manual', label, lead.pageUrl, verdict.reason);

    const source: ExhibitorSource = {
      platform: 'dmg-marketing-manual',
      platformLabel: 'Official exhibitor list',
      editionLabel: label,
      directoryUrl: lead.pageUrl,
      loginUrl: null,
      foundOn: raw.foundOn,
    };
    const cards = marketingManualCards(records, config, new URL(lead.pageUrl).origin);
    return cards.length ? { kind: 'list', source, exhibitors: cards } : { kind: 'empty', source };
  },
};

/** The stand ids' year must be this edition's, and so must the dates the list page announces. */
function checkEdition(target: EditionTarget, label: string, year: number | null, pageHtml: string | undefined) {
  if (!year) return { ok: false, reason: 'the exhibitor records do not say which edition they are for' };
  const byYear = judgeEdition(target, { label, year });
  if (!byYear.ok) return byYear;
  return pageHtml ? judgeOrganizerPage(target, label, pageText(pageHtml)) : byYear;
}
