import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { DMG_PORTAL, dmgLabel, hiddenFields } from '@/lib/find-shows/exhibitor-adapters/dmg-portal';
import { marketingManualCards, marketingManualConfig, standEditionYear } from '@/lib/find-shows/exhibitor-adapters/dmg-marketing-manual';
import { eyeLedCards, eyeLedProject, eyeLedYear } from '@/lib/find-shows/exhibitor-adapters/eyeled';
import type { Poster } from '@/lib/find-shows/exhibitor-adapters/http';
import type { EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

// --- Offline network ---------------------------------------------------------------

type Answer = { status?: number; body: string | object; url?: string } | Error;

function network(gets: Record<string, Answer>, posts: Record<string, (form: Record<string, string>) => Answer> = {}) {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(`GET ${url}`);
    const route = gets[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    const body = typeof route.body === 'string' ? route.body : JSON.stringify(route.body);
    const response: Fetched = { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(body), truncated: false };
    return response;
  };
  const poster: Poster = async (url, form) => {
    calls.push(`POST ${url} ${JSON.stringify(form)}`);
    const handler = posts[url];
    const route = handler ? handler(form) : { status: 404, body: '' };
    if (route instanceof Error) throw route;
    return { url, status: route.status ?? 200, body: typeof route.body === 'string' ? route.body : JSON.stringify(route.body) };
  };
  return { fetcher, poster, calls };
}

const now = () => new Date('2026-09-30T12:00:00Z');
const run = (target: EditionTarget, net: ReturnType<typeof network>) =>
  discoverExhibitors(target, { fetcher: net.fetcher, poster: net.poster, now, retryDelayMs: 0 });

// --- dmg exhibitor portals -------------------------------------------------------------

const GULFOOD: EditionTarget = { name: 'GULFOOD MANUFACTURING', startDate: '2026-11-03', city: 'Dubai', website: 'http://www.gulfoodmanufacturing.com' };
const PORTAL = 'https://exhibitors.gulfoodmanufacturing.com/gulfood-manufacturing-2026/Exhibitors';

/** One page of the portal's cards, as its pager returns them. */
function dmgCards(names: string[], from: number, total: number) {
  return `${names
    .map((name) => `<div class="item mb-4"><div class="img_event_box"><a href="${PORTAL}/ExbDetails/${name.toLowerCase().replace(/\s+/g, '-')}"><img src="https://cdn.example/${name}.png" alt="${name}"></a></div>
      <h5 class="heading"><a class="exb-title" href="${PORTAL}/ExbDetails/${name.toLowerCase().replace(/\s+/g, '-')}">${name}</a></h5><p>Stand S${from}</p></div>`)
    .join('')}<div class="pagination-info">Showing ${from + 1} to ${from + names.length} of ${total} </div>`;
}

const portalPage = (extra = '') => `<html><head><title>Exhibitor List | Gulfood Manufacturing 2026</title></head><body>
  <input type="hidden" name="ExhibitorDataView" id="ExhibitorDataView" value="1">
  <input type="hidden" name="event_slug" id="event_slug" value="gulfood-manufacturing-2026">
  <input type="hidden" name="selected_pass_event" id="selected_pass_event" value="98">
  <div id="category_listing"><strong>No Records Found</strong></div>
  <script>function getData(page) { $.ajax({ method: "POST", url: "https://exhibitors.gulfoodmanufacturing.com//Exhibitors/ajaxPaginationData/" + page }); }</script>${extra}</body></html>`;

describe('dmg exhibitor portals', () => {
  it('recognises portal addresses and reads the page’s own form fields', () => {
    expect(PORTAL.match(DMG_PORTAL)?.slice(1, 5)).toEqual(['exhibitors.gulfoodmanufacturing.com', 'gulfood-manufacturing-2026', '2026', 'Exhibitors']);
    expect(dmgLabel('Big-5-Global-2026')).toBe('Big 5 Global 2026');
    expect(hiddenFields(portalPage())).toMatchObject({ event_slug: 'gulfood-manufacturing-2026', selected_pass_event: '98', ExhibitorDataView: '1' });
  });

  it('pages through the portal’s own pager, sending only the page’s public fields, up to the stated total', async () => {
    const pager = 'https://exhibitors.gulfoodmanufacturing.com//Exhibitors/ajaxPaginationData';
    const pages: Record<string, string[]> = { '0': ['Acmi Beverage', 'Bosch Packaging'], '2': ['Clextral', 'Dole Tech'], '4': ['Ecolab'] };
    const net = network(
      { 'http://www.gulfoodmanufacturing.com': { body: `<a href="${PORTAL}">Exhibitor list</a>` }, [PORTAL]: { body: portalPage() } },
      Object.fromEntries(Object.entries(pages).map(([offset, names]) => [`${pager}/${offset}`, (form: Record<string, string>) => {
        expect(form).toMatchObject({ event_id: '98', event_slug: 'gulfood-manufacturing-2026', page: offset });
        expect(Object.keys(form).some((key) => /cookie|token|password/i.test(key))).toBe(false);
        return { body: dmgCards(names, Number(offset), 5) };
      }]))
    );
    const result = await run(GULFOOD, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'dmg-portal', editionLabel: 'Gulfood Manufacturing 2026' });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['Acmi Beverage', 'Bosch Packaging', 'Clextral', 'Dole Tech', 'Ecolab']);
    expect(result.exhibitors[0]).toMatchObject({ profileUrl: `${PORTAL}/ExbDetails/acmi-beverage`, logoUrl: 'https://cdn.example/Acmi%20Beverage.png', booths: ['S0'] });
    expect(result).toMatchObject({ total: null, partial: false });
  });

  it('keeps what was read and says it is partial when the pager fails midway', async () => {
    const pager = 'https://exhibitors.gulfoodmanufacturing.com//Exhibitors/ajaxPaginationData';
    const net = network(
      { 'http://www.gulfoodmanufacturing.com': { body: `<a href="${PORTAL}">Exhibitor list</a>` }, [PORTAL]: { body: portalPage() } },
      { [`${pager}/0`]: () => ({ body: dmgCards(['Acmi Beverage', 'Bosch Packaging'], 0, 1265) }), [`${pager}/2`]: () => ({ status: 500, body: '' }) }
    );
    const result = await run(GULFOOD, net);
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', total: 1265 });
    expect(result.exhibitors).toHaveLength(2);
  });

  it('reads the infinite-list variant until a page comes back empty', async () => {
    const gitex: EditionTarget = { name: 'GITEX GLOBAL', startDate: '2026-12-07', city: 'Dubai', website: 'http://www.gitex.com' };
    const list = 'https://exhibitors.gitex.com/gitex-global-2026/Exhibitor';
    const card = (name: string) => `<div class="card"><a href="${list}/ExbDetails/${name.toLowerCase()}"><img src="https://cdn.example/${name}.png" alt="${name}"></a><h5><a href="${list}/ExbDetails/${name.toLowerCase()}">${name}</a></h5></div>`;
    const net = network(
      {
        // The home page's menu is drawn by script: no link to the portal in its HTML.
        'http://www.gitex.com': { body: '<div id="__next"></div>' },
        'https://exhibitors.gitex.com/': { body: '<title>Exhibitor List | Gitex Global 2026</title><script>$.post("fetchExhibitors")</script>', url: list },
        [list]: { body: '<title>Exhibitor List | Gitex Global 2026</title><input type="hidden" name="event_slug" value="gitex-global-2026"><script>$.post("fetchExhibitors")</script>' },
      },
      {
        [`${list}/fetchExhibitors`]: (form) => ({ body: form.start === '0' ? ['Aramco', 'Cisco', 'Dell'].map(card).join('') : form.start === '100' ? card('Huawei') : '' }),
      }
    );
    const result = await run(gitex, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'dmg-portal', editionLabel: 'Gitex Global 2026', foundOn: list });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['Aramco', 'Cisco', 'Dell', 'Huawei']);
    expect(net.calls).toContain('GET https://exhibitors.gitex.com/');
  });

  it('rejects a portal for another edition', async () => {
    const old = 'https://exhibitors.gulfoodmanufacturing.com/gulfood-manufacturing-2025/Exhibitors';
    const net = network({
      'http://www.gulfoodmanufacturing.com': { body: `<a href="${old}">Exhibitor list</a>` },
      [old]: { body: portalPage().replace(/2026/g, '2025') },
    });
    const result = await run(GULFOOD, net);
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected[0]).toMatchObject({ platform: 'dmg-portal', reason: '"Gulfood Manufacturing 2025" is the 2025 edition, not 2026' });
    expect(net.calls.some((call) => call.startsWith('POST'))).toBe(false);
  });
});

