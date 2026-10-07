/**
 * jl.medien exhibitor portals, which Messe München and other German fairs run
 * at `exhibitors.<fair>/exhibitor-portal/<year>/list-of-exhibitors/`
 * (`aussteller.<fair>/ausstellerportal/<year>/ausstellerliste/`). The year in
 * the address and the page title ("List of exhibitors - electronica 2026")
 * name the edition. The list pages its cards through a form; its first page
 * (60 per page, the portal's own largest setting) is read, with the total it
 * states, and the card links to the full official list. The portal's XLS
 * export is not used: it is marked "not for commercial use".
 */
import { judgeEdition, yearIn, type ExhibitorSource } from '../exhibitors';
import { extractLinks } from '../floor-plan';
import { extractDirectoryPage, pageIdentity } from './organizer-directory';
import { Unreachable, isOk, readHtml, rejected, type ExhibitorAdapter } from './types';

/** A jl.medien portal's list address: a portal host, a year, and the list-of-exhibitors path. */
export const JL_LIST = /^https?:\/\/(?:exhibitors?|aussteller|expositores|exposants)\.[^/]+\/[^?#]*\/(20\d{2})\/(?:list-of-exhibitors|ausstellerliste|aussteller-liste|liste-des-exposants|lista-de-expositores)\/?(?:[?#]|$)/i;

/** The exhibitor total a portal page states in its pager (`StartRow_query_res_<pages>` holds the last row). */
export function jlTotal(html: string): number | null {
  const rows = Array.from(html.matchAll(/name="StartRow_query_res_\d+"\s+value="(\d+)"/g)).map((match) => Number(match[1]));
  return rows.length ? Math.max(...rows) : null;
}

export const jlPortalAdapter: ExhibitorAdapter = {
  id: 'jl-portal',
  detect(page) {
    const urls = new Set<string>();
    for (const link of extractLinks(page.html, page.url)) {
      const match = link.url.match(JL_LIST);
      if (match) urls.add(link.url.split(/[?#]/)[0]);
    }
    if (JL_LIST.test(page.url)) urls.add(page.url.split(/[?#]/)[0]);
    return Array.from(urls).map((url) => ({ adapter: 'jl-portal' as const, key: `jl:${url.replace(/\/$/, '')}`, foundOn: page.url, data: url }));
  },

  async resolve(lead, { target, fetcher, site }) {
    const listUrl = lead.data as string;
    const page = await readHtml(fetcher, `${listUrl}?sb_rpp=60`);
    if (!isOk(page.status)) {
      if (page.status >= 500 || page.status === 429) throw new Unreachable(`HTTP ${page.status} from ${new URL(listUrl).host}`);
      return rejected('jl-portal', listUrl, listUrl, `the portal answered HTTP ${page.status}`);
    }
    const title = pageIdentity(page.html, listUrl).split(' | ')[0];
    // "List of exhibitors - electronica 2026": the part naming the show.
    const label = title.split(/\s+[-–|]\s+/).find((part) => yearIn(part)) ?? title;
    const year = Number(listUrl.match(JL_LIST)?.[1]);
    const verdict = judgeEdition(target, { label, year: yearIn(label) ?? year });
    if (!verdict.ok) return rejected('jl-portal', label, listUrl, verdict.reason);
    if (yearIn(label) && yearIn(label) !== year) return rejected('jl-portal', label, listUrl, `the portal address is for ${year}, its title for ${yearIn(label)}`);

    const parsed = extractDirectoryPage(page.html, page.url, site);
    const source: ExhibitorSource = {
      platform: 'jl-portal',
      platformLabel: 'Official exhibitor portal',
      editionLabel: label,
      directoryUrl: listUrl,
      loginUrl: null,
      foundOn: lead.foundOn,
    };
    if (!parsed) return { kind: 'empty', source };
    const total = jlTotal(page.html);
    return { kind: 'list', source, exhibitors: parsed.cards, total: total && total > parsed.cards.length ? total : null };
  },
};
