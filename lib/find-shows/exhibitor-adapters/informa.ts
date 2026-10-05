/**
 * Informa's exhibitor portals (`exhibitors.<site>/<edition code>/`: Fi Europe,
 * Fi India, Vitafoods Asia, CPHI Milan/India/Middle East and the other shows
 * on the same platform). The official list page states:
 *
 *  - its edition: `data-exhibition-id="627"`, `data-exhibition-title="CPHI India 2026"`;
 *  - its public search feed: `data-json-url="/live/search/search_exhibition46json.jsp?site=46&…"`,
 *    which lists every exhibitor's id for that edition.
 *
 * The page then loads each exhibitor's card from a public fragment,
 * `/net/company/<id in groups>/result<id>-<edition>.html` (name, stand, logo,
 * short text and the "View profile" link on Informa's network site); the
 * adapter reads those the same way, a few at a time. The fragments' contact
 * forms are ignored. If some cards cannot be read, the result says how many
 * the directory lists.
 */
import { judgeEdition, shortDescription, yearIn, yearInShowCode, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { descendants, parseHtml, textOf } from '../html-tree';
import { Unreachable, isOk, readHtml, rejected, type ExhibitorAdapter } from './types';

const FEED = /data-json-url\s*=\s*["']([^"']*search_exhibition\d*json\.jsp[^"']*)["']/i;
const CONCURRENCY = 6;
const MAX_CARDS = 4000;

export type InformaPortal = {
  pageUrl: string;
  feedUrl: string;
  exhibitionId: string;
  /** "CPHI India 2026". */
  title: string;
  /** "CPIN26". */
  code: string;
};

const attribute = (html: string, name: string) => html.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]?.trim() ?? '';

