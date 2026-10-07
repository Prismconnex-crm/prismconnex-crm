import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { ifemaCards, ifemaCatalogue } from '@/lib/find-shows/exhibitor-adapters/ifema';
import type { Poster } from '@/lib/find-shows/exhibitor-adapters/http';
import type { EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

type Answer = { status?: number; body: string; url?: string } | Error;

function network(routes: Record<string, Answer>, searches: Record<string, unknown | Error>) {
  const posts: { url: string; json: unknown }[] = [];
  const fetcher: Fetcher = async (url) => {
    const route = routes[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    return { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(route.body), truncated: false } as Fetched;
  };
  const poster: Poster = async (url, _form, options) => {
    posts.push({ url, json: options?.json });
    const answer = searches[url];
    if (answer instanceof Error) throw answer;
    if (answer === undefined) return { url, status: 404, body: '' };
    return { url, status: 200, body: JSON.stringify(answer) };
  };
  return { fetcher, poster, posts };
}

const now = () => new Date('2026-09-30T12:00:00Z');
const run = (target: EditionTarget, net: ReturnType<typeof network>) => discoverExhibitors(target, { fetcher: net.fetcher, poster: net.poster, now, retryDelayMs: 0 });

const API = 'https://lc-events-web-public.ifema.es/api/v1/tenants/3a88c5e5/editions';
const catalogue = (edition: string, fairEdition: string, dates: string) => `<html><head><title>Exhibitors catalogue</title>
  <script>dataLayer.push({"fair_name": "x", "fair_edicion": "${fairEdition}", "fair_dates_off": "${dates}", "fair_type": "ferias ifema"});</script></head>
  <body><section class="live-connect-exhibitors full-width list-view " data-base-url="${API}/${edition}" data-timeout="30000" data-page-size="18"></section></body></html>`;
const home = (show: string) => `<html><body><nav><a href="https://www.ifema.es/en/${show}/exhibitors/catalogue">Exhibitors catalogue</a></nav><footer>IFEMA MADRID</footer></body></html>`;
const search = (edition: string) => `${API}/${edition}/exhibitors/search?language=en`;

const FITUR_DATA = {
  totalElements: 3,
  hasMoreElements: false,
  data: [
    { id: 'a1', parentId: null, name: 'ABANCA', description: '', imageUrl: 'https://cdn.example/abanca', isDisabled: false, standsInfo: [{ name: '8B17', location: 'P08' }] },
    { id: 'a2', parentId: 'a1', name: 'Co-exhibitor SL', description: '<p>Travel <b>services</b> for groups.</p>', imageUrl: null, isDisabled: false, standsInfo: [] },
    { id: 'a3', name: 'Withdrawn SA', isDisabled: true, standsInfo: [] },
  ],
};

const routes = (extra: Record<string, Answer> = {}): Record<string, Answer> => ({
  'https://www.ifema.es/en/fitur': { body: home('fitur') },
  'https://www.ifema.es/en/fitur/exhibitors/catalogue': { body: catalogue('e0f17a01', 'fitur 2027', '20/01/2027 - 24/01/2027') },
  ...extra,
});
const FITUR: EditionTarget = { name: 'FITUR', startDate: '2027-01-20', city: 'Madrid', website: 'https://www.ifema.es/en/fitur' };

describe('IFEMA catalogues: pure rules', () => {
  it('reads the widget’s edition and the dates the page’s data layer states', () => {
    expect(ifemaCatalogue(catalogue('e0f17a01', 'fitur 2027', '20/01/2027 - 24/01/2027'), 'https://www.ifema.es/en/fitur/exhibitors/catalogue?page=2')).toEqual({
      baseUrl: `${API}/e0f17a01`,
      pageUrl: 'https://www.ifema.es/en/fitur/exhibitors/catalogue',
      edition: 'fitur 2027',
      startDate: '2027-01-20',
    });
    expect(ifemaCatalogue('<section class="live-connect-speakers"></section>', 'https://www.ifema.es/x')).toBeNull();
  });

  it('reads cards: hall and stand, logo, text, the official profile in the catalogue; withdrawn exhibitors are left out', () => {
    const cards = ifemaCards(FITUR_DATA.data, ifemaCatalogue(catalogue('e0f17a01', 'fitur 2027', '20/01/2027'), 'https://www.ifema.es/en/fitur/exhibitors/catalogue')!);
    expect(cards).toEqual([
      { id: 'a1', name: 'ABANCA', logoUrl: 'https://cdn.example/abanca', booths: ['P08 · 8B17'], description: null, profileUrl: 'https://www.ifema.es/en/fitur/exhibitors/catalogue?exp=a1', access: 'public' },
      { id: 'a2', name: 'Co-exhibitor SL', logoUrl: null, booths: [], description: 'Travel services for groups.', profileUrl: 'https://www.ifema.es/en/fitur/exhibitors/catalogue?exp=a2', access: 'public' },
    ]);
  });
});

describe('IFEMA catalogues: discovery', () => {
  it('finds the catalogue from the show page and reads the whole edition in one request', async () => {
    const net = network(routes(), { [search('e0f17a01')]: FITUR_DATA });
    const result = await run(FITUR, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'ifema', editionLabel: 'FITUR 2027', directoryUrl: 'https://www.ifema.es/en/fitur/exhibitors/catalogue' });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['ABANCA', 'Co-exhibitor SL']);
    expect(net.posts[0].json).toEqual({ page: 0, pageSize: 10000, search: '', dynamicFields: [], countryIds: [] });
  });

  it('rejects another edition’s catalogue', async () => {
    const net = network(routes({ 'https://www.ifema.es/en/fitur/exhibitors/catalogue': { body: catalogue('e0001d', 'fitur 2026', '21/01/2026 - 25/01/2026') } }), {});
    const result = await run(FITUR, net);
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'ifema' && /starts 2026-01-21|2026 edition/.test(item.reason))).toBe(true);
    expect(net.posts).toHaveLength(0);
  });

  it('never gives a co-located show a catalogue it shares with another show', async () => {
    // GENERA and MATELEC are held together and their catalogue pages use the same edition.
    const genera: EditionTarget = { name: 'GENERA', startDate: '2026-11-24', city: 'Madrid', website: 'https://www.ifema.es/en/genera', coLocated: [{ name: 'MATELEC', website: 'https://www.ifema.es/en/matelec' }] };
    const net = network(
      {
        'https://www.ifema.es/en/genera': { body: home('genera') },
        'https://www.ifema.es/en/genera/exhibitors/catalogue': { body: catalogue('e05a4ed', 'genera 2026', '24/11/2026 - 26/11/2026') },
        'https://www.ifema.es/en/matelec': { body: home('matelec') },
        'https://www.ifema.es/en/matelec/exhibitors/catalogue': { body: catalogue('e05a4ed', 'matelec 2026', '24/11/2026 - 26/11/2026') },
      },
      { [search('e05a4ed')]: FITUR_DATA }
    );
    const result = await run(genera, net);
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'ifema' && /shared with MATELEC/.test(item.reason))).toBe(true);
    expect(net.posts).toHaveLength(0);
  });

  it('keeps a co-located show’s own catalogue when the other show has its own edition', async () => {
    const fitur: EditionTarget = { ...FITUR, coLocated: [{ name: 'FITUR KNOW-HOW', website: 'https://www.ifema.es/en/know-how' }] };
    const net = network(
      routes({
        'https://www.ifema.es/en/know-how': { body: home('know-how') },
        'https://www.ifema.es/en/know-how/exhibitors/catalogue': { body: catalogue('e0b4e7', 'know-how 2027', '20/01/2027') },
      }),
      { [search('e0f17a01')]: FITUR_DATA }
    );
    expect((await run(fitur, net)).status).toBe('VERIFIED_LIST');
  });

  it('does not give a sub-show the whole show’s catalogue (MATELEC INDUSTRY is not all of "matelec 2026")', async () => {
    const industry: EditionTarget = { name: 'MATELEC INDUSTRY', startDate: '2026-11-24', city: 'Madrid', website: 'https://www.ifema.es/en/matelec' };
    const net = network(
      { 'https://www.ifema.es/en/matelec': { body: home('matelec') }, 'https://www.ifema.es/en/matelec/exhibitors/catalogue': { body: catalogue('e0ae1ec', 'matelec 2026', '24/11/2026') } },
      { [search('e0ae1ec')]: FITUR_DATA }
    );
    const result = await run(industry, net);
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'ifema' && /does not name industry/.test(item.reason))).toBe(true);
  });

  it('never reports an unreachable catalogue as "no exhibitors"', async () => {
    expect((await run(FITUR, network(routes(), { [search('e0f17a01')]: new Error('connect ETIMEDOUT') }))).status).toBe('DISCOVERY_INCOMPLETE');
    const wall = { status: 403, body: '<title>Just a moment...</title>' };
    expect((await run(FITUR, network(routes({ 'https://www.ifema.es/en/fitur/exhibitors/catalogue': wall }), {}))).status).toBe('DISCOVERY_INCOMPLETE');
  });
});
