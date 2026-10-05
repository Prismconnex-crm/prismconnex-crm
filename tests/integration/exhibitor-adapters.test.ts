import { describe, expect, it } from 'vitest';
import { descendants, isChrome, parseHtml, textOf } from '@/lib/find-shows/html-tree';
import {
  extractDirectoryPage,
  judgeOrganizerPage,
  statedStartDates,
  statedTotal,
} from '@/lib/find-shows/exhibitor-adapters/organizer-directory';
import { visCards } from '@/lib/find-shows/exhibitor-adapters/messe-duesseldorf';
import { JL_LIST, jlTotal } from '@/lib/find-shows/exhibitor-adapters/jl-portal';
import { discoverExhibitors, rootDomainOf } from '@/lib/find-shows/exhibitor-discovery';
import type { EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

// --- Offline fetcher -------------------------------------------------------------

type Answer = { status?: number; body: string | object; url?: string } | Error;
type Route = Answer | ((headers: Record<string, string>) => Answer);

function fakeFetcher(routes: Record<string, Route>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetcher: Fetcher = async (url, options) => {
    calls.push({ url, headers: options.headers ?? {} });
    const found: Route = routes[url] ?? { status: 404, body: '' };
    const route: Answer = typeof found === 'function' ? found(options.headers ?? {}) : found;
    if (route instanceof Error) throw route;
    const body = typeof route.body === 'string' ? route.body : JSON.stringify(route.body);
    const response: Fetched = {
      url: route.url ?? url,
      status: route.status ?? 200,
      contentType: typeof route.body === 'string' ? 'text/html' : 'application/json',
      headers: {},
      body: Buffer.from(body),
      truncated: false,
    };
    return response;
  };
  return Object.assign(fetcher, { calls });
}

const now = () => new Date('2026-09-30T12:00:00Z');
const run = (target: EditionTarget, routes: Record<string, Route>) => {
  const fetcher = fakeFetcher(routes);
  return discoverExhibitors(target, { fetcher, now, retryDelayMs: 0 }).then((result) => ({ result, calls: fetcher.calls }));
};

/** An organizer-built list page as UK/EU organizer platforms print it: menu, header dates, cards, pager. */
function listPage({
  dates = '9-11 October 2026',
  title = 'Exhibitor list',
  names = ['Acme Robotics', 'Beta Controls', 'Gamma Tools', 'Delta Sensors', 'Epsilon Labs', 'Zeta Cables', 'Kappa Motors', 'Lambda Optics'],
  base = 'https://www.showexpo.com',
  pager = '',
  heading = '',
}: { dates?: string; title?: string; names?: string[]; base?: string; pager?: string; heading?: string } = {}) {
  const cards = names
    .map(
      (name, index) => `
      <li class="m-exhibitors-list__item">
        <a href="/exhibitors/${name.toLowerCase().replace(/\s+/g, '-')}">
          <img data-src="${base}/logos/${index}.png" alt="${name} logo">
        </a>
        <h3><a href="/exhibitors/${name.toLowerCase().replace(/\s+/g, '-')}">${name}</a></h3>
        <div class="stand">Stand ${String.fromCharCode(65 + index)}${index + 10} More Info</div>
        <p>${name} builds precise industrial equipment for factories, labs and field teams worldwide.</p>
      </li>`
    )
    .join('');
  return `<html><head><title>${title}</title></head><body>
    <header class="site-header"><nav><a href="/exhibitors/registration">Registration</a><a href="/exhibitors/prices">Prices</a>
      <a href="/exhibitors/faq">FAQ</a><a href="/exhibitors/contact">Contact</a><a href="/exhibitors/why-exhibit">Why exhibit</a></nav>
      <p>${dates} · Olympia London</p></header>
    <main>${heading}<h1>Exhibitors</h1>
      <div class="az"><a href="/exhibitors/a">A</a><a href="/exhibitors/b">B</a><a href="/exhibitors/c">C</a><a href="/exhibitors/d">D</a><a href="/exhibitors/e">E</a></div>
      <ul class="m-exhibitors-list">${cards}</ul>
      <div class="pager">${pager}</div>
    </main>
    <footer><a href="/privacy">Privacy</a> © 2025</footer></body></html>`;
}

const SHOW: EditionTarget = { name: 'SHOW EXPO LONDON', startDate: '2026-10-09', city: 'London', website: 'http://www.showexpo.com' };
const HOME = `<html><body><nav><a href="/exhibitor-list">Exhibitor list</a><a href="/visit">Visit</a></nav><p>Welcome</p></body></html>`;

// --- HTML tree -----------------------------------------------------------------------

describe('parseHtml', () => {
  it('tolerates unclosed tags and drops script and style content', () => {
    const root = parseHtml('<div><p>One<p>Two<script>var x = "<a href=/no>";</script><style>a{}</style><li>Three</div><img src="x.png">');
    expect(textOf(root)).toBe('One Two Three');
    expect(descendants(root).filter((node) => node.tag === 'a')).toHaveLength(0);
    expect(descendants(root).map((node) => node.tag)).toEqual(['div', 'p', 'p', 'li', 'img']);
  });

  it('tells site navigation from a card’s own header', () => {
    const root = parseHtml('<header><a id="menu">Home</a></header><main><article><header><a id="card">Acme</a></header></article></main><div class="site-footer"><a id="foot">x</a></div>');
    const byId = (id: string) => descendants(root).find((node) => node.attrs.id === id)!;
    expect(isChrome(byId('menu'))).toBe(true);
    expect(isChrome(byId('card'))).toBe(false);
    expect(isChrome(byId('foot'))).toBe(true);
  });
});

// --- Organizer directories: pure rules ---------------------------------------------------

describe('extractDirectoryPage', () => {
  it('reads each card’s name, logo, booth and short text, ignoring menus and A–Z links', () => {
    const page = extractDirectoryPage(listPage(), 'https://www.showexpo.com/exhibitor-list', 'showexpo.com')!;
    expect(page.cards).toHaveLength(8);
    expect(page.cards[0]).toEqual({
      id: 'https://www.showexpo.com/exhibitors/acme-robotics',
      name: 'Acme Robotics',
      logoUrl: 'https://www.showexpo.com/logos/0.png',
      booths: ['A10'],
      description: 'Acme Robotics builds precise industrial equipment for factories, labs and field teams worldwide.',
      profileUrl: 'https://www.showexpo.com/exhibitors/acme-robotics',
      access: 'public',
    });
  });

  it('does not take a menu of pages for exhibitors as a list', () => {
    const menu = ['Registration & prices', 'Marketing services', 'FAQ', 'Stand building', 'Contact', 'Downloads', 'Floor plan', 'Hotels'];
    expect(extractDirectoryPage(listPage({ names: menu }), 'https://www.showexpo.com/exhibitor-list', 'showexpo.com')).toBeNull();
  });

  it('does not take products, booth codes or an unnamed short link list as exhibitors', () => {
    const products = listPage().replace(/\/exhibitors\//g, '/products/');
    expect(extractDirectoryPage(products, 'https://www.showexpo.com/exhibitor-list', 'showexpo.com')).toBeNull();
    const codes = listPage({ names: ['A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A007', 'A008'] });
    expect(extractDirectoryPage(codes, 'https://www.showexpo.com/exhibitor-list', 'showexpo.com')).toBeNull();
    // Links to /news-like pages on a page that is not an exhibitor list: never a list, however many.
    const unnamed = listPage().replace(/\/exhibitors\//g, '/stories/');
    expect(extractDirectoryPage(unnamed, 'https://www.showexpo.com/', 'showexpo.com')).toBeNull();
  });

  it('finds the other pages of the same list and the total it states', () => {
    const html = listPage({ pager: '<a href="exhibitor-list?page=1">1</a><a href="exhibitor-list?page=2">2</a><a href="/news?page=2">News</a>' });
    const page = extractDirectoryPage(html, 'https://www.showexpo.com/exhibitor-list', 'showexpo.com')!;
    expect(page.nextPages).toEqual(['https://www.showexpo.com/exhibitor-list?page=1', 'https://www.showexpo.com/exhibitor-list?page=2']);
    expect(statedTotal('<div class="js-librarylistwrapper" data-totalcount="447">')).toBe(447);
    expect(statedTotal('<div>447 Results</div>')).toBe(447);
    expect(statedTotal('<div class="pagination-info">Showing 1 to 16 of 1,264 </div>')).toBe(1264);
  });

  it('marks a list partial when its other pages load only through the page’s script', async () => {
    const pager = '<li><a class="page-link" href="javascript:void(0);" onclick="searchFilter(24)">2</a></li>';
    const { result } = await run(SHOW, {
      'http://www.showexpo.com': { body: HOME },
      'http://www.showexpo.com/exhibitor-list': { body: listPage({ pager }), url: 'https://www.showexpo.com/exhibitor-list' },
      'https://www.showexpo.com/exhibitors/acme-robotics': { body: '<h1>Acme</h1>' },
    });
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', total: null, partial: true });
  });
});

describe('statedStartDates', () => {
  it.each([
    ['9-11 October 2026 · Olympia', '2026-10-09'],
    ['Thur 9 - Sun 12 September 2027 Auckland', '2027-09-09'],
    ['Thursday 10 - Sunday 13 September, 2026', '2026-09-10'],
    ['October 9-11, 2026', '2026-10-09'],
    ['16. bis 19. November 2026', '2026-11-16'],
    ['du 25 septembre au 5 octobre 2026', '2026-09-25'],
  ])('%s → %s', (text, date) => expect(statedStartDates(text)[0]).toBe(date));

  it('lists dates in page order', () => {
    expect(statedStartDates('Next: 16-18 April 2027. Last year: 9 October 2025')).toEqual(['2027-04-16', '2025-10-09']);
  });
});

describe('judgeOrganizerPage', () => {
  it('accepts the page announcing this edition’s dates', () => {
    expect(judgeOrganizerPage(SHOW, 'Exhibitor list | /exhibitor-list', '9-11 October 2026 … founded in 2004').ok).toBe(true);
  });

  it('rejects a page announcing another edition', () => {
    expect(judgeOrganizerPage(SHOW, 'Exhibitor list | /exhibitor-list', 'Thur 8 - Sun 11 October 2027 … 9-11 October 2026')).toEqual({
      ok: false,
      reason: 'the page announces the edition of 2027-10-08, not 2026-10-09',
    });
    expect(judgeOrganizerPage(SHOW, 'Exhibitors 2025 | /exhibitors-2025', 'whatever').ok).toBe(false);
  });

  it('rejects a list for another city of the same site', () => {
    const sydney = { ...SHOW, name: 'THE SYDNEY HOME SHOW', city: 'Sydney', otherCities: ['Melbourne', 'Brisbane'] };
    expect(judgeOrganizerPage(sydney, 'Exhibitor Directory - Melbourne Home Show | /melbourne/exhibitor-directory/', '9-11 October 2026')).toEqual({
      ok: false,
      reason: 'the list is for melbourne, not Sydney',
    });
    expect(judgeOrganizerPage(sydney, 'Exhibitor Directory - Sydney Home Show | /sydney/exhibitor-directory/', '9-11 October 2026').ok).toBe(true);
  });

  it('on a site hosting several shows, requires the list to name this one', () => {
    const target = { ...SHOW, otherShows: ['METALEX ISFAHAN'] };
    expect(judgeOrganizerPage(target, 'Exhibitors | /exhibitors', '9-11 October 2026').ok).toBe(false);
  });

  it('with no dates stated, needs this year and no earlier one', () => {
    expect(judgeOrganizerPage(SHOW, 'Exhibitors | /exhibitors', 'Our 2026 exhibitors').ok).toBe(true);
    expect(judgeOrganizerPage(SHOW, 'Exhibitors | /exhibitors', 'Our 2026 exhibitors, as in 2025').ok).toBe(false);
  });
});

// --- Organizer directories: end to end ----------------------------------------------------

describe('organizer-built directory', () => {
  it('reads a public list across its pages', async () => {
    const pager = '<a href="exhibitor-list?page=1">1</a><a href="exhibitor-list?page=2">2</a>';
    const { result } = await run(SHOW, {
      'http://www.showexpo.com': { body: HOME },
      'https://www.showexpo.com/exhibitor-list': { body: listPage({ pager }) },
      'http://www.showexpo.com/exhibitor-list': { body: listPage({ pager }), url: 'https://www.showexpo.com/exhibitor-list' },
      'https://www.showexpo.com/exhibitor-list?page=1': { body: listPage({ pager }) },
      'https://www.showexpo.com/exhibitor-list?page=2': { body: listPage({ pager, names: ['Omega Pumps', 'Sigma Valves'] }) },
      'https://www.showexpo.com/exhibitors/acme-robotics': { body: '<h1>Acme Robotics</h1>' },
    });
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'organizer-directory', editionLabel: 'SHOW EXPO LONDON 2026' });
    expect(result.exhibitors.map((card) => card.name)).toEqual([
      'Acme Robotics', 'Beta Controls', 'Delta Sensors', 'Epsilon Labs', 'Gamma Tools', 'Kappa Motors', 'Lambda Optics', 'Omega Pumps', 'Sigma Valves', 'Zeta Cables',
    ]);
    expect(result.exhibitors.every((card) => card.access === 'public')).toBe(true);
  });

  it('marks cards login-required when the site sends a profile to its login', async () => {
    const { result } = await run(SHOW, {
      'http://www.showexpo.com': { body: HOME },
      'http://www.showexpo.com/exhibitor-list': { body: listPage(), url: 'https://www.showexpo.com/exhibitor-list' },
      'https://www.showexpo.com/exhibitors/acme-robotics': { body: '<form><input type="password"></form>', url: 'https://www.showexpo.com/login?redirect_to=/exhibitors/acme-robotics' },
    });
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.exhibitors.every((card) => card.access === 'login-required')).toBe(true);
    expect(result.source?.loginUrl).toBe('https://www.showexpo.com/exhibitors/acme-robotics');
  });

  it('never uses another edition’s list', async () => {
    const { result } = await run(SHOW, {
      'http://www.showexpo.com': { body: HOME },
      'http://www.showexpo.com/exhibitor-list': { body: listPage({ dates: '8-10 October 2027' }) },
    });
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.exhibitors).toEqual([]);
    expect(result.rejected[0].reason).toBe('the page announces the edition of 2027-10-08, not 2026-10-09');
  });

  it('never uses another city’s list on a multi-city site', async () => {
    const target = { ...SHOW, name: 'THE SYDNEY HOME SHOW', city: 'Sydney', otherCities: ['Melbourne'], website: 'http://homeshows.example.com' };
    const { result } = await run(target, {
      'http://homeshows.example.com': { body: '<a href="/melbourne/exhibitor-directory/">Exhibitor directory</a>' },
      'http://homeshows.example.com/melbourne/exhibitor-directory/': {
        body: listPage({ title: 'Exhibitor Directory - Melbourne Home Show', base: 'http://homeshows.example.com' }),
      },
    });
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected[0].reason).toBe('the list is for melbourne, not Sydney');
  });

  it('links a verified official list it cannot read, instead of saying there is none', async () => {
    const app = (year: string) => `<html><head><title>Show Expo London ${year} Exhibitor List</title></head><body><div id="app"></div><script src="/js/exh-interface.js"></script></body></html>`;
    const found = await run(SHOW, { 'http://www.showexpo.com': { body: HOME }, 'http://www.showexpo.com/exhibitor-list': { body: app('2026') } });
    expect(found.result).toMatchObject({ status: 'OFFICIAL_DIRECTORY_LINK', source: { directoryUrl: 'http://www.showexpo.com/exhibitor-list', editionLabel: 'Show Expo London 2026' } });
    expect(found.result.exhibitors).toEqual([]);
    const lastYear = await run(SHOW, { 'http://www.showexpo.com': { body: HOME }, 'http://www.showexpo.com/exhibitor-list': { body: app('2025') } });
    expect(lastYear.result.status).toBe('NO_VERIFIED_DIRECTORY');
  });

  it('treats a directory behind a bot challenge as unchecked, never as "no exhibitors"', async () => {
    const { result } = await run(SHOW, {
      'http://www.showexpo.com': { body: HOME },
      'http://www.showexpo.com/exhibitor-list': { status: 403, body: '<html><head><title>Just a moment...</title></head><body><div id="cf-chl-widget"></div></body></html>' },
    });
    expect(result.status).toBe('DISCOVERY_INCOMPLETE');
    expect(result.reason).toContain('refuses automated requests');
  });

  it('keeps a network failure apart from "no exhibitors"', async () => {
    const { result } = await run(SHOW, {
      'http://www.showexpo.com': { body: HOME },
      'http://www.showexpo.com/exhibitor-list': new Error('fetch failed (ECONNRESET)'),
    });
    expect(result.status).toBe('DISCOVERY_INCOMPLETE');
  });

  it('retries a request that got no answer once before giving up', async () => {
    let calls = 0;
    const { result } = await run(SHOW, {
      'http://www.showexpo.com': () => (calls++ === 0 ? new Error('getaddrinfo ENOTFOUND www.showexpo.com') : { body: HOME }),
      'http://www.showexpo.com/exhibitor-list': { body: listPage(), url: 'https://www.showexpo.com/exhibitor-list' },
    });
    expect(result.status).toBe('VERIFIED_LIST');
  });

  it('reports no directory when the official site publishes none', async () => {
    const { result } = await run(SHOW, { 'http://www.showexpo.com': { body: '<p>Welcome to Show Expo</p>' } });
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.reason).toBe('The official website publishes no exhibitor directory that could be read.');
  });
});