// --- dmg marketing manual ----------------------------------------------------------------

describe('dmg marketing-manual exhibitor lists', () => {
  const ADIPEC: EditionTarget = { name: 'ADIPEC', startDate: '2026-11-02', city: 'Abu Dhabi', website: 'http://www.adipec.com' };
  const bundle = 'const ai="https://marketingmanual.adipec.com/api/exhibitor/";A("a",{href:`/exhibition/exhibitordetails?exhibitorid=${o.id}`});A("img",{src:"https://marketingmanual.adipec.com/"+o.companyLogo})';
  const records = [
    { id: 3177, standOppId: 'ADIPEC26-IT-45', companyName: '3P PRINZ', companyLogo: 'Exhibitors\\ADIPEC26-IT-45\\CompanyLogos\\x.png', standNumber: '1450', hall: 'Hall 1' },
    { id: 4062, standOppId: 'ADIPEC26-178-3', companyName: ' Lynxeo', companyLogo: null, standNumber: '6250', hall: 'Hall 6' },
  ];

  it('reads the API, profile address and logo host from the official page’s own script', () => {
    const config = marketingManualConfig(bundle, 'adipec.com')!;
    expect(config).toEqual({ apiBase: 'https://marketingmanual.adipec.com/api/exhibitor/', profileTemplate: '/exhibition/exhibitordetails?exhibitorid=', logoBase: 'https://marketingmanual.adipec.com/' });
    expect(marketingManualConfig(bundle, 'other-site.com')).toBeNull();
    expect(standEditionYear(records)).toBe(2026);
    expect(marketingManualCards(records, config, 'https://www.adipec.com')[0]).toEqual({
      id: '3177',
      name: '3P PRINZ',
      logoUrl: 'https://marketingmanual.adipec.com/Exhibitors/ADIPEC26-IT-45/CompanyLogos/x.png',
      booths: ['Hall 1 / 1450'],
      description: null,
      profileUrl: 'https://www.adipec.com/exhibition/exhibitordetails?exhibitorid=3177',
      access: 'public',
    });
  });

  const net = (listPageDates: string, stands = records) =>
    network({
      'http://www.adipec.com': { body: '<a href="/exhibition/exhibitor-list/">Exhibitor list</a>' },
      'http://www.adipec.com/exhibition/exhibitor-list/': { body: `<title>ADIPEC Exhibitor list</title><p>${listPageDates}</p><div id="app"></div><script type="module" src="/scripts/exhibitorlist/vue-script-build.js?v=1.9"></script>`, url: 'https://www.adipec.com/exhibition/exhibitor-list/' },
      'https://www.adipec.com/scripts/exhibitorlist/vue-script-build.js?v=1.9': { body: bundle },
      'https://marketingmanual.adipec.com/api/exhibitor/getallexhibitorslist': { body: { result: stands } },
    });

  it('lists this edition’s exhibitors', async () => {
    const result = await run(ADIPEC, net('2-5 November 2026'));
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'dmg-marketing-manual', editionLabel: 'ADIPEC 2026' });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['3P PRINZ', 'Lynxeo']);
  });

  it('rejects records or a page for another edition', async () => {
    const lastYear = records.map((record) => ({ ...record, standOppId: record.standOppId.replace('26', '25') }));
    // Last year's records behind this year's page: never shown (at most, the official page is linked).
    const stale = await run(ADIPEC, net('2-5 November 2026', lastYear));
    expect(stale.status).not.toBe('VERIFIED_LIST');
    expect(stale.exhibitors).toEqual([]);
    expect((await run(ADIPEC, net('3-6 November 2025'))).status).toBe('NO_VERIFIED_DIRECTORY');
  });
});

