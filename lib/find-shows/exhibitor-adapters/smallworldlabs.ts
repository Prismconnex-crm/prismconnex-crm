/**
 * SmallWorldLabs exhibitor directories (`<show><year>.smallworldlabs.com/exhibitors`,
 * FABTECH and others): server-rendered pages of company cards linking to
 * `/co/<company>`, titled "Exhibitor Directory - FABTECH 2026". The pager runs
 * in the page's script, but each page is also served at `?page=N`, which is
 * read until a page adds nothing.
 */
import { siteKey } from '../floor-plan';
import { judgeEdition, yearIn, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { extractDirectoryPage, statedTotal } from './organizer-directory';
import { Unreachable, isOk, readHtml, rejected, type ExhibitorAdapter } from './types';

const LIST = /https:\/\/([a-z0-9-]+)\.smallworldlabs\.com\/exhibitors\b/i;
const MAX_PAGES = 80;

export const smallWorldLabsAdapter: ExhibitorAdapter = {
  id: 'smallworldlabs',
  detect(page) {
    const lists = new Set<string>();
    for (const match of Array.from(page.html.matchAll(new RegExp(LIST.source, 'gi')))) lists.add(`https://${match[1].toLowerCase()}.smallworldlabs.com/exhibitors`);
    return Array.from(lists).map((url) => ({ adapter: 'smallworldlabs' as const, key: `swl:${url}`, foundOn: page.url, data: url }));
  },

  async resolve(raw, { target, fetcher }) {
    const listUrl = raw.data as string;
    const first = await readHtml(fetcher, listUrl);
    if (!isOk(first.status)) {
      if (first.status >= 500 || first.status === 429 || first.status === 403) throw new Unreachable(`HTTP ${first.status} from ${new URL(listUrl).host}`);
      return rejected('smallworldlabs', listUrl, listUrl, `the directory answered HTTP ${first.status}`);
    }
    // "Exhibitor Directory - FABTECH 2026": the part naming the show and year.
    const title = first.html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '';
    const label = title.split(/\s+[-–|]\s+/).find((part) => yearIn(part)) ?? title.trim();
    const verdict = judgeEdition(target, { label, year: yearIn(label) });
    if (!verdict.ok) return rejected('smallworldlabs', label, listUrl, verdict.reason);

    const site = siteKey(listUrl);
    const cards = new Map<string, ExhibitorCard>();
    const add = (html: string) => {
      const before = cards.size;
      for (const card of extractDirectoryPage(html, listUrl, site, 1)?.cards ?? []) if (!cards.has(card.profileUrl)) cards.set(card.profileUrl, card);
      return cards.size - before;
    };
    add(first.html);
    let stoppedEarly = false;
    for (let page = 2; page <= MAX_PAGES; page += 1) {
      let next;
      try {
        next = await readHtml(fetcher, `${listUrl}?page=${page}`);
      } catch {
        stoppedEarly = true;
        break;
      }
      if (!isOk(next.status)) {
        stoppedEarly = next.status >= 500 || next.status === 429;
        break;
      }
      if (add(next.html) === 0) break;
      if (page === MAX_PAGES) stoppedEarly = true;
    }
    const source: ExhibitorSource = {
      platform: 'smallworldlabs',
      platformLabel: 'Official exhibitor directory',
      editionLabel: label,
      directoryUrl: listUrl,
      loginUrl: null,
      foundOn: raw.foundOn,
    };
    const list = Array.from(cards.values());
    if (!list.length) return { kind: 'empty', source };
    const total = statedTotal(first.html);
    const statedMore = total && total > list.length ? total : null;
    return { kind: 'list', source, exhibitors: list, total: statedMore, partial: !statedMore && stoppedEarly };
  },
};
