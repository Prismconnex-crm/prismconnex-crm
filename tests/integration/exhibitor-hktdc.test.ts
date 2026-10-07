import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { hktdcCards, hktdcFairCodes, hktdcListUrl, hktdcPage } from '@/lib/find-shows/exhibitor-adapters/hktdc';
import type { EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

type Answer = { status?: number; body: string; url?: string } | Error;

function network(routes: Record<string, Answer>) {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    const route = routes[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    return { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(route.body), truncated: false } as Fetched;
  };
  return { fetcher, calls };
}

const now = () => new Date('2026-09-30T12:00:00Z');
const run = (target: EditionTarget, net: ReturnType<typeof network>) => discoverExhibitors(target, { fetcher: net.fetcher, now, retryDelayMs: 0 });

type Exhibitor = { exhibitorName: string; exhibitorUrn: string; boothNumbers: string; supplierLogo: string | null; fairSymbol: string; fairFiscalYear: string };
const exhibitor = (urn: string, name: string, booth: string, fair = 'electronicasia', year = '2627'): Exhibitor => ({
  exhibitorName: name,
  exhibitorUrn: urn,
  boothNumbers: booth,
  supplierLogo: `https://sourcing-media.hktdc.com/${urn}`,
  fairSymbol: fair,
  fairFiscalYear: year,
});
const FAIR = {
  fair_code: 'electronicasia',
  fiscal_year: '2627',
  wins_event_name: 'electronicAsia 2026',
  wins_event_start_datetime: '2026-10-13 00:00:00+08:00',
  fair_display_name: { en: 'electronicAsia' },
  fair_short_name: { en: 'eAsia' },
};
/** A fair's exhibitor-list page as the site renders it: its __NEXT_DATA__ carries the edition and one page of exhibitors. */
const listPage = (data: Exhibitor[], total: number, fair: object = FAIR) =>
  `<html><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { fairOption: { fairCode: 'electronicasia' }, siteSettings: { fairDtl: fair }, exhibitorListData: { from: 0, size: 100, totalSize: total, data } } },
  })}</script></body></html>`;

const HOME = 'https://www.hktdc.com/event/electronicasia/en';
const PAGE_1 = [exhibitor('1S1', 'ABO Electronics (Shenzhen) Co., Ltd.', '5B-D07'), exhibitor('1S2', 'Acoustic Dynamics Limited', '5B-C06, 5B-C07'), exhibitor('9X9', 'Autumn Fair Exhibitor', '1A-A01', 'hkelectronicsfairae')];
const routes = (overrides: Record<string, Answer> = {}): Record<string, Answer> => ({
  [HOME]: { body: '<html><body><a href="/event/electronicasia/en/exhibitor-list">Exhibitor list</a></body></html>' },
  [hktdcListUrl('electronicasia', 1)]: { body: listPage(PAGE_1, 103) },
  [hktdcListUrl('electronicasia', 2)]: { body: listPage([exhibitor('1S3', 'Zeta Components', '5B-A01')], 103) },
  ...overrides,
});
const EASIA: EditionTarget = { name: 'ELECTRONIC ASIA', startDate: '2026-10-13', city: 'Hong Kong', website: HOME };

describe('HKTDC exhibitor lists: pure rules', () => {
  it('finds the fair a page belongs to, on any of HKTDC’s address forms', () => {
    expect(hktdcFairCodes('', 'https://www.hktdc.com/event/hkwatchfair/en')).toEqual(['hkwatchfair']);
    expect(hktdcFairCodes('', 'https://www.hktdc.com/fair/hkwinefair-en/Hong-Kong-Wine-Fair.html')).toEqual(['hkwinefair']);
    expect(hktdcFairCodes('', 'https://www.example.com/event/hkwatchfair/en')).toEqual([]);
    expect(hktdcListUrl('electronicasia', 2)).toBe('https://www.hktdc.com/event/electronicasia/en/exhibitor-list?fairCode=electronicasia&locale=en&pageNum=2&pageSize=100');
  });

  it('reads the edition and exhibitors from the page data, with booths and the official profile', () => {
    const page = hktdcPage(listPage(PAGE_1, 3))!;
    expect(page).toMatchObject({ total: 3, fair: { fair_code: 'electronicasia', fiscal_year: '2627' } });
    expect(hktdcCards(page.exhibitors.slice(1, 2), 'electronicasia')).toEqual([
      {
        id: '1S2',
        name: 'Acoustic Dynamics Limited',
        logoUrl: 'https://sourcing-media.hktdc.com/1S2',
        booths: ['5B-C06', '5B-C07'],
        description: null,
        profileUrl: 'https://www.hktdc.com/event/electronicasia/en/exhibitor/1S2',
        access: 'public',
      },
    ]);
    expect(hktdcPage('<html></html>')).toBeNull();
  });
});

describe('HKTDC exhibitor lists: discovery', () => {
  it('reads every page, keeping only this fair’s exhibitors (not the fair held alongside it)', async () => {
    const net = network(routes());
    const result = await run(EASIA, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'hktdc', editionLabel: 'electronicAsia 2026', directoryUrl: 'https://www.hktdc.com/event/electronicasia/en/exhibitor-list' });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['ABO Electronics (Shenzhen) Co., Ltd.', 'Acoustic Dynamics Limited', 'Zeta Components']);
    expect(net.calls).toContain(hktdcListUrl('electronicasia', 2));
  });

  it('never shows the previous edition’s list while the site is between editions', async () => {
    const old = [exhibitor('1S1', 'Last Year Ltd', '5B-D07', 'electronicasia', '2526')];
    const result = await run(EASIA, network(routes({ [hktdcListUrl('electronicasia', 1)]: { body: listPage(old, 1) } })));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'hktdc' && /2025\/26 edition/.test(item.reason))).toBe(true);
  });

  it('rejects a site that is already on another edition (dates), or another fair', async () => {
    const next = { ...FAIR, wins_event_name: 'electronicAsia 2027', wins_event_start_datetime: '2027-10-13 00:00:00+08:00', fiscal_year: '2728' };
    const later = await run(EASIA, network(routes({ [hktdcListUrl('electronicasia', 1)]: { body: listPage([], 0, next) } })));
    expect(later.rejected.some((item) => item.platform === 'hktdc' && /starts 2027-10-13/.test(item.reason))).toBe(true);
    const spring = { ...FAIR, wins_event_name: 'HKTDC Hong Kong International Lighting Fair (Spring Edition) 2027', wins_event_start_datetime: '2027-04-06 00:00:00+08:00' };
    const lighting: EditionTarget = { name: 'HONG KONG INTERNATIONAL LIGHTING FAIR', startDate: '2026-10-27', city: 'Hong Kong', website: HOME };
    const wrong = await run(lighting, network(routes({ [hktdcListUrl('electronicasia', 1)]: { body: listPage(PAGE_1, 3, spring) } })));
    expect(wrong.status).toBe('NO_VERIFIED_DIRECTORY');
  });

  it('keeps what it read and states the total when a page fails; an unreadable list is unfinished', async () => {
    const partial = await run(EASIA, network(routes({ [hktdcListUrl('electronicasia', 2)]: new Error('fetch failed (ECONNRESET)') })));
    expect(partial).toMatchObject({ status: 'VERIFIED_LIST', total: 103 });
    expect(partial.exhibitors).toHaveLength(2);
    const wall = { status: 403, body: '<title>Access Denied</title>' };
    expect((await run(EASIA, network(routes({ [hktdcListUrl('electronicasia', 1)]: wall })))).status).toBe('DISCOVERY_INCOMPLETE');
  });
});
