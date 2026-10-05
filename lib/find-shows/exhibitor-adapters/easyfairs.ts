/**
 * Easyfairs show sites (METAVAK, Empack, Logistics & Automation, Futurebuild,
 * Maintenance … every show on Easyfairs' own site platform). The exhibitor
 * page (`/<lang>/exhibitors/`) renders a `<stand-list>` widget server-side
 * and embeds the search's first answer:
 *
 *   window[Symbol.for("InstantSearchInitialResults")] = {"stands": {
 *     "state": {"filters": "(containerId: 2498 OR containerId: 2606)", …},
 *     "results": [{"nbHits": 158, "nbPages": 11, "page": 0,
 *       "facets": {"eventName": {"METAVAK 2026": 113, "Welding Week 2026": 45}},
 *       "hits": [{"objectID": "225152", "containerId": 2606, "eventName": "METAVAK 2026",
 *                 "name": "247Tailorsteel B.V.", "standNumber": "D24", "standLogo": "…",
 *                 "teaser": {"en": …}, "description": {"en": …}}, …]}]}}
 *
 * A site lists its co-located shows together (METAVAK with Welding Week):
 * every exhibitor names its own show and edition in `eventName`, so only the
 * catalog event's own shows are kept. Further pages are the same page with
 * `?stands[page]=N` (1-based), 15 exhibitors each. Each card links the
 * exhibitor's official profile, `/<lang>/exhibitors/<slug>-<objectID>/`.
 */
import { normalize, siteKey } from '../floor-plan';
import { judgeEdition, shortDescription, yearIn, type EditionTarget, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { decodeHtml } from '../html-tree';
import { statedStartDates } from './organizer-directory';
import { Unreachable, isOk, readHtml, rejected, type ExhibitorAdapter } from './types';

const MARKER = 'InstantSearchInitialResults';
/** Easyfairs' widget loader, on every page of its show sites. */
const WIDGET_LOADER = /my\.easyfairs\.com\/widgets\//i;
/** The exhibitor page's address in the site's languages. */
const LIST_PATH = /^\/(?:[a-z]{2}\/)?(?:exhibitors|exposanten|standhouders|exposants|aussteller|utstallare|utstillere|naytteilleet|expositores|espositori|wystawcy|vystavovatele)\/?$/i;
const MAX_PAGES = 120;
const CONCURRENCY = 3;
const DAY_MS = 86_400_000;

type Localized = Record<string, string | null> | string | null | undefined;
export type EasyfairsHit = {
  objectID?: string | number;
  containerId?: number;
  eventName?: string;
  name?: string;
  standNumber?: string | null;
  standLogo?: string | null;
  showLogo?: boolean;
  teaser?: Localized;
  description?: Localized;
};
export type EasyfairsPage = {
  hits: EasyfairsHit[];
  nbHits: number;
  nbPages: number;
  page: number;
  /** Exhibitors per show and edition, as the search counts them. */
  events: Record<string, number>;
  language: string;
  /** Official profile addresses the page links, by exhibitor id. */
  profiles: Record<string, string>;
};

/** The JSON value that starts at `start` in `text` (an object), read to its matching brace. */
function jsonAt(text: string, start: number): unknown {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, index + 1));
    }
  }
  return null;
}

