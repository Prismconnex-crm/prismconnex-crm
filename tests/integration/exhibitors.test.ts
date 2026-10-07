import { describe, expect, it } from 'vitest';
import {
  filterCards,
  judgeEdition,
  letterCounts,
  mapYourShowCards,
  mapYourShowIdentity,
  platformRefs,
  rxCards,
  rxSettings,
  shortDescription,
  swapcardPage,
  yearInShowCode,
  type EditionTarget,
  type ExhibitorCard,
  type ExhibitorDirectory,
  type RxSettings,
} from '@/lib/find-shows/exhibitors';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { effectiveDirectory, isFresh, mergeAttempt } from '@/lib/find-shows/exhibitor-resolver';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

const POWERGEN: EditionTarget = {
  name: 'POWER-GEN INTERNATIONAL',
  startDate: '2027-01-18',
  city: 'Salt Lake City, UT',
  venue: 'Salt Palace Convention Center',
  website: 'http://www.powergen.com',
};

// --- Edition matching -------------------------------------------------------------

describe('judgeEdition', () => {
  it('accepts the same show and year', () => {
    expect(judgeEdition(POWERGEN, { label: 'POWERGEN 2027', year: 2027 }).ok).toBe(true);
  });

  it('rejects another year of the same show', () => {
    const verdict = judgeEdition({ ...POWERGEN, name: 'PROMAT', website: 'http://www.promatshow.com', startDate: '2027-04-19' }, { label: 'ProMat 2025', year: 2025 });
    expect(verdict).toEqual({ ok: false, reason: '"ProMat 2025" is the 2025 edition, not 2027' });
  });

  it('rejects a stated start date far from the catalog edition', () => {
    const isc = { name: 'ISC WEST', startDate: '2027-04-05', city: 'Las Vegas, NV', website: 'http://www.iscwest.com' };
    const verdict = judgeEdition(isc, { label: 'ISC West 2026', year: 2026, startDate: '2026-03-23T12:00:00.000+08:00' });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('starts 2026-03-23');
  });

  it('rejects a sister show linked from the same site', () => {
    const pei = { name: 'PACK EXPO INTERNATIONAL - CHICAGO', startDate: '2027-10-18', city: 'Chicago, IL', website: 'http://www.packexpointernational.com' };
    const verdict = judgeEdition(pei, { label: 'PACK EXPO Southeast 2027', year: 2027 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('southeast');
  });

  it('rejects a directory with no year and no dates', () => {
    expect(judgeEdition(POWERGEN, { label: 'POWERGEN', year: null }).ok).toBe(false);
  });

  it('accepts city aliases and distinctive venue words as the location', () => {
    const euroblech = { name: 'EURO-BLECH', startDate: '2026-10-20', city: 'Hannover', website: 'http://www.euroblech.de' };
    expect(judgeEdition(euroblech, { label: 'EuroBLECH', year: 2026, startDate: '2026-10-20', location: 'Hanover, Germany' }).ok).toBe(true);
    const nycc = { name: 'NEW YORK COMIC CON', startDate: '2026-10-08', city: 'New York, NY', venue: 'Jacob K. Javits Convention Center', website: 'http://www.newyorkcomiccon.com' };
    expect(judgeEdition(nycc, { label: 'New York Comic Con', year: 2026, startDate: '2026-10-08', location: 'Javits Center' }).ok).toBe(true);
  });

  it('rejects a stated location in another city', () => {
    const verdict = judgeEdition(POWERGEN, { label: 'POWERGEN 2027', year: 2027, location: 'Orange County Convention Center, Orlando' });
    expect(verdict.ok).toBe(false);
  });

  it('treats code-like labels as codes, not show names', () => {
    const alu = { name: 'ALUMINIUM', startDate: '2026-10-06', city: 'Dusseldorf', website: 'http://www.aluminium-messe.com' };
    expect(judgeEdition(alu, { label: 'ALU2026', year: 2026, startDate: '2026-10-06' }).ok).toBe(true);
  });
});

describe('yearInShowCode', () => {
  it.each([
    ['pg2027', 2027],
    ['restaurant27', 2027],
    ['packexpo26', 2026],
    ['ge27woc', 2027],
    ['PG2027', 2027],
    ['mys', null],
  ])('%s → %s', (code, year) => expect(yearInShowCode(code)).toBe(year));
});

// --- Platform references -------------------------------------------------------

const RX_PAGE = `<script>var reactSettingsShowPlanning = JSON.parse("{\\x22props\\x22:{\\x22context\\x22:{\\x22mode\\x22:\\x22public\\x22,\\x22eventEditionId\\x22:\\x22eve\\u002D1\\x22,\\x22eventEditionName\\x22:\\x22Show 2026\\x22,\\x22eventId\\x22:\\x22evt\\u002D9\\x22},\\x22navigation\\x22:{\\x22exhibitorProtectedDetailsUrlFormat\\x22:\\x22\\x22,\\x22exhibitorPublicDirectoryUrlFormat\\x22:\\x22https:\\/\\/www.show.com\\/en\\u002Dgb\\/exhibitor\\u002Ddirectory.html.html\\x22,\\x22exhibitorPublicDetailsUrlFormat\\x22:\\x22https:\\/\\/www.show.com\\/en\\u002Dgb\\/exhibitor\\u002Ddetails.html.{0}.html\\x22},\\x22algoliaConfig\\x22:{\\x22apiKey\\x22:\\x22key\\x22,\\x22appId\\x22:\\x22APP1\\x22},\\x22idpUrl\\x22:\\x22https:\\/\\/auth.reedexpo.com\\x22,\\x22showInfo\\x22:{\\x22startDate\\x22:\\x222026\\u002D10\\u002D20T15:00:00.000+08:00\\x22,\\x22location\\x22:\\x22Hanover, Germany\\x22}}}");</script>`;

describe('platformRefs', () => {
  it('finds Map Your Show codes, including escaped URLs and the exhibitor portal', () => {
    const html = `<a href="https://pg2027.exh.mapyourshow.com/7_0/main/default">Exhibitor portal</a>
      <script>var u = "https:\\u002F\\u002Frestaurant27.mapyourshow.com\\u002F8_0\\u002Fexhview"</script>`;
    const codes = platformRefs(html, 'https://www.example.com/').flatMap((ref) => (ref.platform === 'map-your-show' ? [ref.code] : []));
    expect(codes.sort()).toEqual(['pg2027', 'restaurant27']);
  });

  it('reads the RX site settings and repairs a doubled .html in their URLs', () => {
    const settings = rxSettings(RX_PAGE);
    expect(settings).toMatchObject({
      eventId: 'evt-9',
      eventEditionId: 'eve-1',
      eventEditionName: 'Show 2026',
      startDate: '2026-10-20T15:00:00.000+08:00',
      location: 'Hanover, Germany',
      algoliaAppId: 'APP1',
      publicDirectoryUrl: 'https://www.show.com/en-gb/exhibitor-directory.html',
      publicDetailsUrlFormat: 'https://www.show.com/en-gb/exhibitor-directory/exhibitor-details.{0}.html',
      protectedDetailsUrlFormat: null,
    });
  });

  it('recognises Swapcard lists on an organizer’s own host by the view id', () => {
    const html = `<a href="https://365.ilmac.ch/event/ilmac-lausanne-2026/exhibitors/RXZlbnRWaWV3XzEyMzA3NzU=">Exhibitor list</a>
      <a href="https://wefevents.app.swapcard.com/event/weftec-2026/plannings/x">Agenda</a>`;
    const refs = platformRefs(html, 'https://www.ilmac.ch/en').filter((ref) => ref.platform === 'swapcard');
    expect(refs.map((ref) => ref.platform === 'swapcard' && ref.url)).toEqual([
      'https://365.ilmac.ch/event/ilmac-lausanne-2026/exhibitors/RXZlbnRWaWV3XzEyMzA3NzU=',
      'https://wefevents.app.swapcard.com/event/weftec-2026',
    ]);
  });
});

// --- Cards ----------------------------------------------------------------------

const MYS_JSON = {
  SUCCESS: true,
  DATA: {
    results: {
      exhibitor: {
        hit: [
          { fields: { exhid_l: 'A-321BE', exhname_t: 'ACAF Systems', exhlogo_t: 'A-321BE.jpg', boothsdisplay_la: ['4637randomstring'] } },
          { fields: { exhid_l: 'A-313CD', exhname_t: 'Sant&#8217; Andrea  Co', exhdesc_t: 'Tabletop <b>products</b>.', boothsdisplay_la: [] } },
          { fields: { exhid_l: 'A-313CD', exhname_t: 'Duplicate' } },
        ],
      },
    },
  },
};

describe('mapYourShowCards', () => {
  it('maps only what the directory publishes', () => {
    expect(mapYourShowCards(MYS_JSON, 'pg2027', 'PG2027')).toEqual([
      {
        id: 'A-321BE',
        name: 'ACAF Systems',
        logoUrl: 'https://pg2027.mapyourshow.com/mys_shared/pg2027/logos/A-321BE.jpg',
        booths: ['4637'],
        description: null,
        profileUrl: 'https://pg2027.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=A-321BE',
        access: 'public',
      },
      {
        id: 'A-313CD',
        name: 'Sant’ Andrea Co',
        logoUrl: null,
        booths: [],
        description: 'Tabletop products.',
        profileUrl: 'https://pg2027.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=A-313CD',
        access: 'public',
      },
    ]);
  });

  it('turns line breaks and block tags into spaces, drops inline tags', () => {
    expect(shortDescription('<p>Line one<br>line <a href="x">two</a>s.</p><article>Three</article>')).toBe('Line one line twos. Three');
  });

  it('reads the show name and id from the list page', () => {
    expect(mapYourShowIdentity('<title>POWERGEN 2027 | Search for All Exhibitors</title><script>showid = "PG2027";</script>')).toEqual({
      label: 'POWERGEN 2027',
      showId: 'PG2027',
    });
  });
});

const RX: RxSettings = {
  eventId: 'evt-9',
  eventEditionId: 'eve-1',
  eventEditionName: 'Show 2026',
  startDate: '2026-10-20',
  location: null,
  mode: 'public',
  algoliaAppId: 'APP1',
  algoliaApiKey: 'key',
  publicDetailsUrlFormat: 'https://www.show.com/d/exhibitor-details.{0}.html',
  protectedDetailsUrlFormat: null,
  publicDirectoryUrl: 'https://www.show.com/d.html',
  loginUrl: 'https://auth.reedexpo.com',
};

describe('rxCards', () => {
  const hits = {
    hits: [
      { recordType: 'exhibitor', eventEditionId: 'eve-1', organisationGuid: 'org-1', exhibitorName: 'Alpha', standReference: 'A1, A2', email: 'x@y.z', phone: '1' },
      { recordType: 'exhibitor', eventEditionId: 'eve-OLD', organisationGuid: 'org-2', exhibitorName: 'Last year only' },
      { recordType: 'product', eventEditionId: 'eve-1', organisationGuid: 'org-3', exhibitorName: 'A product' },
    ],
  };

  it('keeps only this edition’s exhibitors and never copies contact details', () => {
    const cards = rxCards(hits, RX)!;
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      id: 'org-1',
      name: 'Alpha',
      logoUrl: null,
      booths: ['A1', 'A2'],
      description: null,
      profileUrl: 'https://www.show.com/d/exhibitor-details.org-1.html',
      access: 'public',
    });
    expect(JSON.stringify(cards)).not.toMatch(/x@y\.z/);
  });

  it('marks profiles login-required when the show only has protected details pages', () => {
    const cards = rxCards(hits, { ...RX, publicDetailsUrlFormat: null, protectedDetailsUrlFormat: 'https://www.show.com/p/details.{0}.html' })!;
    expect(cards[0]).toMatchObject({ access: 'login-required', profileUrl: 'https://www.show.com/p/details.org-1.html' });
  });
});

