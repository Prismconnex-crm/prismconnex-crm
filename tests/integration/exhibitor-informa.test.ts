import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { informaCard, informaFragmentPath, informaPortal } from '@/lib/find-shows/exhibitor-adapters/informa';
import type { EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

type Answer = { status?: number; body: string | object; url?: string } | Error;

function network(routes: Record<string, Answer>) {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    const route = routes[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    const body = typeof route.body === 'string' ? route.body : JSON.stringify(route.body);
    const response: Fetched = { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(body), truncated: false };
    return response;
  };
  return { fetcher, calls };
}

const now = () => new Date('2026-09-30T12:00:00Z');
const run = (target: EditionTarget, net: ReturnType<typeof network>) => discoverExhibitors(target, { fetcher: net.fetcher, now, retryDelayMs: 0 });

const FI: EditionTarget = { name: 'FI EUROPE - FOOD INGREDIENTS EUROPE', startDate: '2026-11-17', city: 'Frankfurt', website: 'http://www.figlobal.com/fieurope/en/home.html' };
const PORTAL = 'https://exhibitors.figlobal.com/fie26/';
const FEED = 'https://exhibitors.figlobal.com/live/search/search_exhibition46json.jsp?v=25&site=47&type=company&eventid=629';

const portalPage = (title = 'Fi Europe 2026', id = '629') => `<html><head><title>${title} Exhibitor List</title></head><body>
  <script>var m_docuSiteId = 47;</script>
  <div class="row exhibitor-listing-external" data-component="SearchFilter" data-json-url="/live/search/search_exhibition46json.jsp?v=25&amp;site=47&amp;type=company&amp;eventid=${id}" data-exhibitorlisting="true"></div>
  <div data-exhibition-id="${id}" data-exhibition-title="${title}" data-exhibition-name="FIE26"></div></body></html>`;

const fragment = (name: string, id: number, featured = false) => `<div class="exhibitor" data-component="Exhibitor"><div>
  <div class="toggler"><h4>${featured ? '<span class="featured">Featured</span>' : ''}${name}</h4><span class="stand">31D${id % 100}, etc.</span><span class="country">United Kingdom</span></div>
  <div class="additional"><div class="img-holder"><img src="https://www.ingredientsnetwork.com/c${id}img_XL-comp${id}.jpg" alt="${name}"></div>
  <p>${name} offers innovative ingredients to the food, health and nutrition sectors worldwide.</p>
  <div class="contact-buttons"><a href="#" class="button" data-target="#contact-form">Contact company</a>
  <a href="https://www.ingredientsnetwork.com/47/company/x/exhibitor${id}-629.html" class="button button-secondary exhibitorlist-profilelink" target="_blank">View profile</a></div></div></div></div>`;

const feed = (ids: number[], extra: object[] = []) => ({
  facets: [],
  results: [...ids.map((id) => ({ type: 'company', id, name: `company ${id}`, eventid: 629, score: 1, filterVal: '1', details: '' })), ...extra],
});

describe('Informa exhibitor portals: pure rules', () => {
  it('reads the edition and feed the list page states', () => {
    expect(informaPortal(portalPage(), PORTAL)).toEqual({ pageUrl: PORTAL, feedUrl: FEED, exhibitionId: '629', title: 'Fi Europe 2026', code: 'FIE26' });
    // A portal whose feed address omits the edition (CPHI) gets it from the page.
    const cphi = `<div data-json-url="/live/search/search_exhibition46json.jsp?site=46&type=company"></div><div data-exhibition-id="627" data-exhibition-title="CPHI India 2026" data-exhibition-name="CPIN26"></div>`;
    expect(informaPortal(cphi, 'https://exhibitors.cphi.com/cpin26/')?.feedUrl).toBe('https://exhibitors.cphi.com/live/search/search_exhibition46json.jsp?site=46&type=company&eventid=627');
    expect(informaPortal('<p>no feed here</p>', PORTAL)).toBeNull();
  });

  it('builds the platform’s fragment addresses', () => {
    expect(informaFragmentPath(279192, '629')).toBe('/net/company/27/91/92/result279192-629.html');
    expect(informaFragmentPath(9876, '611')).toBe('/net/company/00/98/76/result9876-611.html');
    expect(informaFragmentPath(12345678, '627')).toBe('/net/company/1234/56/78/result12345678-627.html');
  });

  it('reads one card: name without its badge, stand, logo, text and the official profile — no contact data', () => {
    const url = 'https://exhibitors.figlobal.com/net/company/27/91/92/result279192-629.html';
    expect(informaCard(fragment('ABF Ingredients Group', 279192, true), '279192', url, PORTAL)).toEqual({
      id: '279192',
      name: 'ABF Ingredients Group',
      logoUrl: 'https://www.ingredientsnetwork.com/c279192img_XL-comp279192.jpg',
      booths: ['31D92'],
      description: 'ABF Ingredients Group offers innovative ingredients to the food, health and nutrition sectors worldwide.',
      profileUrl: 'https://www.ingredientsnetwork.com/47/company/x/exhibitor279192-629.html',
      access: 'public',
    });
  });
});

describe('Informa card logos', () => {
  it('resolves a root-relative logo against the network site the profile is on', () => {
    const html = `<div><h4>3F Industries Limited</h4><span class="stand">1B05C</span><img src="/company/3f-industries-limited/logo.png">
      <a href="https://www.cphi-online.com/company/3f-industries-limited/" class="button exhibitorlist-profilelink">View profile</a></div>`;
    const card = informaCard(html, '1', 'https://exhibitors.cphi.com/net/company/00/00/01/result1-627.html', 'https://exhibitors.cphi.com/cpin26/')!;
    expect(card.logoUrl).toBe('https://www.cphi-online.com/company/3f-industries-limited/logo.png');
    expect(card.profileUrl).toBe('https://www.cphi-online.com/company/3f-industries-limited/');
  });
});

describe('Informa exhibitor portals: discovery', () => {
  const routes = (ids: number[], fragments: Record<number, Answer>, extra: object[] = []): Record<string, Answer> => ({
    'http://www.figlobal.com/fieurope/en/home.html': { body: '<a href="https://www.figlobal.com/europe/exhibitor-list/">Exhibitor list</a>' },
    'https://www.figlobal.com/europe/exhibitor-list/': { body: portalPage(), url: PORTAL },
    [FEED]: { body: feed(ids, extra) },
    ...Object.fromEntries(Object.entries(fragments).map(([id, answer]) => [`https://exhibitors.figlobal.com${informaFragmentPath(id, '629')}`, answer])),
  });

  it('lists this edition’s exhibitors from the portal the official site links', async () => {
    const net = network(
      routes([279192, 301000, 312345], { 279192: { body: fragment('ABF Ingredients Group', 279192, true) }, 301000: { body: fragment('Cargill', 301000) }, 312345: { body: fragment('DSM-Firmenich', 312345) } }, [
        // Products, and other editions' companies, are not this list's exhibitors.
        { type: 'product', id: 5, eventid: 629 },
        { type: 'company', id: 7, eventid: 581 },
      ])
    );
    const result = await run(FI, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'informa', editionLabel: 'Fi Europe 2026', directoryUrl: PORTAL });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['ABF Ingredients Group', 'Cargill', 'DSM-Firmenich']);
    expect(result).toMatchObject({ total: null, partial: false });
    expect(net.calls.some((url) => /result5-|result7-/.test(url))).toBe(false);
  });

  it('keeps the cards it read and states the total when some cannot be read', async () => {
    const blocked = { status: 403, body: '<title>Just a moment...</title>' };
    const net = network(routes([279192, 301000, 312345, 320000], { 279192: { body: fragment('ABF Ingredients Group', 279192) }, 301000: blocked, 312345: blocked, 320000: blocked }));
    const result = await run(FI, net);
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', total: 4 });
    expect(result.exhibitors).toHaveLength(1);
  });

  it('does not give a co-located show another show’s list (Natural Ingredients Europe is not Fi Europe)', async () => {
    const ni: EditionTarget = { name: 'NATURAL INGREDIENTS EUROPE', startDate: '2026-11-17', city: 'Frankfurt', website: 'http://www.figlobal.com/hieurope/en/home.html' };
    const net = network({
      'http://www.figlobal.com/hieurope/en/home.html': { body: '<a href="https://www.figlobal.com/europe/exhibitor-list/">Exhibitor list</a>' },
      'https://www.figlobal.com/europe/exhibitor-list/': { body: portalPage(), url: PORTAL },
    });
    const result = await run(ni, net);
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'informa' && /different show/.test(item.reason))).toBe(true);
  });

  it('rejects a portal for another edition without reading its list', async () => {
    const net = network({
      'http://www.figlobal.com/fieurope/en/home.html': { body: '<a href="https://www.figlobal.com/europe/exhibitor-list/">Exhibitor list</a>' },
      'https://www.figlobal.com/europe/exhibitor-list/': { body: portalPage('Fi Europe 2025', '581'), url: 'https://exhibitors.figlobal.com/fie25/' },
    });
    const result = await run(FI, net);
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(result.rejected.some((item) => item.platform === 'informa' && /2025 edition/.test(item.reason))).toBe(true);
    expect(net.calls.some((url) => url.includes('search_exhibition'))).toBe(false);
  });

  it('wins over a partial Swapcard page for the same edition', async () => {
    const swapcard = 'https://visitor.figlobal.com/event/fi-europe-2026/exhibitors/RXZlbnRWaWV3XzE=';
    const apollo = {
      'Core_Event:RXZlbnRfMQ==': { slug: 'fi-europe-2026', title: 'Fi Europe 2026', 'beginsAt({"format":"ISO8601"})': '2026-11-17T09:00:00+01:00', isPublic: true },
      'Core_EventExhibitorListView:RXZlbnRWaWV3XzE=': { 'exhibitors({"cursor":{"first":50}})': { nodes: [{ __ref: 'Core_Exhibitor:A' }], totalCount: 1375 } },
      'Core_Exhibitor:A': { _id: 'A', name: 'Only On Swapcard' },
    };
    const net = network({
      ...routes([279192], { 279192: { body: fragment('ABF Ingredients Group', 279192) } }),
      'http://www.figlobal.com/fieurope/en/home.html': { body: `<a href="https://www.figlobal.com/europe/exhibitor-list/">Exhibitor list</a><a href="${swapcard}">Online</a>` },
      [swapcard]: { body: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { apolloState: apollo } })}</script>` },
    });
    const result = await run(FI, net);
    expect(result.source?.platform).toBe('informa');
  });
});