/** The exhibitor search an Easyfairs page embeds, or null when the page carries none. */
export function easyfairsPage(html: string, pageUrl: string): EasyfairsPage | null {
  const at = html.indexOf(MARKER);
  if (at < 0) return null;
  const brace = html.indexOf('{', at);
  let data: { stands?: { results?: Record<string, unknown>[] } } | null;
  try {
    data = brace < 0 ? null : (jsonAt(html, brace) as typeof data);
  } catch {
    return null;
  }
  const result = data?.stands?.results?.[0];
  if (!result || !Array.isArray(result.hits)) return null;
  const facets = (result.facets ?? {}) as Record<string, Record<string, number>>;
  const profiles: Record<string, string> = {};
  for (const match of Array.from(html.matchAll(/href\s*=\s*["']([^"']*\/[a-z-]+\/[a-z0-9-]*-(\d+)\/?)["']/gi))) {
    try {
      const url = new URL(decodeHtml(match[1]), pageUrl);
      if (siteKey(url.toString()) === siteKey(pageUrl) && !profiles[match[2]]) profiles[match[2]] = url.toString();
    } catch {
      // Not a URL.
    }
  }
  return {
    hits: result.hits as EasyfairsHit[],
    nbHits: Number(result.nbHits ?? 0),
    nbPages: Number(result.nbPages ?? 1),
    page: Number(result.page ?? 0),
    events: facets.eventName ?? {},
    language: html.match(/<stand-list[^>]*\slanguage\s*=\s*["']([a-z-]+)["']/i)?.[1] ?? html.match(/<html[^>]*\slang\s*=\s*["']([a-z]{2})/i)?.[1] ?? 'en',
    profiles,
  };
}

/** The page's own copy in its language, else English, else any. */
function localized(value: Localized, language: string): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value[language] || value.en || Object.values(value).find(Boolean) || null;
}

/** The address of one page of the list: `?stands[page]=N`, 1-based. */
export function easyfairsPageUrl(listUrl: string, page: number) {
  const url = new URL(listUrl);
  url.search = '';
  url.hash = '';
  if (page > 1) url.searchParams.set('stands[page]', String(page));
  return url.toString();
}

/**
 * Which of the shows a list names are the catalog event's: those whose name
 * and edition ("METAVAK 2026") pass the edition check. A combined catalog
 * event ("EMPACK AND LOGISTICS & AUTOMATION - PORTO") keeps each of its shows.
 */
export function easyfairsEditions(target: EditionTarget, events: string[], pageText: string) {
  const kept: string[] = [];
  const reasons: string[] = [];
  // The show dates the page announces: a list whose year is unstated is judged by them.
  const announced = statedStartDates(pageText.slice(0, 200_000))[0] ?? null;
  const onDate = announced ? Math.abs(Date.parse(announced) - Date.parse(target.startDate)) / DAY_MS <= (target.approximate ? 45 : 7) : false;
  // The site lists its co-located shows together, so its domain (metavak.nl) names the host show, not the
  // event: each show is judged by the event's own name, and must share a real word with it.
  const named = { ...target, website: '' };
  const ownWords = new Set(normalize(target.name).split(' ').filter((word) => word.length >= 3 && !/\d/.test(word)));
  for (const event of events) {
    if (!normalize(event).split(' ').some((word) => ownWords.has(word))) {
      reasons.push(`"${event}" names a different show`);
      continue;
    }
    const verdict = judgeEdition(named, { label: event, year: yearIn(event), startDate: yearIn(event) === null && onDate ? announced : null });
    if (verdict.ok) kept.push(event);
    else reasons.push(verdict.reason);
  }
  return { kept, reasons };
}

function card(hit: EasyfairsHit, page: EasyfairsPage, listUrl: string): ExhibitorCard | null {
  const id = hit.objectID === undefined ? '' : String(hit.objectID);
  const name = (hit.name ?? '').replace(/\s+/g, ' ').trim();
  if (!id || !name) return null;
  const stand = (hit.standNumber ?? '').trim();
  return {
    id,
    name,
    logoUrl: hit.showLogo !== false && hit.standLogo ? hit.standLogo : null,
    booths: stand ? [stand] : [],
    description: shortDescription(localized(hit.teaser, page.language) ?? localized(hit.description, page.language)),
    profileUrl: page.profiles[id] ?? listUrl,
    access: 'public',
  };
}

const pageText = (html: string) => normalize(decodeHtml(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))).replace(/\s+/g, ' ');

