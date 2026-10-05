/**
 * Map Your Show, RX site builder and Swapcard: the platforms whose pages carry
 * a machine-readable edition (show id, edition name and dates) and a public
 * list the official directory page itself loads. Parsing lives in
 * ../exhibitors.ts; these adapters fetch and check the edition.
 */
import {
  judgeEdition,
  mapYourShowBase,
  mapYourShowCards,
  mapYourShowIdentity,
  platformRefs,
  rxCards,
  rxFacetUrl,
  rxQueryUrl,
  swapcardLabel,
  swapcardPage,
  yearIn,
  yearInShowCode,
  type ExhibitorCard,
  type ExhibitorSource,
  type MapYourShowRef,
  type RxRef,
  type SwapcardRef,
} from '../exhibitors';
import { HTML_ACCEPT, PAGE_LIMIT, Unreachable, isOk, readJson, rejected, type AdapterContext, type Candidate, type ExhibitorAdapter } from './types';
import {
  COMPONENT_FACETS,
  NON_LATIN,
  editionHomeLinks,
  editionTitles,
  followEditionHomes,
  isRxSiteBuilder,
  matchShow,
  rxComponents,
  settingsFitTarget,
  type RxEditionPage,
} from './rx-editions';

/** RX indexes return at most 1000 hits a page; no show needs more than a few pages. */
const MAX_RX_PAGES = 10;

export const mapYourShowAdapter: ExhibitorAdapter = {
  id: 'map-your-show',
  detect: (page) =>
    platformRefs(page.html, page.url).flatMap((ref) => (ref.platform === 'map-your-show' ? [{ adapter: 'map-your-show' as const, key: `mys:${ref.code}`, foundOn: ref.foundOn, data: ref }] : [])),
  async resolve(lead, { target, fetcher }) {
    const ref = lead.data as MapYourShowRef;
    const base = mapYourShowBase(ref.code);
    const listPage = `${base}/explore/exhibitor-alphalist.cfm`;
    const page = await fetcher(listPage, { accept: HTML_ACCEPT, ...PAGE_LIMIT });
    if (page.status === 404 || page.status === 410 || /no_showid/i.test(page.url)) {
      return rejected('map-your-show', ref.code, listPage, 'the Map Your Show directory is no longer online');
    }
    if (!isOk(page.status)) throw new Unreachable(`HTTP ${page.status} from ${ref.code}.mapyourshow.com`);
    const identity = mapYourShowIdentity(page.body.toString('utf8'));
    if (!identity) return rejected('map-your-show', ref.code, listPage, 'the directory page does not name its show');
    const verdict = judgeEdition(target, {
      label: identity.label,
      year: yearIn(identity.label) ?? yearInShowCode(identity.showId) ?? yearInShowCode(ref.code),
    });
    if (!verdict.ok) return rejected('map-your-show', identity.label, listPage, verdict.reason);
    const json = await readJson(fetcher, `${base}/ajax/remote-proxy.cfm?action=search&searchtype=exhibitorgallery&searchsize=5000&start=0`, {
      'X-Requested-With': 'XMLHttpRequest',
    });
    const cards = mapYourShowCards(json, ref.code, identity.showId);
    if (!cards) throw new Unreachable(`${ref.code}.mapyourshow.com returned an unexpected exhibitor list`);
    const source: ExhibitorSource = {
      platform: 'map-your-show',
      platformLabel: 'Map Your Show',
      editionLabel: identity.label,
      directoryUrl: `${base}/explore/exhibitor-gallery.cfm?featured=false`,
      loginUrl: null,
      foundOn: ref.foundOn,
    };
    return cards.length ? { kind: 'list', source, exhibitors: cards } : { kind: 'empty', source };
  },
};

/** What an RX lead points to: an edition page's settings, or a site's edition homes to follow. */
type RxLead = (RxRef & { kind?: 'edition'; titles: string[] }) | { kind: 'hub'; urls: string[]; foundOn: string };

/**
 * The name an RX edition is shown by. An edition RX still names by an earlier date ("FIBO - 16/04/2026" for the
 * edition starting 2027-04-08) is identified by its dates, so it is shown as "FIBO 2027", not by the stale name.
 */
export function rxEditionName(name: string, year: number | null) {
  const named = yearIn(name);
  if (year === null || named === null || named === year) return name;
  return `${name.replace(/[\s,–-]*\d{1,2}[./]\d{1,2}[./]20\d{2}\b.*$|[\s,–-]*\b20\d{2}\b.*$/, '').trim()} ${year}`;
}