describe('official website fallback', () => {
  it('reads the organizer’s root domain when the catalog subdomain does not exist', async () => {
    const target = { ...SHOW, website: 'http://en.rastak-expo.example' };
    expect(rootDomainOf(target.website)).toBe('http://rastak-expo.example/');
    const { result, calls } = await run(target, {
      'http://en.rastak-expo.example': new Error('fetch failed (ENOTFOUND)'),
      'http://rastak-expo.example/': { body: '<p>Organizer home</p>' },
    });
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(calls.map((call) => call.url)).toContain('http://rastak-expo.example/');
  });

  it('falls back to the site’s home page when the catalog’s page no longer exists', async () => {
    const target = { ...SHOW, website: 'http://www.showexpo.com/events-eye-reg-boilerplate' };
    const { result } = await run(target, {
      'http://www.showexpo.com/events-eye-reg-boilerplate': { status: 404, body: 'Not found' },
      'http://www.showexpo.com/': { body: HOME },
      'http://www.showexpo.com/exhibitor-list': { body: listPage(), url: 'https://www.showexpo.com/exhibitor-list' },
      'https://www.showexpo.com/exhibitors/acme-robotics': { body: '<h1>Acme Robotics</h1>' },
    });
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.exhibitors).toHaveLength(8);
  });

  it('does not call a site dead when neither name resolves (DNS can fail transiently)', async () => {
    const target = { ...SHOW, website: 'http://en.rastak-expo.example' };
    const { result } = await run(target, {
      'http://en.rastak-expo.example': new Error('fetch failed (ENOTFOUND)'),
      'http://rastak-expo.example/': new Error('fetch failed (ENOTFOUND)'),
    });
    expect(result.status).toBe('DISCOVERY_INCOMPLETE');
  });
});

