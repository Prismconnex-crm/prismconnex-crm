import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { mtpEditionInfo, mtpEditions, mtpRows, mtpStands } from '@/lib/find-shows/exhibitor-adapters/mtp';
import type { Poster } from '@/lib/find-shows/exhibitor-adapters/http';
import type { EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

type Answer = { status?: number; body: string | object; url?: string } | Error;

const K = 'https://katalog.grupamtp.pl';
function network(routes: Record<string, Answer>, lists: Record<string, string | Error>) {
  const posts: { url: string; json: unknown }[] = [];
  const fetcher: Fetcher = async (url) => {
    const route = routes[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    const body = typeof route.body === 'string' ? route.body : JSON.stringify(route.body);
    return { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(body), truncated: false } as Fetched;
  };
  const poster: Poster = async (url, _form, options) => {
    posts.push({ url, json: options?.json });
    const skip = new URL(url).searchParams.get('skip') ?? '0';
    const answer = lists[skip];
    if (answer instanceof Error) throw answer;
    return { url, status: answer === undefined ? 404 : 200, body: answer ?? '' };
  };
  return { fetcher, poster, posts };
}

const now = () => new Date('2026-09-30T12:00:00Z');
const run = (target: EditionTarget, net: ReturnType<typeof network>) => discoverExhibitors(target, { fetcher: net.fetcher, poster: net.poster, now, retryDelayMs: 0 });

/** One catalogue row as the endpoint renders it. */
const row = (oid: number, name: string, edition: string, logo = '') => `
        <div class="row">
            <div class="col-md-3 col-sm-3 col-xs-12">${logo ? `<img class="img-responsive center-block" src="${logo}">` : ''}</div>
            <div class="col-md-9 col-sm-9 col-xs-12">
                <a class="clr" href="/en?oid=${oid}&amp;ec=TH92601" target="_self"><h1>
                        ${name}
                    </h1></a>
                    <div class="btn-group" role="group"><button class="btn btn-default" type="button" onclick="doSearch('POLAND');">POLAND</button>
                            <span class="c-company-pill btn-default btn">${edition}</span></div>
            </div>
        </div>`;
const profile = (stands: [string, string][]) => `<html><body><h1>Exhibitor</h1><div>Location details ${stands.map(([pavilion, stand]) => `<p>Pavilion: ${pavilion} Stand: ${stand}</p>`).join('')}</div></body></html>`;
const editionInfo = (shortName: string, name: string, days: string[]) => [
  {
    entry_hours_items: days.map((day) => ({ edition_code: 'TH92601', entrance_day: `${day}T00:00:00` })),
    names_items: [
      { language: 'pl', short_name: shortName, name: 'Targi' },
      { language: 'en', short_name: shortName, name },
    ],
  },
];

const SITE = 'https://caravanssalon.pl/en';
const routes = (info: unknown, extra: Record<string, Answer> = {}): Record<string, Answer> => ({
  [SITE]: { body: `<html><body><a href="http://katalog.grupamtp.pl/en/?ec=TH92601">Exhibitors catalogue</a></body></html>` },
  [`${K}/umbraco/mtpapi/mtpcatalogueapi/geteventsbycodes?editionCode=TH92601`]: { body: info as object },
  [`${K}/en/?ec=TH92601`]: { body: '<script>var lang = \'en\'; var node_id = 3423; var take = 10;</script>' },
  [`${K}/en?oid=101&ec=TH92601`]: { body: profile([['6', '11']]) },
  [`${K}/en?oid=102&ec=TH92601`]: { body: profile([['6', '32'], ['6', '33']]) },
  ...extra,
});
const LIST = [row(101, '2 AP Sp. z o.o.', 'Caravans Salon Poland 2026', '//static.mtp.pl/logos/101.png'), row(102, 'A MOŻE KAMPEREM', 'Caravans Salon Poland 2026'), row(103, 'Other Show Exhibitor', 'Tour Salon 2026')].join('');
const CARAVANS: EditionTarget = { name: 'CARAVANS SALON', startDate: '2026-10-15', city: 'Poznan', website: SITE };
const INFO = editionInfo('Caravans Salon Poland 2026', 'Caravan and motorhome fair', ['2026-10-15', '2026-10-16', '2026-10-17']);

describe('MTP catalogue: pure rules', () => {
  it('reads the edition codes a show site links, and the edition the catalogue describes', () => {
    expect(mtpEditions('<a href="http://katalog.grupamtp.pl/en/?ec=TL12601">x</a><a href="https://katalog.grupamtp.pl/pl/?ec=TL12601">y</a>')).toEqual([{ code: 'TL12601', language: 'en' }]);
    expect(mtpEditionInfo(INFO)).toEqual({
      label: 'Caravans Salon Poland 2026',
      names: ['Caravans Salon Poland 2026', 'Caravan and motorhome fair', 'Caravans Salon Poland 2026', 'Targi'],
      startDate: '2026-10-15',
    });
    expect(mtpEditionInfo([])).toBeNull();
  });

  it('reads rows (name, logo, official profile, edition pill) and stands from a profile', () => {
    const rows = mtpRows(LIST, 'TH92601', 'en');
    expect(rows.map((item) => [item.card.name, item.edition])).toEqual([
      ['2 AP Sp. z o.o.', 'Caravans Salon Poland 2026'],
      ['A MOŻE KAMPEREM', 'Caravans Salon Poland 2026'],
      ['Other Show Exhibitor', 'Tour Salon 2026'],
    ]);
    expect(rows[0].card).toMatchObject({ id: '101', logoUrl: 'https://static.mtp.pl/logos/101.png', profileUrl: `${K}/en?oid=101&ec=TH92601` });
    expect(mtpStands(profile([['6', '32'], ['6', '33'], ['6', '32']]))).toEqual(['Pavilion 6, stand 32', 'Pavilion 6, stand 33']);
  });
});

describe('MTP catalogue: discovery', () => {
  it('lists the edition’s exhibitors with their stands, and nothing labelled with another show', async () => {
    const net = network(routes(INFO), { '0': LIST });
    const result = await run(CARAVANS, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'mtp', editionLabel: 'Caravans Salon Poland 2026', directoryUrl: `${K}/en/?ec=TH92601` });
    expect(result.exhibitors.map((card) => [card.name, card.booths])).toEqual([
      ['2 AP Sp. z o.o.', ['Pavilion 6, stand 11']],
      ['A MOŻE KAMPEREM', ['Pavilion 6, stand 32', 'Pavilion 6, stand 33']],
    ]);
    expect(net.posts[0]).toMatchObject({ url: `${K}/umbraco/surface/mtpcatalogue/getexhibitors?lang=en&node_id=3423&take=1000&skip=0&sort=A-Z`, json: { ec: ['TH92601'] } });
  });

  it('rejects another edition by its opening days', async () => {
    const old = editionInfo('Caravans Salon Poland 2025', 'Caravan fair', ['2025-10-16']);
    const result = await run(CARAVANS, network(routes(old), { '0': LIST }));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'mtp' && /starts 2025-10-16/.test(item.reason))).toBe(true);
  });

  it('never gives part of a show the whole show’s list (POLAGRA-FOOD is not all of "POLAGRA 2026")', async () => {
    const polagra = editionInfo('POLAGRA 2026', 'Food - Horeca - Foodtech', ['2026-09-23']);
    const food: EditionTarget = { name: 'POLAGRA-FOOD', startDate: '2026-09-23', city: 'Poznan', website: SITE };
    const result = await run(food, network(routes(polagra), { '0': LIST }));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'mtp' && /does not name food/.test(item.reason))).toBe(true);
  });

  it('keeps the list when a profile cannot be read (the stand is optional), and treats an unreadable list as unfinished', async () => {
    const kept = await run(CARAVANS, network(routes(INFO, { [`${K}/en?oid=102&ec=TH92601`]: new Error('fetch failed') }), { '0': LIST }));
    expect(kept).toMatchObject({ status: 'VERIFIED_LIST' });
    expect(kept.exhibitors[1].booths).toEqual([]);
    expect((await run(CARAVANS, network(routes(INFO), { '0': new Error('connect ETIMEDOUT') }))).status).toBe('DISCOVERY_INCOMPLETE');
  });
});