/** The portal a list page describes: its edition and its feed (with the edition's id). */
export function informaPortal(html: string, pageUrl: string): InformaPortal | null {
  const feed = html.match(FEED)?.[1];
  const exhibitionId = attribute(html, 'data-exhibition-id') || feed?.match(/[?&]eventid=(\d+)/i)?.[1] || '';
  if (!feed || !/^\d+$/.test(exhibitionId)) return null;
  const feedUrl = new URL(feed.replace(/&amp;/g, '&'), pageUrl);
  feedUrl.searchParams.set('eventid', exhibitionId);
  feedUrl.searchParams.set('type', 'company');
  return {
    pageUrl,
    feedUrl: feedUrl.toString(),
    exhibitionId,
    title: attribute(html, 'data-exhibition-title') || (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').replace(/\s*exhibitor list\s*$/i, '').trim(),
    code: attribute(html, 'data-exhibition-name'),
  };
}

/** The platform's fragment address: the id zero-padded to six digits and cut into folders ("279192" → 27/91/92). */
export function informaFragmentPath(id: number | string, exhibitionId: string, type = 'company') {
  let digits = String(id).padStart(6, '0');
  let path = `/net/${type}`;
  while (digits.length) {
    if (digits.length > 6) {
      path += `/${digits.slice(0, digits.length - 4)}`;
      digits = digits.slice(-4);
    } else {
      path += `/${digits.slice(0, 2)}`;
      digits = digits.slice(2);
    }
  }
  return `${path}/result${id}-${exhibitionId}.html`;
}

/** One exhibitor's card from its public fragment. */
export function informaCard(html: string, id: string, fragmentUrl: string, fallbackProfile: string): ExhibitorCard | null {
  const nodes = descendants(parseHtml(html));
  const heading = nodes.find((node) => node.tag === 'h4');
  // "<h4><span class="featured">Featured</span>ABF Ingredients Group</h4>": the name without its badge.
  const name = heading ? heading.text.join(' ').replace(/\s+/g, ' ').trim() || textOf(heading) : '';
  if (!name || name.length < 2) return null;
  const stand = nodes.find((node) => node.tag === 'span' && /(?:^|\s)stand(?:\s|$)/.test(node.attrs.class ?? ''));
  const image = nodes.find((node) => node.tag === 'img' && node.attrs.src);
  const text = nodes.find((node) => node.tag === 'p' && textOf(node).length > 20);
  const profile = nodes.find((node) => node.tag === 'a' && /exhibitorlist-profilelink/.test(node.attrs.class ?? '') && node.attrs.href);
  const resolve = (href: string | undefined, base = fragmentUrl) => {
    try {
      return href ? new URL(href, base).toString() : null;
    } catch {
      return null;
    }
  };
  const profileUrl = resolve(profile?.attrs.href);
  const booth = stand ? textOf(stand).replace(/,?\s*etc\.?$/i, '').trim() : '';
  return {
    id,
    name,
    // A root-relative logo ("/company/<slug>/logo.png") is served by the network site the profile is on
    // (cphi-online.com), not by the exhibitor portal.
    logoUrl: resolve(image?.attrs.src, image?.attrs.src?.startsWith('/') && profileUrl ? profileUrl : fragmentUrl),
    booths: booth ? [booth] : [],
    description: text ? shortDescription(textOf(text)) : null,
    profileUrl: profileUrl ?? fallbackProfile,
    access: 'public',
  };
}

export const informaAdapter: ExhibitorAdapter = {
  id: 'informa',
  detect(page) {
    const portal = informaPortal(page.html, page.url);
    return portal ? [{ adapter: 'informa' as const, key: `informa:${new URL(portal.feedUrl).host}:${portal.exhibitionId}`, foundOn: page.url, data: portal }] : [];
  },

  async resolve(raw, { target, fetcher }) {
    const portal = raw.data as InformaPortal;
    const label = portal.title || portal.code;
    const verdict = judgeEdition(target, { label, year: yearIn(label) ?? (portal.code ? yearInShowCode(portal.code) : null) });
    if (!verdict.ok) return rejected('informa', label, portal.pageUrl, verdict.reason);

    const feed = await fetcher(portal.feedUrl, { accept: 'application/json,text/html;q=0.9,*/*;q=0.5', timeoutMs: 60_000, maxBytes: 30_000_000 });
    if (!isOk(feed.status)) throw new Unreachable(`HTTP ${feed.status} from ${new URL(portal.feedUrl).host}`);
    let records: { type?: string; id?: number | string; eventid?: number | string }[];
    try {
      records = (JSON.parse(feed.body.toString('utf8').trim()) as { results?: typeof records }).results ?? [];
    } catch {
      throw new Unreachable(`${new URL(portal.feedUrl).host} did not return the exhibitor list`);
    }
    // Only this edition's companies (the feed can carry products and news too).
    const ids = Array.from(
      new Set(records.filter((record) => record.type === 'company' && String(record.eventid) === portal.exhibitionId && record.id !== undefined).map((record) => String(record.id)))
    );
    const source: ExhibitorSource = {
      platform: 'informa',
      platformLabel: 'Official exhibitor list',
      editionLabel: label,
      directoryUrl: portal.pageUrl,
      loginUrl: null,
      foundOn: raw.foundOn,
    };
    if (!ids.length) return { kind: 'empty', source };

    const origin = new URL(portal.pageUrl).origin;
    const wanted = ids.slice(0, MAX_CARDS);
    const cards: (ExhibitorCard | null)[] = new Array(wanted.length).fill(null);
    let next = 0;
    let blocked = false;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (next < wanted.length && !blocked) {
          const index = next++;
          const id = wanted[index];
          const url = `${origin}${informaFragmentPath(id, portal.exhibitionId)}`;
          try {
            const page = await readHtml(fetcher, url);
            if (isOk(page.status)) cards[index] = informaCard(page.html, id, url, portal.pageUrl);
          } catch (error) {
            // A bot wall part-way through: stop asking; what was read stays, marked partial.
            if (error instanceof Unreachable && /refuses/.test(error.message)) blocked = true;
          }
        }
      })
    );
    const list = cards.filter((card): card is ExhibitorCard => Boolean(card));
    if (!list.length) throw new Unreachable(`the exhibitor cards on ${new URL(portal.pageUrl).host} could not be read`);
    return { kind: 'list', source, exhibitors: list, total: list.length < ids.length ? ids.length : null };
  },
};