// --- Messe Düsseldorf ----------------------------------------------------------------------

describe('Messe Düsseldorf exhibitor index', () => {
  const MEDICA: EditionTarget = { name: 'MEDICA', startDate: '2026-11-16', city: 'Dusseldorf', website: 'http://www.medica.de' };
  const api = 'https://www.medica.de/vis-api/vis/v1/en';
  const records = [
    { type: 'profile', exh: 'medica2026.1', exhSeoId: 'aaa', exhName: 'Alpha Medical', logo: 'https://www.medica.de/vis-content/a.jpg', location: 'Hall 7a / C09' },
    { type: 'profile', exh: 'compamed2026.2', exhSeoId: 'bbb', exhName: 'Beta Components', location: 'Hall 8b / J21' },
  ];
  const needsDomain = (body: object) => (headers: Record<string, string>) =>
    headers['x-vis-domain'] === 'www.medica.de' ? { body } : { status: 400, body: { error: 'No config set found' } };

  it('keeps only this show’s exhibitors of a shared index, sending the site’s own domain', async () => {
    expect(visCards(records, { host: 'www.medica.de', lang: 'en' }, 'medica2026')).toEqual([
      {
        id: 'medica2026.1',
        name: 'Alpha Medical',
        logoUrl: 'https://www.medica.de/vis-content/a.jpg',
        booths: ['Hall 7a / C09'],
        description: null,
        profileUrl: 'https://www.medica.de/vis/v1/en/exhprofiles/aaa',
        access: 'public',
      },
    ]);
    const { result } = await run(MEDICA, {
      'http://www.medica.de': { body: '<a href="https://www.medica.de/vis/v1/de/directory/a">Exhibitor index</a>' },
      [`${api}/components/config`]: needsDomain({ useExhSeoId: true, event: { from: '2026-11-16T00:00:00Z', shortIdCurrentDomain: 'medica2026' } }),
      [`${api}/directory/meta`]: needsDomain({ links: [{ link: 'a', isFilled: true }, { link: 'b', isFilled: true }] }),
      [`${api}/directory/a`]: needsDomain([records[0]]),
      [`${api}/directory/b`]: needsDomain([records[1]]),
    });
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'messe-duesseldorf', editionLabel: 'MEDICA 2026' });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['Alpha Medical']);
  });

  it('rejects an index already showing another edition', async () => {
    const { result } = await run(MEDICA, {
      'http://www.medica.de': { body: '<a href="/vis/v1/en/directory/a">Exhibitor index</a>' },
      [`${api}/components/config`]: needsDomain({ event: { from: '2025-11-17T00:00:00Z', shortIdCurrentDomain: 'medica2025' } }),
    });
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected[0]).toMatchObject({ platform: 'messe-duesseldorf', label: 'MEDICA 2025' });
  });
});