/**
 * One RX edition's exhibitors, checked against the catalog event: its dates
 * and venue, then which of its shows the event is (see ./rx-editions.ts).
 */
async function resolveRxEdition(ref: RxRef, titles: string[], { target, fetcher }: Pick<AdapterContext, 'target' | 'fetcher'>): Promise<Candidate> {
  const { settings } = ref;
  // Some shows leave the edition unnamed or name it by id, others in Japanese: the dates and location then identify it.
  const named = Boolean(settings.eventEditionName) && !/^eve-[0-9a-f-]+$/i.test(settings.eventEditionName);
  const latin = named && !NON_LATIN.test(settings.eventEditionName);
  const year = settings.startDate ? Number(settings.startDate.slice(0, 4)) : null;
  const directoryUrl = settings.publicDirectoryUrl ?? ref.foundOn;
  const dates = judgeEdition(target, { label: target.name, year: year ?? yearInShowCode(target.name), startDate: settings.startDate, location: settings.location });
  const label = latin ? rxEditionName(settings.eventEditionName, year) : named ? titles[0] ?? settings.eventEditionName : target.name;
  if (!dates.ok) return rejected('rx', label, directoryUrl, dates.reason.replace(`"${target.name}"`, `"${label}"`));
  // A Japanese or umbrella name is judged by the edition's shows below; a plain English one keeps the usual check —
  // by RX's own name as stated, not the shown label (which may have dropped a stale date).
  const nameCheck = latin
    ? judgeEdition(target, { label: settings.eventEditionName, year: yearIn(settings.eventEditionName) ?? year, startDate: settings.startDate, location: settings.location })
    : null;
  if (!named && !settings.startDate) return rejected('rx', label, directoryUrl, 'the edition states neither its name nor its dates');

  const facets = (await readJson(fetcher, rxFacetUrl(settings, COMPONENT_FACETS))) as { facets?: Record<string, Record<string, number>> };
  const match = matchShow(target, rxComponents(facets.facets), [...(latin ? [settings.eventEditionName] : []), ...titles], !named || Boolean(nameCheck?.ok));
  if (match.kind === 'none') return rejected('rx', label, directoryUrl, match.reason);
  const show = match.kind === 'component' ? match.components.map(({ attribute, value }) => ({ attribute, value })) : undefined;

  const hits: unknown[] = [];
  for (let page = 0; page < MAX_RX_PAGES; page += 1) {
    const json = (await readJson(fetcher, rxQueryUrl(settings, page, show))) as { hits?: unknown[]; nbPages?: number };
    if (!Array.isArray(json?.hits)) throw new Unreachable('the RX exhibitor index returned an unexpected response');
    hits.push(...json.hits);
    if (page + 1 >= Number(json.nbPages ?? 1)) break;
  }
  const cards = rxCards({ hits }, settings) ?? [];
  const loginRequired = !settings.publicDetailsUrlFormat && Boolean(settings.protectedDetailsUrlFormat);
  const source: ExhibitorSource = {
    platform: 'rx',
    platformLabel: 'Official exhibitor directory',
    editionLabel:
      match.kind === 'component'
        ? `${match.name}${year && !yearIn(match.name) ? ` ${year}` : ''}`
        : latin || !named
          ? label
          : `${match.name ?? label}${year && !yearIn(match.name ?? label) ? ` ${year}` : ''}`,
    directoryUrl,
    // RX's sign-in must start from a show page (its bare identity host shows an error), so the
    // show's own directory is where a visitor goes to log in.
    loginUrl: loginRequired ? directoryUrl : null,
    foundOn: ref.foundOn,
  };
  return cards.length ? { kind: 'list', source, exhibitors: cards } : { kind: 'empty', source };
}

const rank = (candidate: Candidate) => ({ list: 0, login: 1, link: 2, empty: 3, failed: 4, rejected: 5 })[candidate.kind];

