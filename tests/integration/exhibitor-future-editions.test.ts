/**
 * Regression tests for the Batch 1 discovery run of the July–December 2027 catalog additions (2026-11-24), where
 * previous-edition lists and non-list pages were stored as verified 2027 exhibitor lists:
 *
 *  - RX moved an edition's dates to 2027 while its directory stayed the 2026 show's — Manufacturing World Osaka
 *    ("/search/2026mdk1008/", "…Osaka 2026"), IJT Autumn ("Previous Exhibitor Directory", "/search/2026ijta26/"),
 *    G2E ("2026 Exhibitor List") and WTM London (no year anywhere, a week after the 2026 show);
 *  - organizer pages whose header announced the 2027 dates over an undated list (Dentistry Show London, The
 *    Emergency Services Show, Maryland Fall Home & Garden, Winterfair Hardenberg, Salon Atlantica);
 *  - "information for exhibitors" pages read as lists: Fakuma's news grid, Camperbeurs' practical-info pages.
 */
import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { judgeOrganizerPage, notExhibitorLinks } from '@/lib/find-shows/exhibitor-adapters/organizer-directory';
import { isAnotherEdition, isFutureEdition, rxDirectoryYears, UNDATED_LIST_LEAD_DAYS, type EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

/** The day of the Batch 1 run: every 2027 H2 edition was 7–13 months away. */
const RUN_DAY = new Date('2026-11-24T08:00:00Z');
/** Two months before an October 2027 show: the previous edition is long over. */
const NEAR_DAY = new Date('2027-08-01T08:00:00Z');

type Answer = { status?: number; body: string; url?: string };

// --- A fake RX site and index ---------------------------------------------------------------

type RxPage = { url: string; title: string; name: string; start: string; location: string; directory: string; editionId?: string };

function rxPage(page: RxPage) {
  const props = {
    props: {
      context: { mode: 'public', eventEditionId: page.editionId ?? 'eve-1', eventEditionName: page.name, eventId: 'evt-1' },
      navigation: {
        exhibitorPublicDirectoryUrlFormat: page.directory,
        exhibitorPublicDetailsUrlFormat: `${page.directory.replace(/\.html$/, '')}/directory-details.{0}.html`,
      },
      algoliaConfig: { apiKey: 'key', appId: 'APP1' },
      showInfo: { startDate: `${page.start}T10:00:00.000+09:00`, location: page.location },
    },
  };
  return `<html><head><title>${page.title}</title><link href="/etc/designs/rx/sitebuilder/generated/rx/show/live.css"></head><body>
    <script>var reactSettingsDirectory = JSON.parse(${JSON.stringify(JSON.stringify(props))});</script></body></html>`;
}

const RX_NAMES = ['Acme Robotics', 'Beta Controls', 'Gamma Tools', 'Delta Sensors', 'Epsilon Labs'];

function rxNetwork(routes: Record<string, Answer>, names = RX_NAMES): Fetcher {
  return async (url) => {
    if (url.includes('algolia.net')) {
      const facets = new URL(url).searchParams.get('facets');
      const hits = facets
        ? []
        : names.map((name, index) => ({
            recordType: 'exhibitor',
            eventEditionId: 'eve-1',
            organisationGuid: `org-${index}`,
            exhibitorName: name,
            standReference: `A${index}`,
            locale: 'en-gb',
            exhibitorFilters: {},
          }));
      const body = facets ? { hits: [], nbHits: names.length, facets: {} } : { hits, nbHits: hits.length, nbPages: 1 };
      return { url, status: 200, contentType: 'application/json', headers: {}, body: Buffer.from(JSON.stringify(body)), truncated: false } as Fetched;
    }
    const route = routes[url] ?? { status: 404, body: '' };
    return { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(route.body), truncated: false } as Fetched;
  };
}

const discover = (target: EditionTarget, fetcher: Fetcher, now: Date) => discoverExhibitors(target, { fetcher, now: () => now, retryDelayMs: 0 });

// --- The RX cases ------------------------------------------------------------------------------

const MWO_HOME = 'https://www.manufacturing-world.jp/osaka/en-gb.html';
const MWO_DIRECTORY = 'https://www.manufacturing-world.jp/osaka/en-gb/search/2026mdk1008/directory.html';
const MWO: EditionTarget = { name: 'MANUFACTURING WORLD OSAKA', startDate: '2027-10-06', city: 'Osaka', venue: 'INTEX Osaka', website: MWO_HOME };

const IJT_DIRECTORY = 'https://www.ijt.jp/autumn/en-gb/search/2026ijta26/directory.html';
const IJT: EditionTarget = { name: 'IJT AUTUMN - INTERNATIONAL JEWELLERY AUTUMN', startDate: '2027-10-27', city: 'Yokohama', venue: 'Pacifico Yokohama', website: IJT_DIRECTORY };

const G2E_LIST = 'https://www.globalgamingexpo.com/en-us/attend/exhibitor-list.html';
const G2E: EditionTarget = { name: 'G2E - GLOBAL GAMING EXPO', startDate: '2027-09-27', city: 'Las Vegas, NV', venue: 'The Venetian Expo', website: G2E_LIST };

const WTM_LIST = 'https://www.wtm.com/london/en-gb/exhibitor-directory.html';
const WTM: EditionTarget = { name: 'WTM - WORLD TRAVEL MARKET', startDate: '2027-11-02', city: 'London', venue: 'ExCeL London', website: WTM_LIST };
const wtmPage = (overrides: Partial<RxPage> = {}) =>
  rxPage({ url: WTM_LIST, title: 'Travel Companies Exhibiting at WTM London', name: 'World Travel Market London', start: '2027-11-02', location: 'Excel, London', directory: WTM_LIST, ...overrides });

const rejections = (result: Awaited<ReturnType<typeof discoverExhibitors>>) => result.rejected.map((item) => item.reason).join(' / ');

describe('RX: a directory whose own records name an earlier edition', () => {
  it('rejects Manufacturing World Osaka 2027: the edition and its directory code still say 2026', async () => {
    const home = rxPage({
      url: MWO_HOME,
      title: 'Manufacturing World Osaka 2027 | Western Japan&#39;s Largest Industrial Trade Show',
      name: 'ものづくり  ワールド [大阪] - Manufacturing World Osaka 2026',
      start: '2027-10-06',
      location: 'INTEX Osaka, Japan',
      directory: MWO_DIRECTORY,
    });
    const result = await discover(MWO, rxNetwork({ [MWO_HOME]: { body: home } }), RUN_DAY);
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(result.exhibitors).toEqual([]);
    expect(rejections(result)).toMatch(/the directory is the 2026 edition's/);
    // A refresh with this verdict takes back a list stored as verified (exhibitor-resolver.ts, mergeAttempt).
    expect(result.rejected.some((item) => isAnotherEdition(item.reason))).toBe(true);
  });

  it('rejects IJT Autumn 2027: the directory is titled "Previous Exhibitor Directory" under a 2026 code', async () => {
    const page = rxPage({ url: IJT_DIRECTORY, title: 'Previous Exhibitor Directory', name: '国際宝飾展 秋(秋のIJT)', start: '2027-10-27', location: 'Pacifico Yokohama', directory: IJT_DIRECTORY });
    const result = await discover(IJT, rxNetwork({ [IJT_DIRECTORY]: { body: page } }), RUN_DAY);
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(rejections(result)).toMatch(/Previous Exhibitor Directory/);
  });

  it('rejects G2E 2027: the directory page is titled "2026 Exhibitor List" though the site shows 2027 dates', async () => {
    const page = rxPage({ url: G2E_LIST, title: '2026 Exhibitor List', name: '', start: '2027-09-27', location: 'THE VENETIAN EXPO, LAS VEGAS', directory: G2E_LIST });
    const result = await discover(G2E, rxNetwork({ [G2E_LIST]: { body: page } }), RUN_DAY);
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(rejections(result)).toMatch(/the directory is the 2026 edition's/);
  });

  it('reads years from the edition name, the directory code and the directory title — never the site dates', () => {
    expect(rxDirectoryYears({ editionName: 'ものづくり ワールド [大阪] - Manufacturing World Osaka 2026', urls: [MWO_DIRECTORY] })).toEqual([2026]);
    expect(rxDirectoryYears({ editionName: '国際宝飾展 秋(秋のIJT)', urls: [IJT_DIRECTORY, `${IJT_DIRECTORY.replace(/\.html$/, '')}/directory-details.{0}.html`] })).toEqual([2026]);
    expect(rxDirectoryYears({ editionName: '', urls: [G2E_LIST], directoryTitle: '2026 Exhibitor List' })).toEqual([2026]);
    expect(rxDirectoryYears({ editionName: 'World Travel Market London', urls: [WTM_LIST] })).toEqual([]);
    // A show path that merely contains digits is no edition code.
    expect(rxDirectoryYears({ editionName: 'FIBO', urls: ['https://www.fibo.com/en-gb/exhibitors/2027.html', 'https://x.com/a/b2026/list.html'] })).toEqual([]);
  });
});

describe('RX: an undated directory for an edition a year away', () => {
  it('rejects WTM London 2027 while the list still carries no year (the 2026 show closed that month)', async () => {
    const result = await discover(WTM, rxNetwork({ [WTM_LIST]: { body: wtmPage() } }), RUN_DAY);
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(rejections(result)).toMatch(/does not say it is for 2027, and the 2027 edition is more than six months away/);
  });

  it('accepts the same undated list within six months of the show', async () => {
    const result = await discover(WTM, rxNetwork({ [WTM_LIST]: { body: wtmPage() } }), new Date('2027-07-01T08:00:00Z'));
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.exhibitors.map((card) => card.name).sort()).toEqual([...RX_NAMES].sort());
  });

  it('accepts a year-away list whose edition names 2027', async () => {
    const result = await discover(WTM, rxNetwork({ [WTM_LIST]: { body: wtmPage({ name: 'World Travel Market London 2027' }) } }), RUN_DAY);
    expect(result.status).toBe('VERIFIED_LIST');
  });

  it('still reports an empty undated directory as "no exhibitors yet": it claims none', async () => {
    const result = await discover(WTM, rxNetwork({ [WTM_LIST]: { body: wtmPage() } }, []), RUN_DAY);
    expect(result.status).toBe('VERIFIED_EMPTY_DIRECTORY');
  });
});

describe('isFutureEdition', () => {
  it('draws the line half a year before the show', () => {
    const show = { startDate: '2027-10-01' };
    const day = 24 * 60 * 60 * 1000;
    expect(UNDATED_LIST_LEAD_DAYS).toBe(183);
    expect(isFutureEdition(show, RUN_DAY)).toBe(true);
    expect(isFutureEdition(show, Date.parse('2027-10-01') - 184 * day)).toBe(true);
    expect(isFutureEdition(show, Date.parse('2027-10-01') - 183 * day)).toBe(false);
    expect(isFutureEdition(show, NEAR_DAY)).toBe(false);
    // A past edition is never "future": its list is judged as before.
    expect(isFutureEdition({ startDate: '2026-10-01' }, RUN_DAY)).toBe(false);
  });
});

// --- Organizer-built pages ----------------------------------------------------------------------

const target = (name: string, startDate: string, city: string, website: string): EditionTarget => ({ name, startDate, city, website });

describe('organizer pages: announced dates over an undated list, a year out', () => {
  // Headlines and header dates exactly as the five pages showed them on the day of the run.
  const cases: [string, EditionTarget, string, string][] = [
    ['Dentistry Show London', target('DENTISTRY SHOW LONDON', '2027-10-01', 'London', 'https://london.dentistryshow.co.uk'), 'Exhibitor List | DSL27 | 1-2 October | Excel London | /exhibitor-list', '1-2 October 2027 ExCeL London'],
    ['The Emergency Services Show', target('THE EMERGENCY SERVICES SHOW', '2027-10-06', 'Birmingham', 'https://www.emergencyuk.com'), 'Exhibitor List | The Emergency Services Show | /exhibitor-list', '6-7 October 2027 NEC Birmingham'],
    ['Maryland Fall Home & Garden', target('MARYLAND FALL HOME & GARDEN + CRAFT SHOW', '2027-10-15', 'Timonium, MD', 'https://www.mdfallhomeandgarden.com'), 'New Products | Maryland Fall Home + Garden & Craft Show | /exhibitor-list/new-products', 'October 15-17, 2027'],
    ['Winterfair Hardenberg', target('WINTERFAIR HARDENGERG', '2027-11-05', 'Hardenberg', 'https://www.winterfairhardenberg.nl'), 'Exposanten | Winter Fair NL | /exhibitors/', '5, 6 en 7 november 2027'],
    ['Salon Atlantica', target('SALON ATLANTICA', '2027-10-12', 'Niort', 'https://www.salon-atlantica.fr'), 'Les exposants - Salon Atlantica | Les exposants | /liste-des-exposants/', '14 octobre 2027'],
  ];

  for (const [show, edition, identity, header] of cases) {
    it(`rejects ${show}: the header announces 2027 but the list never says it is 2027's`, () => {
      const verdict = judgeOrganizerPage(edition, identity, `${header} … exhibitors of the 2026 show`, undefined, RUN_DAY);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toMatch(/does not say it is for 2027/);
      expect(isAnotherEdition(verdict.reason)).toBe(true);
    });
  }

  it('trusts the announced dates within six months of the show, as before', () => {
    const [, edition, identity, header] = cases[0];
    expect(judgeOrganizerPage(edition, identity, header, undefined, NEAR_DAY)).toEqual({ ok: true, reason: 'the official list announces 2027-10-01' });
  });

  it('accepts a year-away list whose headline or own address names 2027', () => {
    const franchising = target('FRANCHISING & BUSINESS OPPORTUNITIES EXPO - MELBOURNE', '2027-08-07', 'Melbourne', 'https://www.franchisingexpo.com.au');
    expect(judgeOrganizerPage(franchising, 'Franchising Expo - Sydney, Melbourne, Brisbane, Perth | /expos/melbourne-2027/exhibitors', '7-8 August 2027', undefined, RUN_DAY).ok).toBe(true);
    expect(judgeOrganizerPage(cases[0][1], 'Exhibitor List 2027 | /exhibitor-list', '1-2 October 2027', undefined, RUN_DAY).ok).toBe(true);
  });
});

describe('organizer pages: information for exhibitors is not an exhibitor list', () => {
  it('rejects Fakuma’s "Ausstellerinformationen" page, whatever dates it announces', () => {
    const fakuma = target('FAKUMA', '2027-10-11', 'Friedrichshafen', 'https://www.fakuma-messe.de');
    const verdict = judgeOrganizerPage(fakuma, 'Ausstellerinformationen | Fakuma 2027 | /fuer-aussteller/ausstellerinformationen/', '11. bis 15. Oktober 2027', undefined, NEAR_DAY);
    expect(verdict).toMatchObject({ ok: false, reason: expect.stringMatching(/information for exhibitors/) });
  });

  it('rejects Camperbeurs’ "Praktische informatie exposant" page', () => {
    const camper = target('CAMPERBEURS HARDENBERG', '2027-09-17', 'Hardenberg', 'https://www.camper-beurs.nl');
    const verdict = judgeOrganizerPage(camper, 'Praktische informatie exposant - Camperbeurs 2027 | /deelnemen/praktische-informatie-exposant/', '17-19 september 2027', undefined, NEAR_DAY);
    expect(verdict).toMatchObject({ ok: false, reason: expect.stringMatching(/information for exhibitors/) });
  });

  it('rejects a grid of news articles as exhibitor cards (Fakuma’s /specials/)', () => {
    const base = 'https://www.fakuma-messe.de/specials/';
    const articles = [
      ['Fakuma 2026: Technologien fördern – Zukunft gestalten – Menschen verbinden', 'fakuma-2026-technologien-foerdern-zukunft-gestalten-menschen-verbinden'],
      ['Volles Haus beim Fest für den Kunststoff: Die 30. Fakuma ist eröffnet!', 'volles-haus-beim-fest-fuer-den-kunststoff-die-30-fakuma-ist-eroeffnet'],
      ['28. Fakuma im Oktober 2023 – schon jetzt hoher Buchungsstand', '28-fakuma-im-oktober-2023-schon-jetzt-hoher-buchungsstand'],
      ['Auf der Fakuma 2023: Wo Geschäfte in der Kunststoffbranche gemacht werden', 'auf-der-fakuma-2023-wo-geschaefte-in-der-kunststoffbranche-gemacht-werden'],
    ].map(([name, slug]) => ({ name, profileUrl: `${base}${slug}/` }));
    expect(notExhibitorLinks(articles)).toMatch(/the links are articles/);
  });

  it('keeps real exhibitors with long names or long addresses', () => {
    const cards = [
      { name: 'National Self-Employment Association Education & Training', profileUrl: 'https://www.franchisingexpo.com.au/directory/national-self-employment-association' },
      { name: 'Kip McGrath Education Centres', profileUrl: 'https://www.franchisingexpo.com.au/directory/kip-mcgrath-education-centres' },
      { name: 'Town & Country Pizza and Pasta', profileUrl: 'https://www.franchisingexpo.com.au/directory/town-and-country-pizza-pasta' },
      { name: 'Acme', profileUrl: 'https://www.example.com/exhibitors/acme-industrial-robotics-and-automation-systems-gmbh-co-kg' },
    ];
    expect(notExhibitorLinks(cards)).toBeNull();
  });
});

// --- Organizer list end to end: the clock reaches the judge through discovery ---------------------

const SHOW: EditionTarget = { name: 'SHOW EXPO LONDON', startDate: '2027-10-09', city: 'London', website: 'http://www.showexpo.com' };
const HOME = `<html><body><nav><a href="/exhibitor-list">Exhibitor list</a><a href="/visit">Visit</a></nav><p>Welcome</p></body></html>`;

function listPage(title: string) {
  const names = ['Acme Robotics', 'Beta Controls', 'Gamma Tools', 'Delta Sensors', 'Epsilon Labs', 'Zeta Cables', 'Kappa Motors', 'Lambda Optics'];
  const cards = names
    .map((name, index) => {
      const href = `/exhibitors/${name.toLowerCase().replace(/\s+/g, '-')}`;
      return `<li class="m-exhibitors-list__item"><a href="${href}"><img data-src="https://www.showexpo.com/logos/${index}.png" alt="${name} logo"></a>
        <h3><a href="${href}">${name}</a></h3><div class="stand">Stand ${String.fromCharCode(65 + index)}${index + 10} More Info</div>
        <p>${name} builds precise industrial equipment for factories, labs and field teams worldwide.</p></li>`;
    })
    .join('');
  return `<html><head><title>${title}</title></head><body>
    <header class="site-header"><nav><a href="/exhibitors/registration">Registration</a><a href="/exhibitors/faq">FAQ</a><a href="/exhibitors/contact">Contact</a></nav>
      <p>8-10 October 2027 · Olympia London</p></header>
    <main><h1>Exhibitors</h1><ul class="m-exhibitors-list">${cards}</ul></main>
    <footer><a href="/privacy">Privacy</a></footer></body></html>`;
}

function organizerSite(title: string): Fetcher {
  const routes: Record<string, Answer> = {
    'http://www.showexpo.com': { body: HOME },
    'https://www.showexpo.com/exhibitor-list': { body: listPage(title) },
    'http://www.showexpo.com/exhibitor-list': { body: listPage(title), url: 'https://www.showexpo.com/exhibitor-list' },
    'https://www.showexpo.com/exhibitors/acme-robotics': { body: '<h1>Acme Robotics</h1>' },
  };
  return async (url) => {
    const route = routes[url] ?? { status: 404, body: '' };
    return { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(route.body), truncated: false } as Fetched;
  };
}

describe('organizer-built directory end to end', () => {
  it('does not store a year-away undated list as verified', async () => {
    const result = await discover(SHOW, organizerSite('Exhibitor list'), RUN_DAY);
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(result.exhibitors).toEqual([]);
  });

  it('stores it two months before the show, and a year-away list headed 2027 at once', async () => {
    expect((await discover(SHOW, organizerSite('Exhibitor list'), NEAR_DAY)).status).toBe('VERIFIED_LIST');
    expect((await discover(SHOW, organizerSite('Exhibitor list 2027'), RUN_DAY)).status).toBe('VERIFIED_LIST');
  });
});
