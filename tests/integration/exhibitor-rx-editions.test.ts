import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { componentName, editionHomeLinks, editionTitles, matchShow, rxComponents, showWords, type RxComponent } from '@/lib/find-shows/exhibitor-adapters/rx-editions';
import type { EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

type Answer = { status?: number; body: string; url?: string } | Error;

// --- A fake RX site and index ------------------------------------------------------

type Hit = { guid: string; name: string; stand: string; locale?: string; shows?: string[]; zones?: string[] };

/** An edition home as the RX site builder renders it: site-builder assets, settings, and the site's edition links. */
function editionPage(o: { title: string; name: string; editionId: string; start: string; location: string; directory?: boolean; links?: string[] }) {
  const base = 'https://www.show.jp/autumn/en-gb';
  const props = {
    props: {
      context: { mode: 'public', eventEditionId: o.editionId, eventEditionName: o.name, eventId: 'evt-1' },
      navigation: o.directory === false ? {} : {
        exhibitorPublicDirectoryUrlFormat: `${base}/search/dir.html`,
        exhibitorPublicDetailsUrlFormat: `${base}/search/dir/directory-details.{0}.html`,
      },
      algoliaConfig: { apiKey: 'key', appId: 'APP1' },
      showInfo: { startDate: `${o.start}T10:00:00.000+09:00`, location: o.location },
    },
  };
  const links = (o.links ?? []).map((href) => `<a href="${href}">edition</a>`).join('');
  return `<html><head><title>${o.title}</title><link href="/etc/designs/rx/sitebuilder/generated/rxjp/show/live.css"></head><body>${links}
    <script>var reactSettingsDirectory = JSON.parse(${JSON.stringify(JSON.stringify(props))});</script></body></html>`;
}

const hubPage = (links: string[]) =>
  `<html><head><title>SHOW WORLD</title><link href="/etc/designs/rx/sitebuilder/generated/rxjp/show/live.css"></head><body>${links.map((href) => `<a href="${href}">x</a>`).join('')}</body></html>`;

/** Algolia as the RX index answers: facet counts, or hits filtered by edition and by show. */
function rxIndex(editions: Record<string, Hit[]>): Fetcher {
  return async (url) => {
    const params = new URL(url).searchParams;
    const filters = params.get('filters') ?? '';
    const edition = filters.match(/eventEditionId:(\S+)/)?.[1] ?? '';
    const records = (editions[edition] ?? []).map((hit) => ({
      recordType: 'exhibitor',
      eventEditionId: edition,
      organisationGuid: hit.guid,
      exhibitorName: hit.name,
      standReference: hit.stand,
      locale: hit.locale ?? 'en-gb',
      logo: `https://cdn.example/${hit.guid}.png`,
      exhibitorFilters: hit.shows ? { Exhibition: { lvl0: hit.shows, ...(hit.zones ? { lvl1: hit.zones } : {}) } } : {},
    }));
    const wanted = Array.from(filters.matchAll(/exhibitorFilters\.Exhibition\.(lvl[01]):"((?:[^"\\]|\\.)*)"/g)).map((m) => ({ level: m[1] as 'lvl0' | 'lvl1', value: m[2] }));
    const hits = wanted.length
      ? records.filter((record) => wanted.some(({ level, value }) => ((record.exhibitorFilters as { Exhibition?: Record<string, string[]> }).Exhibition?.[level] ?? []).includes(value)))
      : records;
    let body: unknown;
    if (params.get('facets')) {
      const facets: Record<string, Record<string, number>> = {};
      for (const record of records) {
        for (const [level, values] of Object.entries((record.exhibitorFilters as { Exhibition?: Record<string, string[]> }).Exhibition ?? {})) {
          const key = `exhibitorFilters.Exhibition.${level}`;
          facets[key] ??= {};
          for (const value of values) facets[key][value] = (facets[key][value] ?? 0) + 1;
        }
      }
      body = { hits: [], nbHits: records.length, facets };
    } else {
      body = { hits, nbHits: hits.length, nbPages: 1 };
    }
    return { url, status: 200, contentType: 'application/json', headers: {}, body: Buffer.from(JSON.stringify(body)), truncated: false } as Fetched;
  };
}

