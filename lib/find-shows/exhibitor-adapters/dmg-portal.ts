/**
 * dmg events' exhibitor portals (Big 5, Gulfood Manufacturing, GITEX and the
 * other shows run on the same "exhibitor online manual" platform):
 * `exhibitors.<site>/<Event-Name-2026>/Exhibitor(s)`. The edition is in the
 * address and the page title. The list page loads its cards the way its own
 * script does, through one of the platform's two public form requests:
 *
 *  - a pager, `…/ajaxPaginationData/<offset>`, sent the page's hidden fields
 *    (`event_slug`, `selected_pass_event`); pages say "Showing 17 to 32 of 1265";
 *  - an infinite list, `…/fetchExhibitors`, paged by `limit`/`start` until empty.
 *
 * Only the public fields the page itself sends are used — no cookies, no login.
 * If paging stops early, the result says it is partial.
 */
import { siteKey } from '../floor-plan';
import { judgeEdition, yearIn, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { descendants, parseHtml } from '../html-tree';
import { extractDirectoryPage, hasScriptPager, statedTotal } from './organizer-directory';
import { Unreachable, isOk, readHtml, rejected, type ExhibitorAdapter } from './types';

/** A dmg portal list address: `exhibitors.<domain>/<slug ending in the year>/Exhibitor(s)`. */
export const DMG_PORTAL = /^https?:\/\/(exhibitors?\.[a-z0-9.-]+)\/([a-z0-9-]*?(20\d{2}))\/(exhibitors?)(?=[/?#]|$)/i;

const MAX_REQUESTS = 150;
const INFINITE_PAGE = 100;

/** "Big-5-Global-2026" → "Big 5 Global 2026". */
export const dmgLabel = (slug: string) => slug.replace(/-+/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase()).trim();

/** The page's hidden form fields, which its pager sends back. */
export function hiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const node of descendants(parseHtml(html))) {
    if (node.tag === 'input' && (node.attrs.type ?? '').toLowerCase() === 'hidden' && node.attrs.name) fields[node.attrs.name] = node.attrs.value ?? '';
  }
  return fields;
}

export type DmgPortalLead = { listUrl: string; slug: string; year: number };

export const dmgPortalAdapter: ExhibitorAdapter = {
  id: 'dmg-portal',
  detect(page) {
    const found = new Map<string, DmgPortalLead>();
    const candidates = [page.url, ...Array.from(page.html.matchAll(/https?:\/\/exhibitors?\.[a-z0-9.-]+\/[a-z0-9-]*?20\d{2}\/exhibitors?(?=[/?#"'\s<]|$)/gi)).map((match) => match[0])];
    for (const url of candidates) {
      const match = url.match(DMG_PORTAL);
      if (!match) continue;
      const listUrl = `https://${match[1].toLowerCase()}/${match[2]}/${match[4]}`;
      found.set(listUrl.toLowerCase(), { listUrl, slug: match[2], year: Number(match[3]) });
    }
    return Array.from(found.values()).map((lead) => ({ adapter: 'dmg-portal' as const, key: `dmg:${lead.listUrl.toLowerCase()}`, foundOn: page.url, data: lead }));
  },

  async resolve(raw, { target, fetcher, post }) {
    const lead = raw.data as DmgPortalLead;
    const page = await readHtml(fetcher, lead.listUrl);
    if (!isOk(page.status)) {
      if (page.status >= 500 || page.status === 429 || page.status === 403) throw new Unreachable(`HTTP ${page.status} from ${new URL(lead.listUrl).host}`);
      return rejected('dmg-portal', dmgLabel(lead.slug), lead.listUrl, `the exhibitor portal answered HTTP ${page.status}`);
    }
    const title = page.html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '';
    const label = title.split('|').map((part) => part.trim()).find((part) => yearIn(part)) ?? dmgLabel(lead.slug);
    const verdict = judgeEdition(target, { label, year: yearIn(label) ?? lead.year });
    if (!verdict.ok) return rejected('dmg-portal', label, lead.listUrl, verdict.reason);
    if (yearIn(label) && yearIn(label) !== lead.year) return rejected('dmg-portal', label, lead.listUrl, `the portal address is for ${lead.year}, its title for ${yearIn(label)}`);

    const site = siteKey(lead.listUrl);
    const cards = new Map<string, ExhibitorCard>();
    const add = (html: string) => {
      const before = cards.size;
      for (const card of extractDirectoryPage(html, lead.listUrl, site, 1)?.cards ?? []) if (!cards.has(card.profileUrl)) cards.set(card.profileUrl, card);
      return cards.size - before;
    };
    add(page.html);
    let total = statedTotal(page.html);
    let stoppedEarly = false;

    const fields = hiddenFields(page.html);
    const pagerUrl = page.html.match(/url:\s*["']([^"']*ajaxPaginationData\/?)["']/i)?.[1];
    // The infinite list's call sits in the page's own script, or in a script file it loads: a page
    // with no cards and no pager of its own is read through it (and only its cards are kept).
    const infinite = /\/fetchExhibitors\b|fetchExhibitors['"]/.test(page.html) || (!cards.size && !pagerUrl);

    if (infinite) {
      // The infinite list: `limit`/`start` until a page comes back empty.
      const url = `${lead.listUrl.replace(/\/$/, '')}/fetchExhibitors`;
      for (let request = 0, start = 0; request < MAX_REQUESTS; request += 1, start += INFINITE_PAGE) {
        let answer;
        try {
          answer = await post(url, { limit: String(INFINITE_PAGE), start: String(start), keyword_search: '', cuntryId: '', InitialKey: '', start_up_exhibitors: '', type: '' }, { referer: lead.listUrl });
        } catch {
          stoppedEarly = true;
          break;
        }
        if (!isOk(answer.status)) {
          stoppedEarly = true;
          break;
        }
        if (!answer.body.trim() || add(answer.body) === 0) break;
        if (request === MAX_REQUESTS - 1) stoppedEarly = true;
      }
    } else if (pagerUrl && fields.event_slug) {
      // The pager: offsets of one page each, until the stated total or an empty page.
      const base = pagerUrl.replace(/\/$/, '');
      const form = (offset: number) => ({
        ExhibitorDataView: fields.ExhibitorDataView || '1',
        event_id: fields.selected_pass_event ?? fields.event_id ?? '',
        sortBy: '',
        page: String(offset),
        keyword_search: '',
        selectedCountries: '',
        InitialKey: '',
        selectedCategories: '',
        selectedSubCategories: '',
        selectedSubSubCategories: '',
        selectedVenues: '',
        selectedSectors: '[]',
        event_slug: fields.event_slug,
      });
      let offset = 0;
      let pageSize = 0;
      for (let request = 0; request < MAX_REQUESTS; request += 1) {
        let answer;
        try {
          answer = await post(`${base}/${offset}`, form(offset), { referer: lead.listUrl });
        } catch {
          stoppedEarly = true;
          break;
        }
        if (!isOk(answer.status)) {
          stoppedEarly = true;
          break;
        }
        total = total ?? statedTotal(answer.body);
        const read = extractDirectoryPage(answer.body, lead.listUrl, site, 1)?.cards.length ?? 0;
        add(answer.body);
        if (!read) break;
        pageSize = pageSize || read;
        offset += pageSize;
        if (total && offset >= total) break;
        if (request === MAX_REQUESTS - 1) stoppedEarly = true;
      }
    } else if (hasScriptPager(page.html)) {
      stoppedEarly = true;
    }

    const source: ExhibitorSource = {
      platform: 'dmg-portal',
      platformLabel: 'Official exhibitor portal',
      editionLabel: label,
      directoryUrl: lead.listUrl,
      loginUrl: null,
      foundOn: raw.foundOn,
    };
    const list = Array.from(cards.values());
    if (!list.length) return { kind: 'empty', source };
    const statedMore = total && total > list.length ? total : null;
    return { kind: 'list', source, exhibitors: list, total: statedMore, partial: !statedMore && stoppedEarly };
  },
};