export const rxAdapter: ExhibitorAdapter = {
  id: 'rx',
  detect(page, { target }) {
    const refs = platformRefs(page.html, page.url).flatMap((ref) =>
      ref.platform === 'rx'
        ? [
            {
              adapter: 'rx' as const,
              // One lead per edition and venue script: the English page's venue ("Makuhari Messe") can be checked
              // against the catalog city where the Japanese page's ("幕張メッセ") cannot, so whichever page is read
              // first must not hide the other.
              key: `rx:${ref.settings.eventEditionId}${ref.settings.location && NON_LATIN.test(ref.settings.location) ? ':local' : ''}`,
              foundOn: ref.foundOn,
              data: { ...ref, kind: 'edition', titles: editionTitles(page.html, page.url) } as RxLead,
            },
          ]
        : []
    );
    // A hub, a show's page, or another edition's (or a Japanese page's) home: follow the site's edition homes.
    const own = refs[0]?.data as (RxRef & { titles: string[] }) | undefined;
    if (!isRxSiteBuilder(page.html) || (own && settingsFitTarget(own.settings, target))) return refs;
    const urls = editionHomeLinks(page.html, page.url);
    if (!urls.length) return refs;
    const hub: RxLead = { kind: 'hub', urls, foundOn: page.url };
    return [...refs, { adapter: 'rx' as const, key: `rx-hub:${new URL(page.url).host.toLowerCase()}`, foundOn: page.url, data: hub }];
  },
  async resolve(lead, context) {
    const data = lead.data as RxLead;
    if (data.kind !== 'hub') return resolveRxEdition(data, data.titles, context);
    const { editions, failures } = await followEditionHomes(data.urls, context.fetcher);
    // The editions closest to the event's date first; each is checked in full, so a wrong one is only rejected.
    const distance = (edition: RxEditionPage) => {
      const days = Math.abs(Date.parse(edition.settings.startDate?.slice(0, 10) ?? '') - Date.parse(context.target.startDate));
      return Number.isNaN(days) ? Infinity : days;
    };
    const ordered = editions.slice().sort((a, b) => distance(a) - distance(b));
    let best: Candidate | null = null;
    for (const edition of ordered) {
      const candidate = await resolveRxEdition({ platform: 'rx', settings: edition.settings, foundOn: edition.url }, edition.titles, context);
      if (!best || rank(candidate) < rank(best)) best = candidate;
      if (candidate.kind === 'list' || candidate.kind === 'empty') break;
    }
    // An edition page that could not be read might have been this one: that is unfinished, not "no directory".
    if ((!best || best.kind === 'rejected') && failures.length) throw new Unreachable(`some edition pages could not be read (${failures[0]})`);
    return best ?? rejected('rx', lead.foundOn, lead.foundOn, 'the site links no edition with an exhibitor directory');
  },
};

export const swapcardAdapter: ExhibitorAdapter = {
  id: 'swapcard',
  detect: (page) =>
    platformRefs(page.html, page.url).flatMap((ref) => (ref.platform === 'swapcard' ? [{ adapter: 'swapcard' as const, key: `swapcard:${ref.eventSlug}`, foundOn: ref.foundOn, data: ref }] : [])),
  async resolve(lead, { target, fetcher }) {
    const ref = lead.data as SwapcardRef;
    const response = await fetcher(ref.url, { accept: HTML_ACCEPT, ...PAGE_LIMIT });
    if (response.status === 404 || response.status === 410) {
      return rejected('swapcard', swapcardLabel(ref.eventSlug), ref.url, 'the Swapcard page is no longer online');
    }
    if (!isOk(response.status)) throw new Unreachable(`HTTP ${response.status} from ${new URL(ref.url).host}`);
    const page = swapcardPage(response.body.toString('utf8'), ref.url);
    const label = page?.title || swapcardLabel(ref.eventSlug);
    const verdict = judgeEdition(target, { label, year: yearIn(label) ?? yearIn(ref.eventSlug), startDate: page?.beginsAt ?? null });
    if (!verdict.ok) return rejected('swapcard', label, ref.url, verdict.reason);
    const source: ExhibitorSource = {
      platform: 'swapcard',
      platformLabel: 'Swapcard',
      editionLabel: label,
      directoryUrl: ref.url,
      loginUrl: page?.isPublic ? null : ref.url,
      foundOn: ref.foundOn,
    };
    // A closed event renders no list without login; an event page (no list view) cannot show the list either.
    if (!page || !page.isPublic) return { kind: 'login', source };
    if (!page.cards.length) {
      return /\/exhibitors\//.test(ref.url)
        ? { kind: 'empty', source }
        : rejected('swapcard', label, ref.url, 'the official site links the Swapcard event, not its exhibitor list');
    }
    return { kind: 'list', source, exhibitors: page.cards, total: page.total };
  },
};