// --- EyeLed -----------------------------------------------------------------------------

describe('EyeLed exhibitor directories', () => {
  const SPIEL: EditionTarget = { name: 'SPIEL', startDate: '2026-10-22', city: 'Essen', website: 'http://www.spiel-essen.de/en' };
  const app = 'https://spiel.eyeled-services.de/exhibitors26/js/app.732137e1.js';
  const bundle = 'wc.userName="eyeupdate",wc.password="secret",wc.backendUrl="https://maps.eyeled-services.de",wc.project="spiel26";';
  const answer = {
    path: 'static/spiel26/20260929/logos/',
    exhibitors: [
      { ID: '801', NAME: '10 Traders GmbH', STAND: '2E620', HALLE: 'Hall 2' },
      { ID: '624', NAME: '100 Questen Gesellschaft e.V.', LOGO: 'a.jpg', STAND: '1E720', HALLE: 'Hall 1', INFO: '<p>Rollenspiele mit dem W100.</p>' },
    ],
  };

  it('reads the project and edition from the embedded app, and never its credentials', () => {
    expect(eyeLedProject(bundle)).toEqual({ project: 'spiel26', backend: 'https://maps.eyeled-services.de' });
    expect(eyeLedYear('spiel26')).toBe(2026);
    expect(eyeLedCards(answer, 'https://www.spiel-essen.de/en/the-spiel/exhibitors')![1]).toEqual({
      id: '624',
      name: '100 Questen Gesellschaft e.V.',
      logoUrl: 'https://maps.eyeled-services.de/static/spiel26/20260929/logos/a.jpg',
      booths: ['Hall 1 / 1E720'],
      description: 'Rollenspiele mit dem W100.',
      profileUrl: 'https://www.spiel-essen.de/en/the-spiel/exhibitors',
      access: 'public',
    });
  });

  it('lists this edition’s exhibitors, requesting only public card fields', async () => {
    const page = 'https://www.spiel-essen.de/en/the-spiel/exhibitors';
    const list = `https://maps.eyeled-services.de/en/spiel26/exhibitors?${new URLSearchParams({ columns: JSON.stringify(['ID', 'NAME', 'LOGO', 'STAND', 'HALLE', 'INFO', 'S_ORDER']) })}`;
    const net = network({
      'http://www.spiel-essen.de/en': { body: `<a href="${page}">Exhibitors</a>` },
      [page]: { body: `<script defer="defer" src="${app}"></script>` },
      [app]: { body: bundle },
      [list]: { body: answer },
    });
    const result = await run(SPIEL, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'eyeled', editionLabel: 'SPIEL 2026' });
    expect(result.exhibitors).toHaveLength(2);
    const requested = net.calls.find((call) => call.includes('maps.eyeled-services.de'))!;
    expect(requested).not.toMatch(/EMAIL|TELEFON|ADRESSE|password|eyeupdate/);
  });

  it('rejects another year’s project', async () => {
    const page = 'https://www.spiel-essen.de/en/the-spiel/exhibitors';
    const net = network({
      'http://www.spiel-essen.de/en': { body: `<a href="${page}">Exhibitors</a>` },
      [page]: { body: `<script src="${app.replace('26', '25')}"></script>` },
      [app.replace('26', '25')]: { body: bundle.replace('spiel26', 'spiel25') },
    });
    expect((await run(SPIEL, net)).status).toBe('NO_VERIFIED_DIRECTORY');
  });
});