// --- jl.medien portals ---------------------------------------------------------------------

describe('exhibitor portals with the edition in the address (Messe München and others)', () => {
  const ELECTRONICA: EditionTarget = { name: 'ELECTRONICA', startDate: '2026-11-10', city: 'Munich', website: 'http://www.electronica.de/en/home' };
  const portal = 'https://exhibitors.electronica.de/exhibitor-portal/2026/list-of-exhibitors/';
  const portalPage = (names: string[]) => `<html><head><title>List of exhibitors - electronica 2026</title></head><body>
    ${names.map((name) => `<div class="ce_card"><img src="https://exhibitors.electronica.de/media/${name}.jpg" alt="Logo of ${name}">
      <h2><a href="${portal}exhibitordetails/${name.toLowerCase()}/?elb=1">${name}</a></h2><div>Munich, Germany</div></div>`).join('')}
    <form><input type="hidden" name="StartRow_query_res_1" value="1"><input type="hidden" name="StartRow_query_res_59" value="3481"></form></body></html>`;

  it('recognises the portal and its year', () => {
    expect(portal.match(JL_LIST)?.[1]).toBe('2026');
    expect(jlTotal(portalPage(['A']))).toBe(3481);
  });

  it('shows the portal’s first page as a partial list with the total it states', async () => {
    const names = ['Aptiv', 'Bosch', 'Continental', 'Diodes', 'Epcos', 'Farnell', 'Infineon', 'Kyocera'];
    const { result } = await run(ELECTRONICA, {
      'http://www.electronica.de/en/home': { body: `<a href="${portal}">List of exhibitors</a>` },
      [`${portal}?sb_rpp=60`]: { body: portalPage(names) },
    });
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', total: 3481 });
    expect(result.source).toMatchObject({ platform: 'jl-portal', editionLabel: 'electronica 2026', directoryUrl: portal });
    expect(result.exhibitors.map((card) => card.name)).toEqual(names);
  });

  it('rejects a portal for another year', async () => {
    const old = 'https://exhibitors.electronica.de/exhibitor-portal/2024/list-of-exhibitors/';
    const { result } = await run(ELECTRONICA, {
      'http://www.electronica.de/en/home': { body: `<a href="${old}">List of exhibitors</a>` },
      [`${old}?sb_rpp=60`]: { body: portalPage(['Aptiv']).replace('electronica 2026', 'electronica 2024') },
    });
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'jl-portal' && /2024 edition/.test(item.reason))).toBe(true);
  });
});