function network(routes: Record<string, Answer>, editions: Record<string, Hit[]>) {
  const calls: string[] = [];
  const index = rxIndex(editions);
  const fetcher: Fetcher = async (url, options) => {
    calls.push(url);
    if (url.includes('algolia.net')) return index(url, options);
    const route = routes[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    return { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(route.body), truncated: false } as Fetched;
  };
  return { fetcher, calls };
}

const now = () => new Date('2026-09-30T12:00:00Z');
const run = (target: EditionTarget, net: ReturnType<typeof network>) => discoverExhibitors(target, { fetcher: net.fetcher, now, retryDelayMs: 0 });

// "FASHION WORLD" autumn: two co-located shows, one exhibitor indexed in Japanese and English.
const AUTUMN_HITS: Hit[] = [
  { guid: 'org-1', name: 'ソーシング株式会社', stand: 'A1-1', locale: 'ja-jp' },
  { guid: 'org-1', name: 'Sourcing Co.', stand: 'A1-1', shows: ['1:7: FASHION SOURCING EXPO'] },
  { guid: 'org-2', name: 'Knit Works', stand: 'A2-5', shows: ['1:7: FASHION SOURCING EXPO'] },
  { guid: 'org-3', name: 'Textile House', stand: 'B1-2', shows: ['2:6: TEXTILE EXPO'] },
  { guid: 'org-4', name: 'Tech Garments', stand: 'C3-1', shows: ['3:8: FASHION TECH EXPO'] },
];

const HUB = 'https://www.show.jp/hub/en-gb.html';
const AUTUMN = 'https://www.show.jp/autumn/en-gb.html';
const SPRING = 'https://www.show.jp/spring/en-gb.html';
const siteRoutes = (overrides: Record<string, Answer> = {}): Record<string, Answer> => ({
  [HUB]: { body: hubPage(['/hub/en-gb.html', '/autumn/en-gb.html', '/spring/ja-jp.html']) },
  [AUTUMN]: {
    body: editionPage({ title: 'Autumn Edition | FaW TOKYO - FASHION WORLD TOKYO', name: 'ファッション ワールド 東京 【秋】', editionId: 'eve-autumn', start: '2026-10-07', location: 'Tokyo Big Sight, Japan', links: ['/hub/en-gb.html', '/spring/en-gb.html'] }),
  },
  [SPRING]: {
    body: editionPage({ title: 'FaW TOKYO APRIL - FASHION WORLD TOKYO', name: 'FaW TOKYO（ファッションワールド東京）春', editionId: 'eve-spring', start: '2027-04-07', location: 'Tokyo Big Sight, Japan' }),
  },
  ...overrides,
});
const EDITIONS = { 'eve-autumn': AUTUMN_HITS, 'eve-spring': [] };

const target = (name: string, startDate = '2026-10-07'): EditionTarget => ({ name, startDate, city: 'Tokyo', venue: 'Tokyo Big Sight', website: HUB });

describe('RX editions: pure rules', () => {
  it('reads show names the way the index writes them', () => {
    expect(componentName('915061:4: NEPCON JAPAN > PWB EXPO')).toBe('PWB EXPO');
    expect(componentName('968449:7: FASHION SOURCING EXPO')).toBe('FASHION SOURCING EXPO');
    // Places, seasons, "expo" and plurals never tell shows apart; "week" and "world" do.
    expect(Array.from(showWords('PWB EXPO - PRINTED WIRING BOARDS EXPO JAPAN - TOKYO', 'Tokyo'))).toEqual(['pwb', 'printed', 'wiring', 'board']);
    expect(Array.from(showWords('COSME Week OSAKA [Autumn]'))).toEqual(['cosme', 'week']);
  });

  const component = (value: string, attribute = 'exhibitorFilters.Exhibition.lvl0'): RxComponent => ({ attribute, value, name: componentName(value), count: 1 });
  const FASHION = [component('1:7: FASHION SOURCING EXPO'), component('2:6: TEXTILE EXPO'), component('3:8: FASHION TECH EXPO')];
  const names = (match: ReturnType<typeof matchShow>) => (match.kind === 'component' ? match.components.map((item) => item.name) : match.kind);

  it('matches a co-located show by its own English name', () => {
    expect(names(matchShow(target('FASHION SOURCING TOKYO'), FASHION, [], false))).toEqual(['FASHION SOURCING EXPO']);
    const nepcon = [component('1:1: NEPCON JAPAN'), component('2:2: AUTOMOTIVE WORLD'), component('3:5: NEPCON JAPAN > PRINTED WIRING BOARD EXPO', 'exhibitorFilters.Exhibition.lvl1'), component('4:2: AUTOMOTIVE WORLD > EV JAPAN　EV,HV&FCV Technology Expo', 'exhibitorFilters.Exhibition.lvl1')];
    expect(names(matchShow(target('PWB EXPO - PRINTED WIRING BOARDS EXPO JAPAN - TOKYO'), nepcon, [], false))).toEqual(['PRINTED WIRING BOARD EXPO']);
    expect(names(matchShow(target('EV JAPAN - TOKYO'), nepcon, [], false))).toEqual(['EV JAPAN EV,HV&FCV Technology Expo']);
    expect(names(matchShow(target('NEPCON JAPAN - TOKYO'), nepcon, [], false))).toEqual(['NEPCON JAPAN']);
  });

  it('gives the umbrella event the whole edition, and a show inside it only its own exhibitors', () => {
    const cosme = [component('1:2: COSME OSAKA'), component('2:1: COSME Tech OSAKA')];
    const osaka = { ...target('COSME WEEK - OSAKA'), city: 'Osaka' };
    expect(matchShow(osaka, cosme, ['COSME Week OSAKA'], false)).toEqual({ kind: 'edition', name: 'COSME Week OSAKA' });
    expect(names(matchShow({ ...osaka, name: 'COSME TECH - OSAKA' }, cosme, ['COSME Week OSAKA'], false))).toEqual(['COSME Tech OSAKA']);
    expect(matchShow(target('FASHION WORLD TOKYO'), FASHION, ['FaW TOKYO', 'FASHION WORLD TOKYO'], false)).toEqual({ kind: 'edition', name: 'FASHION WORLD TOKYO' });
  });

  it('takes a family of zone shows under the event’s name, never the edition’s other shows', () => {
    const agri = [component('1:1: J-AGRI SUPPLY'), component('2:2: J-AGRI TECH'), component('3:7: GARDEX'), component('4:8: TOOL JAPAN')];
    expect(names(matchShow({ ...target('J AGRI TOKYO'), city: 'Chiba' }, agri, [], false))).toEqual(['J-AGRI SUPPLY', 'J-AGRI TECH']);
    expect(names(matchShow({ ...target('GARDEX'), city: 'Chiba' }, agri, [], false))).toEqual(['GARDEX']);
  });

  it('refuses rather than guesses', () => {
    // Not one of the edition's shows.
    expect(matchShow(target('IOFT'), FASHION, ['FASHION WORLD TOKYO'], false).kind).toBe('none');
    // Several shows fit equally.
    expect(matchShow(target('FASHION TOKYO'), FASHION, [], false).kind).toBe('none');
    // The index does not say which show each exhibitor belongs to: a co-located show is never given the edition.
    expect(matchShow(target('PV EXPO - OSAKA'), [], ['SMART ENERGY WEEK Osaka'], false)).toMatchObject({ kind: 'none', reason: expect.stringMatching(/different show/) });
    expect(matchShow(target('PV EXPO - OSAKA'), [], [], false)).toMatchObject({ kind: 'none', reason: expect.stringMatching(/does not say which co-located show/) });
    // Japanese component names are not matched against English catalog names.
    expect(rxComponents({ 'exhibitorFilters.Exhibition.lvl0': { '1:1: アジアの縫製・生産工場EXPO': 3, '1:1: TEXTILE EXPO': 2 } }).map((item) => item.name)).toEqual(['TEXTILE EXPO']);
  });

  it('follows a site’s edition homes on its own host, English first', () => {
    const html = '<a href="/tokyo/ja-jp.html">Tokyo</a><a href="https://www.show.jp/osaka/en-gb.html">Osaka</a><a href="https://www.other.jp/tokyo/en-gb.html">Other</a><a href="/hub/en-gb/about/pv.html">PV</a>';
    expect(editionHomeLinks(html, 'https://www.show.jp/hub/en-gb.html')).toEqual([
      'https://www.show.jp/hub/en-gb.html',
      'https://www.show.jp/tokyo/en-gb.html',
      'https://www.show.jp/tokyo/ja-jp.html',
      'https://www.show.jp/osaka/en-gb.html',
    ]);
  });

  it('takes the edition’s English names from its home page title only', () => {
    const html = '<title>Autumn Edition | FaW TOKYO - FASHION WORLD TOKYO</title>';
    expect(editionTitles(html, AUTUMN)).toEqual(['Autumn Edition', 'FaW TOKYO - FASHION WORLD TOKYO', 'FaW TOKYO', 'FASHION WORLD TOKYO']);
    // A show's own page inside the edition speaks for that show, not the edition.
    expect(editionTitles(html, 'https://www.show.jp/tokyo/en-gb/conference/wearable.html')).toEqual([]);
    expect(editionTitles('<title>ファッション ワールド 東京</title>', AUTUMN)).toEqual([]);
  });
});

describe('RX editions: discovery', () => {
  it('follows a hub to the right edition and lists only the event’s own show', async () => {
    const net = network(siteRoutes(), EDITIONS);
    const result = await run(target('FASHION SOURCING TOKYO'), net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'rx', editionLabel: 'FASHION SOURCING EXPO 2026', directoryUrl: 'https://www.show.jp/autumn/en-gb/search/dir.html' });
    // English record over its Japanese twin; the co-located TEXTILE and FASHION TECH exhibitors are not listed.
    expect(result.exhibitors.map((card) => card.name)).toEqual(['Knit Works', 'Sourcing Co.']);
    expect(result.exhibitors.find((card) => card.id === 'org-1')).toMatchObject({ booths: ['A1-1'], logoUrl: 'https://cdn.example/org-1.png', profileUrl: 'https://www.show.jp/autumn/en-gb/search/dir/directory-details.org-1.html', access: 'public' });
    // Only this show's exhibitors were asked for.
    expect(net.calls.filter((url) => url.includes('algolia.net') && !url.includes('facets')).every((url) => (new URL(url).searchParams.get('filters') ?? '').includes('"1:7: FASHION SOURCING EXPO"'))).toBe(true);
  });

  it('gives the umbrella event the whole edition, each exhibitor once', async () => {
    const result = await run(target('FASHION WORLD TOKYO'), network(siteRoutes(), EDITIONS));
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', source: { editionLabel: 'FASHION WORLD TOKYO 2026' } });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['Knit Works', 'Sourcing Co.', 'Tech Garments', 'Textile House']);
  });

  it('matches the next edition by its dates: indexed but with no public directory yet is "not published yet"', async () => {
    const routes = siteRoutes({
      [SPRING]: { body: editionPage({ title: 'FaW TOKYO APRIL - FASHION WORLD TOKYO', name: 'FaW TOKYO（ファッションワールド東京）春', editionId: 'eve-spring', start: '2027-04-07', location: 'Tokyo Big Sight, Japan', directory: false }) },
    });
    const result = await run(target('FASHION SOURCING TOKYO', '2027-04-07'), network(routes, { ...EDITIONS, 'eve-spring': [{ guid: 'org-9', name: 'Spring Sourcing', stand: 'A1', shows: ['9:8: FASHION SOURCING EXPO'] }] }));
    expect(result).toMatchObject({ status: 'VERIFIED_EMPTY_DIRECTORY', source: { editionLabel: 'FASHION SOURCING EXPO 2027' } });
    expect(result.exhibitors).toEqual([]);
  });

  it('never gives a co-located show the edition’s list when the index cannot tell shows apart', async () => {
    const mixed = AUTUMN_HITS.map(({ shows: _shows, ...hit }) => hit);
    const result = await run(target('TEXTILE EXPO TOKYO'), network(siteRoutes(), { ...EDITIONS, 'eve-autumn': mixed }));
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(result.rejected.some((item) => item.platform === 'rx' && /different show/.test(item.reason))).toBe(true);
  });

  it('rejects an event that is none of the edition’s shows', async () => {
    const result = await run(target('IOFT'), network(siteRoutes(), EDITIONS));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
  });

  it('rejects another year’s edition', async () => {
    const result = await run(target('FASHION SOURCING TOKYO', '2025-10-08'), network(siteRoutes(), EDITIONS));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => /starts 2026-10-07/.test(item.reason))).toBe(true);
  });

  it('reads an edition the catalog links in Japanese through its English twin (venue in Latin letters)', async () => {
    const ja = 'https://www.show.jp/autumn/ja-jp.html';
    const routes = siteRoutes({
      [ja]: { body: editionPage({ title: '【秋】ファッション ワールド 東京', name: 'ファッション ワールド 東京 【秋】', editionId: 'eve-autumn', start: '2026-10-07', location: '東京ビッグサイト', links: ['/autumn/en-gb.html'] }) },
    });
    const result = await run({ ...target('FASHION SOURCING TOKYO'), website: ja }, network(routes, EDITIONS));
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', source: { editionLabel: 'FASHION SOURCING EXPO 2026' } });
  });

  it('does not let a Japanese page of the edition, read first, hide its English directory page', async () => {
    const ja = 'https://www.show.jp/autumn/ja-jp/now.html';
    const directory = 'https://www.show.jp/autumn/en-gb/exhibitor-directory.html';
    const routes: Record<string, Answer> = {
      [ja]: { body: editionPage({ title: '出展社一覧', name: 'ファッション ワールド 東京 【秋】', editionId: 'eve-autumn', start: '2026-10-07', location: '東京ビッグサイト', links: ['/autumn/en-gb/exhibitor-directory.html'] }) },
      [directory]: { body: editionPage({ title: 'Exhibitor Directory', name: 'ファッション ワールド 東京 【秋】', editionId: 'eve-autumn', start: '2026-10-07', location: 'Tokyo Big Sight, Japan' }) },
    };
    const result = await run({ ...target('FASHION SOURCING TOKYO'), website: ja }, network(routes, EDITIONS));
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', source: { editionLabel: 'FASHION SOURCING EXPO 2026' } });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['Knit Works', 'Sourcing Co.']);
  });

  it('keeps an edition page it could not read apart from "no directory"', async () => {
    const routes = siteRoutes({ [AUTUMN]: new Error('fetch failed (ECONNRESET)'), 'https://www.show.jp/autumn/ja-jp.html': new Error('fetch failed (ECONNRESET)') });
    const result = await run(target('FASHION SOURCING TOKYO'), network(routes, EDITIONS));
    expect(result.status).toBe('DISCOVERY_INCOMPLETE');
  });
});