function swapcardHtml({ isPublic, withList }: { isPublic: boolean; withList: boolean }) {
  const apolloState: Record<string, unknown> = {
    'Core_Event:RXZlbnRfMQ==': { __typename: 'Core_Event', slug: 'ilmac-lausanne-2026', title: 'Ilmac Lausanne 2026', 'beginsAt({"format":"ISO8601"})': '2026-09-23T09:00:00+02:00', isPublic },
  };
  if (withList) {
    apolloState['Core_EventExhibitorListView:RXZlbnRWaWV3XzE='] = {
      'exhibitors({"cursor":{"first":50}})': { nodes: [{ __ref: 'Core_Exhibitor:RXhoaWJpdG9yXzE=' }], totalCount: 196 },
    };
    apolloState['Core_Exhibitor:RXhoaWJpdG9yXzE='] = {
      _id: 'RXhoaWJpdG9yXzE=',
      name: 'Anton Paar Switzerland AG',
      logoUrl: 'https://cdn-api.swapcard.com/public/images/a.jpeg',
      htmlDescription: '<p>Premium instruments</p>',
      'withEvent({"eventId":"RXZlbnRfMQ=="})': { booth: 'B240' },
    };
  }
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { apolloState } })}</script>`;
}

describe('swapcardPage', () => {
  const url = 'https://365.ilmac.ch/event/ilmac-lausanne-2026/exhibitors/RXZlbnRWaWV3XzE=';

  it('reads the event and the list’s first page', () => {
    expect(swapcardPage(swapcardHtml({ isPublic: true, withList: true }), url)).toEqual({
      title: 'Ilmac Lausanne 2026',
      beginsAt: '2026-09-23T09:00:00+02:00',
      isPublic: true,
      total: 196,
      cards: [
        {
          id: 'RXhoaWJpdG9yXzE=',
          name: 'Anton Paar Switzerland AG',
          logoUrl: 'https://img.swapcard.com/?o=webp&u=https%3A%2F%2Fcdn-api.swapcard.com%2Fpublic%2Fimages%2Fa.jpeg&q=0.8&m=fit&w=448&h=224',
          booths: ['B240'],
          description: 'Premium instruments',
          profileUrl: 'https://365.ilmac.ch/event/ilmac-lausanne-2026/exhibitor/RXhoaWJpdG9yXzE%3D',
          access: 'public',
        },
      ],
    });
  });
});

// --- Discovery ------------------------------------------------------------------

type Route = { status?: number; body: string | object; type?: string } | Error;

function fakeFetcher(routes: Record<string, Route>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    const route = routes[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    const body = typeof route.body === 'string' ? route.body : JSON.stringify(route.body);
    const response: Fetched = {
      url,
      status: route.status ?? 200,
      contentType: route.type ?? (typeof route.body === 'string' ? 'text/html' : 'application/json'),
      headers: {},
      body: Buffer.from(body),
      truncated: false,
    };
    return response;
  }) as unknown as Fetcher & { calls: string[] };
  fetcher.calls = calls;
  return fetcher;
}

const MYS_LIST = 'https://pg2027.mapyourshow.com/8_0/explore/exhibitor-alphalist.cfm';
const MYS_DATA = 'https://pg2027.mapyourshow.com/8_0/ajax/remote-proxy.cfm?action=search&searchtype=exhibitorgallery&searchsize=5000&start=0';
const now = () => new Date('2026-09-30T12:00:00Z');

describe('discoverExhibitors', () => {
  it('reads the directory an official sub-page links, once its edition matches', async () => {
    const fetcher = fakeFetcher({
      'http://www.powergen.com': { body: '<a href="/exhibit">Exhibition</a><a href="/exhibit/why-exhibit">Book your booth</a>' },
      'http://www.powergen.com/exhibit': { body: '<a href="https://pg2027.exh.mapyourshow.com/7_0/main/default">Exhibitor list</a>' },
      [MYS_LIST]: { body: '<title>POWERGEN 2027 | Search for All Exhibitors</title><script>showid = "PG2027";</script>' },
      [MYS_DATA]: { body: MYS_JSON },
    });
    const result = await discoverExhibitors(POWERGEN, { fetcher, now });
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'map-your-show', editionLabel: 'POWERGEN 2027', foundOn: 'http://www.powergen.com/exhibit' });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['ACAF Systems', 'Sant’ Andrea Co']);
    expect(fetcher.calls).not.toContain('http://www.powergen.com/exhibit/why-exhibit');
  });

  it('never uses another edition’s exhibitors', async () => {
    const fetcher = fakeFetcher({
      'http://www.powergen.com': { body: '<a href="https://pg2026.mapyourshow.com/8_0/">Exhibitors</a>' },
      'https://pg2026.mapyourshow.com/8_0/explore/exhibitor-alphalist.cfm': { body: '<title>POWERGEN 2026</title><script>showid = "PG2026";</script>' },
    });
    const result = await discoverExhibitors(POWERGEN, { fetcher, now });
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.exhibitors).toEqual([]);
    expect(result.rejected[0].reason).toBe('"POWERGEN 2026" is the 2026 edition, not 2027');
    expect(fetcher.calls.some((url) => url.includes('remote-proxy'))).toBe(false);
  });

  it('offers only the official login for a closed Swapcard directory', async () => {
    const list = 'https://365.ilmac.ch/event/ilmac-lausanne-2026/exhibitors/RXZlbnRWaWV3XzE=';
    const fetcher = fakeFetcher({
      'http://www.ilmac.ch/en': { body: `<a href="${list}">Exhibitor list</a>` },
      [list]: { body: swapcardHtml({ isPublic: false, withList: false }) },
    });
    const result = await discoverExhibitors({ name: 'ILMAC LAUSANNE', startDate: '2026-09-23', city: 'Lausanne', website: 'http://www.ilmac.ch/en' }, { fetcher, now });
    expect(result.status).toBe('LOGIN_REQUIRED_DIRECTORY');
    expect(result.source).toMatchObject({ platform: 'swapcard', loginUrl: list });
    expect(result.exhibitors).toEqual([]);
  });

  it('shows a public Swapcard list’s first page and says how many exist', async () => {
    const list = 'https://365.ilmac.ch/event/ilmac-lausanne-2026/exhibitors/RXZlbnRWaWV3XzE=';
    const fetcher = fakeFetcher({
      'http://www.ilmac.ch/en': { body: `<a href="${list}">Exhibitor list</a>` },
      [list]: { body: swapcardHtml({ isPublic: true, withList: true }) },
    });
    const result = await discoverExhibitors({ name: 'ILMAC LAUSANNE', startDate: '2026-09-23', city: 'Lausanne', website: 'http://www.ilmac.ch/en' }, { fetcher, now });
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', total: 196 });
    expect(result.exhibitors).toHaveLength(1);
  });

  it('falls back when the site links no directory, is refused, or cannot be reached', async () => {
    const none = await discoverExhibitors(POWERGEN, { fetcher: fakeFetcher({ 'http://www.powergen.com': { body: '<p>Welcome</p>' } }), now });
    expect(none.status).toBe('NO_VERIFIED_DIRECTORY');
    // A site refusing automated requests was not checked: unfinished, never "no directory".
    const refused = await discoverExhibitors(POWERGEN, { fetcher: fakeFetcher({ 'http://www.powergen.com': { status: 403, body: '' } }), now, retryDelayMs: 0 });
    expect(refused.status).toBe('DISCOVERY_INCOMPLETE');
    expect(refused.reason).toContain('refuses automated requests (HTTP 403)');
    const gone = await discoverExhibitors(POWERGEN, { fetcher: fakeFetcher({ 'http://www.powergen.com': { status: 410, body: '' } }), now, retryDelayMs: 0 });
    expect(gone.status).toBe('NO_VERIFIED_DIRECTORY');
    const down = await discoverExhibitors(POWERGEN, { fetcher: fakeFetcher({ 'http://www.powergen.com': new Error('ECONNRESET') }), now });
    expect(down.status).toBe('DISCOVERY_INCOMPLETE');
  });
});

// --- Store rules ----------------------------------------------------------------

describe('edition store rules', () => {
  const at = (status: ExhibitorDirectory['status'], checkedAt: string): ExhibitorDirectory => ({
    status,
    reason: status,
    checkedAt,
    source: null,
    exhibitors: [],
    rejected: [],
  });
  const edition = { key: 'k', edition: { name: 'X', startDate: '2027-01-18', city: 'Y', website: 'z', slugs: ['x'] } };

  it('keeps a verified list when a later search fails or finds nothing', () => {
    const verified = mergeAttempt(null, edition, at('VERIFIED_LIST', '2026-09-01T00:00:00Z'));
    const failed = mergeAttempt(verified, edition, at('DISCOVERY_INCOMPLETE', '2026-09-02T00:00:00Z'));
    const gone = mergeAttempt(failed, edition, at('NO_VERIFIED_DIRECTORY', '2026-09-03T00:00:00Z'));
    expect(effectiveDirectory(failed).status).toBe('VERIFIED_LIST');
    expect(effectiveDirectory(gone).status).toBe('VERIFIED_LIST');
  });

  it('refreshes lists daily and failed searches after half an hour', () => {
    const now = Date.parse('2026-09-30T12:00:00Z');
    const list = mergeAttempt(null, edition, at('VERIFIED_LIST', '2026-09-30T00:00:00Z'));
    expect(isFresh(list, '2027-01-18', now)).toBe(true);
    expect(isFresh(list, '2027-01-18', now + 24 * 3600_000)).toBe(false);
    const failed = mergeAttempt(null, edition, at('DISCOVERY_INCOMPLETE', '2026-09-30T11:45:00Z'));
    expect(isFresh(failed, '2027-01-18', now)).toBe(true);
    expect(isFresh(failed, '2027-01-18', now + 20 * 60_000)).toBe(false);
  });
});

// --- Browsing -------------------------------------------------------------------

describe('search and A–Z', () => {
  const card = (name: string): ExhibitorCard => ({ id: name, name, logoUrl: null, booths: [], description: null, profileUrl: 'x', access: 'public' });
  const cards = ['3M', 'ABB Ltd', 'Anton Paar', 'Émile Énergie', 'Zeta'].map(card);

  it('files names under their first letter, digits and symbols under #', () => {
    const counts = letterCounts(cards);
    expect(counts).toMatchObject({ '#': 1, A: 2, E: 1, Z: 1, B: 0 });
  });

  it('matches every word of the query, ignoring case and accents', () => {
    expect(filterCards(cards, { query: 'emile' }).map((c) => c.name)).toEqual(['Émile Énergie']);
    expect(filterCards(cards, { query: 'anton paar' }).map((c) => c.name)).toEqual(['Anton Paar']);
    expect(filterCards(cards, { letter: 'A' }).map((c) => c.name)).toEqual(['ABB Ltd', 'Anton Paar']);
    expect(filterCards(cards, { query: 'abb', letter: 'Z' })).toEqual([]);
  });
});