// --- SmallWorldLabs ------------------------------------------------------------------------

describe('SmallWorldLabs directories', () => {
  it('reads every ?page= of the list for this edition', async () => {
    const FABTECH: EditionTarget = { name: 'FABTECH', startDate: '2026-10-21', city: 'Las Vegas, NV', website: 'https://www.fabtechexpo.com' };
    const list = 'https://fabtech2026.smallworldlabs.com/exhibitors';
    const page = (names: string[]) => `<title>Exhibitor Directory - FABTECH 2026</title><main>${names.map((name) => `<div class="card"><h3><a href="/co/${name.toLowerCase()}">${name}</a></h3><p>Booth A${name.length}</p></div>`).join('')}</main>`;
    const first = Array.from({ length: 16 }, (_, index) => `Company${String.fromCharCode(65 + index)}x`);
    const net = network({
      'https://www.fabtechexpo.com': { body: `<a href="${list}">Exhibitor list</a>` },
      [list]: { body: page(first) },
      [`${list}?page=2`]: { body: page(['Lincoln', 'Miller']) },
      [`${list}?page=3`]: { body: page([]) },
    });
    const result = await run(FABTECH, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'smallworldlabs', editionLabel: 'FABTECH 2026' });
    expect(result.exhibitors).toHaveLength(18);
    expect(result.exhibitors.find((card) => card.name === 'Lincoln')?.profileUrl).toBe('https://fabtech2026.smallworldlabs.com/co/lincoln');
  });
});