// --- A verified directory with nothing published yet ---------------------------------------

describe('verified but empty directory', () => {
  it('reports the directory as found and awaiting exhibitors, not as missing', async () => {
    const mysList = 'https://se2026.mapyourshow.com/8_0/explore/exhibitor-alphalist.cfm';
    const mysData = 'https://se2026.mapyourshow.com/8_0/ajax/remote-proxy.cfm?action=search&searchtype=exhibitorgallery&searchsize=5000&start=0';
    const { result } = await run(SHOW, {
      'http://www.showexpo.com': { body: '<a href="https://se2026.mapyourshow.com/8_0/">Exhibitors</a>' },
      [mysList]: { body: '<title>Show Expo 2026 | Search</title><script>showid = "SE2026";</script>' },
      [mysData]: { body: { DATA: { results: { exhibitor: { hit: [] } } } } },
    });
    expect(result.status).toBe('VERIFIED_EMPTY_DIRECTORY');
    expect(result.source).toMatchObject({ platform: 'map-your-show', editionLabel: 'Show Expo 2026' });
  });
});

// --- Choosing between platforms ------------------------------------------------------------

describe('platform preference', () => {
  it('prefers a platform with a machine-readable edition over the generic reader', async () => {
    const mysList = 'https://pg2026.mapyourshow.com/8_0/explore/exhibitor-alphalist.cfm';
    const mysData = 'https://pg2026.mapyourshow.com/8_0/ajax/remote-proxy.cfm?action=search&searchtype=exhibitorgallery&searchsize=5000&start=0';
    const { result } = await run(SHOW, {
      'http://www.showexpo.com': { body: `${HOME}<a href="https://pg2026.mapyourshow.com/8_0/">Floor plan</a>` },
      'http://www.showexpo.com/exhibitor-list': { body: listPage(), url: 'https://www.showexpo.com/exhibitor-list' },
      'https://www.showexpo.com/exhibitors/acme-robotics': { body: '<h1>Acme</h1>' },
      [mysList]: { body: '<title>Show Expo 2026 | Search</title><script>showid = "SE2026";</script>' },
      [mysData]: { body: { DATA: { results: { exhibitor: { hit: [{ fields: { exhid_l: '1', exhname_t: 'Only On MYS' } }] } } } } },
    });
    expect(result.source?.platform).toBe('map-your-show');
    expect(result.exhibitors.map((card) => card.name)).toEqual(['Only On MYS']);
  });
});