export const easyfairsAdapter: ExhibitorAdapter = {
  id: 'easyfairs',
  detect(page, { site }) {
    const urls = new Set<string>();
    if (page.html.includes(MARKER) && /<stand-list/i.test(page.html)) urls.add(easyfairsPageUrl(page.url, 1));
    if (WIDGET_LOADER.test(page.html)) {
      for (const match of Array.from(page.html.matchAll(/href\s*=\s*["']([^"'#?]+)["']/gi))) {
        try {
          const url = new URL(decodeHtml(match[1]), page.url);
          if (LIST_PATH.test(url.pathname) && siteKey(url.toString()) === site) urls.add(easyfairsPageUrl(url.toString(), 1));
        } catch {
          // Not a URL.
        }
      }
    }
    return Array.from(urls).map((url) => ({ adapter: 'easyfairs' as const, key: `easyfairs:${url.toLowerCase()}`, foundOn: page.url, data: { listUrl: url } }));
  },

  async resolve(lead, { target, fetcher }) {
    const { listUrl } = lead.data as { listUrl: string };
    const first = await readHtml(fetcher, listUrl);
    if (!isOk(first.status)) {
      if (first.status >= 500 || first.status === 429) throw new Unreachable(`HTTP ${first.status} from ${new URL(listUrl).host}`);
      return rejected('easyfairs', listUrl, listUrl, `the exhibitor page answered HTTP ${first.status}`);
    }
    const page = easyfairsPage(first.html, first.url);
    if (!page) return rejected('easyfairs', listUrl, first.url, 'the page carries no Easyfairs exhibitor list');

    // Shows the list names: from its counts, or (none counted) from the exhibitors themselves.
    const events = Object.keys(page.events).length ? Object.keys(page.events) : Array.from(new Set(page.hits.map((hit) => hit.eventName ?? '').filter(Boolean)));
    const { kept, reasons } = easyfairsEditions(target, events, pageText(first.html));
    if (!kept.length) {
      return rejected('easyfairs', events.join(', ') || listUrl, first.url, reasons[0] ?? 'the list does not say which show or edition its exhibitors are for');
    }
    const source: ExhibitorSource = {
      platform: 'easyfairs',
      platformLabel: 'Official exhibitor list',
      editionLabel: kept.join(' + '),
      directoryUrl: first.url.replace(/[?#].*$/, ''),
      loginUrl: null,
      foundOn: lead.foundOn,
    };
    const expected = kept.reduce((sum, event) => sum + (page.events[event] ?? 0), 0);
    if (!page.nbHits || (Object.keys(page.events).length && !expected)) return { kind: 'empty', source };

    // Every page of the list, a few at a time; a page that cannot be read leaves the list partial, never shorter in silence.
    const pages = new Map<number, EasyfairsPage>([[1, page]]);
    const wanted = Array.from({ length: Math.min(page.nbPages, MAX_PAGES) - 1 }, (_, index) => index + 2);
    let failed = 0;
    let next = 0;
    let blocked = false;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (next < wanted.length && !blocked) {
          const number = wanted[next++];
          try {
            const answer = await readHtml(fetcher, easyfairsPageUrl(first.url, number));
            const parsed = isOk(answer.status) ? easyfairsPage(answer.html, answer.url) : null;
            if (parsed) pages.set(number, parsed);
            else failed += 1;
          } catch (error) {
            failed += 1;
            // A bot wall part-way through: stop asking; what was read stays, marked partial.
            if (error instanceof Unreachable && /refuses/.test(error.message)) blocked = true;
          }
        }
      })
    );

    const cards: ExhibitorCard[] = [];
    const seen = new Set<string>();
    for (const number of Array.from(pages.keys()).sort((a, b) => a - b)) {
      const current = pages.get(number)!;
      for (const hit of current.hits) {
        // Only the catalog event's shows: never a co-located show's exhibitors.
        if (!hit.eventName || !kept.includes(hit.eventName)) continue;
        const item = card(hit, current, source.directoryUrl);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          cards.push(item);
        }
      }
    }
    if (!cards.length && failed) throw new Unreachable(`the exhibitor pages on ${new URL(listUrl).host} could not be read`);
    if (!cards.length) return { kind: 'empty', source };
    const total = expected || null;
    const partial = failed > 0 || page.nbPages > MAX_PAGES || (total !== null && cards.length < total);
    return { kind: 'list', source, exhibitors: cards, total: partial ? total : null, partial };
  },
};
