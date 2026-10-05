import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { eraCards, eraList, eraPageUrl, exponentCards, exponentLists, exponentUrl } from '@/lib/find-shows/exhibitor-adapters/iteca';
import type { EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

type Answer = { status?: number; body: string | object; url?: string } | Error;

function network(routes: Record<string, Answer>) {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    const route = routes[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    const body = typeof route.body === 'string' ? route.body : `\n\n${JSON.stringify(route.body)}`;
    return { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(body), truncated: false } as Fetched;
  };
  return { fetcher, calls };
}

const now = () => new Date('2026-09-30T12:00:00Z');
const run = (target: EditionTarget, net: ReturnType<typeof network>) => discoverExhibitors(target, { fetcher: net.fetcher, now, retryDelayMs: 0 });

// --- Kazakhstan: reg.iteca.kz exponent lists ----------------------------------------

const KIOGE_SITE = 'https://kioge.kz';
const KIOGE_HOME = `${KIOGE_SITE}/en`;
const LIST_2026 = `${KIOGE_SITE}/en/exhibition/exhibitors-list/exhibitors-list-2026`;
const LIST_2022 = `${KIOGE_SITE}/en/exhibition/exhibitors-list/exhibitors-list-2022`;
const iframe = (code: string) => `<iframe id="LIST" data-src="https://reg.iteca.kz/list/exponent/en/auth_s.aspx?ExhCode=${encodeURIComponent(code)}"></iframe>
  <script src="https://reg.iteca.kz/list/exponent/scripts/iframeResizer.min.js"></script>`;
const frameUrl = (code: string) => exponentUrl({ origin: 'https://reg.iteca.kz', language: 'en', code });

type Row = [name: string, logo: string, pavilion: string, stand: string, text: string];
/** The list's full view (auth.aspx) as the registration system renders it: one table cell per exhibitor. */
const fullView = (rows: Row[]) => `<html><body><form id="form1"><table id="dgList">${rows
  .map(([name, logo, pavilion, stand, text]) => `<tr><td class="exhib-td"><div class='exhib-div'><div class='logo'><img id='ImagePre' src='${logo}'/></div>
    <div class='exhib-pav-wrap'><div class='exhib-pav-stand'><div class='exhib-pav'><span>Pavilion</span>${pavilion}</div><div class='exhib-stand'><span>stand</span>${stand}</div></div></div>
    <h2 class='exhib-name'>${name}</h2><div class='exhib-details'>Oil &amp; gas services</div><div class='exhib-city'>Kazakhstan - Almaty</div>
    <p class='bg_t_onsite'>${text}</p></div></td></tr>`)
  .join('')}</table></form></body></html>`;

const KIOGE_ROWS: Row[] = [
  ['A&amp;B TECHNOLOGY, LLP', 'https://reg.iteca.kz/loadedimages/0x1a2b.jpg', '11', '11-240', 'Engineering services for the oil and gas industry.'],
  ['A-LIMS, LLP', 'https://reg.iteca.kz/loadedimages/logoexh/KIOGE.jpg', '8', '8-313', ''],
  // A placeholder row is not an exhibitor.
  ['-', 'https://reg.iteca.kz/loadedimages/0x9999.jpg', '11', '11-219', ''],
  ['ZHAIK MUNAI', 'https://reg.iteca.kz/loadedimages/0x3c4d.jpg', '', 'D-12', 'Upstream operator.'],
];

const kiogeRoutes = (overrides: Record<string, Answer> = {}): Record<string, Answer> => ({
  [KIOGE_HOME]: { body: `<html><body><nav><a href="/en/exhibition/exhibitors-list/exhibitors-list-2022">Exhibitors 2022</a><a href="/en/exhibition/exhibitors-list/exhibitors-list-2026">Exhibitors 2026</a></nav><footer>Iteca Exhibitions</footer></body></html>` },
  [LIST_2026]: { body: `<html><head><title>KIOGE - Exhibitors list 2026</title></head><body>${iframe('KIOGE 2026')}</body></html>` },
  [LIST_2022]: { body: `<html><body>${iframe('KIOGE 2022')}</body></html>` },
  [frameUrl('KIOGE 2026')]: { body: fullView(KIOGE_ROWS) },
  ...overrides,
});
const KIOGE: EditionTarget = { name: 'KIOGE', startDate: '2026-09-30', city: 'Almaty', website: KIOGE_HOME };

describe('ITECA exponent lists: pure rules', () => {
  it('reads the edition code a page embeds, in an iframe src or data-src', () => {
    expect(exponentLists(iframe('KIOGE 2026'))).toEqual([{ origin: 'https://reg.iteca.kz', language: 'en', code: 'KIOGE 2026' }]);
    expect(exponentLists('<iframe src="https://reg.iteca.kz/list/exponent/ru/auth_s.aspx?ExhCode=TransKazakhstan+2026">')[0].code).toBe('TransKazakhstan 2026');
    expect(frameUrl('KIOGE 2026')).toBe('https://reg.iteca.kz/list/exponent/en/auth.aspx?ExhCode=KIOGE%202026');
  });

  it('reads cards from the full view: name, one stand, logo (not the show’s), text; no placeholder rows', () => {
    const cards = exponentCards(fullView(KIOGE_ROWS), LIST_2026);
    expect(cards.map((card) => card.name)).toEqual(['A&B TECHNOLOGY, LLP', 'A-LIMS, LLP', 'ZHAIK MUNAI']);
    expect(cards[0]).toEqual({
      id: '0x1a2b',
      name: 'A&B TECHNOLOGY, LLP',
      logoUrl: 'https://reg.iteca.kz/loadedimages/0x1a2b.jpg',
      booths: ['11-240'],
      description: 'Engineering services for the oil and gas industry.',
      profileUrl: LIST_2026,
      access: 'public',
    });
    expect(cards[1]).toMatchObject({ logoUrl: null, booths: ['8-313'], description: null });
    expect(cards[2].booths).toEqual(['D-12']);
  });
});

describe('ITECA exponent lists: discovery', () => {
  it('finds this year’s list page from the official site and lists its exhibitors', async () => {
    const net = network(kiogeRoutes());
    const result = await run(KIOGE, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'iteca', editionLabel: 'KIOGE 2026', directoryUrl: LIST_2026 });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['A&B TECHNOLOGY, LLP', 'A-LIMS, LLP', 'ZHAIK MUNAI']);
    expect(result).toMatchObject({ total: null, partial: false });
    // Another year's list is never downloaded: its edition code is rejected first.
    expect(net.calls).not.toContain(frameUrl('KIOGE 2022'));
  });

  it('never gives a co-located show the host show’s list (NDT Kazakhstan on kioge.kz)', async () => {
    const ndt: EditionTarget = { name: 'NDT KAZAKHSTAN', startDate: '2026-09-30', city: 'Almaty', website: `${KIOGE_SITE}/en/exhibition/ndt` };
    const result = await run(ndt, network({ ...kiogeRoutes(), [`${KIOGE_SITE}/en/exhibition/ndt`]: kiogeRoutes()[KIOGE_HOME] }));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'iteca' && /different show/.test(item.reason))).toBe(true);
  });

  it('rejects last year’s list when this year’s is not published', async () => {
    const routes = kiogeRoutes({ [LIST_2026]: { body: `<html><body>${iframe('KIOGE 2025')}</body></html>` } });
    const result = await run(KIOGE, network(routes));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'iteca' && /2025 edition/.test(item.reason))).toBe(true);
  });

  it('never reports a blocked or unreachable list as "no exhibitors"', async () => {
    const wall = { status: 403, body: '<html><head><title>Just a moment...</title></head></html>' };
    expect((await run(KIOGE, network(kiogeRoutes({ [frameUrl('KIOGE 2026')]: wall })))).status).toBe('DISCOVERY_INCOMPLETE');
    expect((await run(KIOGE, network(kiogeRoutes({ [frameUrl('KIOGE 2026')]: new Error('connect ETIMEDOUT') })))).status).toBe('DISCOVERY_INCOMPLETE');
  });
});

// --- Uzbekistan / Azerbaijan: ERA feeds ---------------------------------------------

const SX = 'https://securex.uz';
const SX_LIST = `${SX}/en/exhibitors-list`;
const eraPage = (o: { id: string; options: string; heading?: string; title?: string }) => `<html><head><base href="${SX}/"><title>${o.title ?? 'Exhibitors List'}</title></head><body>
  <p class="text__gray sub__title2">${o.heading ?? 'Securex Uzbekistan'} <!-- ${o.id} --></p><h4>Exhibitors List</h4>
  <select onchange="ChangeYear(this);"><option></option>${o.options}</select>
  <table id="ERADataTable"></table><footer><img src="/projects/iteca/assets/logolight.webp"></footer>
  <script>var dataTableURL = 'ERAForms/companies_list.php?l=en&exhibition=${o.id}';</script></body></html>`;
const OPTIONS_2026 = '<option value="460" >2025 (11 - 13 November 2025)</option><option value="486" selected>2026 (10 - 12 November 2026)</option>';
const row = (id: number, name: string, stand: string) => [`<a class="cursor_pointer" href="/en/exhibitor-info-486-${id}" target="_blank">${name}</a>`, 'China', stand, 'Uzexpocentre NEC', '<div class="btn-favorite"></div>'];
const ROWS = Array.from({ length: 150 }, (_, index) => row(1000 + index, `COMPANY ${String(index).padStart(3, '0')} LLC`, `A ${index}`));
const sxList = () => eraList(eraPage({ id: '486', options: OPTIONS_2026 }), SX_LIST)!;
const feedPage = (start: number, rows: unknown[][], total = 151) => ({ draw: 1, recordsTotal: total, recordsFiltered: total, data: rows.slice(start, start + 100) });
const WITH_HEAD = [['<!--group-head-->CHINA NATIONAL PAVILION', '', '', ''], ...ROWS];

const sxRoutes = (overrides: Record<string, Answer> = {}): Record<string, Answer> => ({
  [SX]: { body: `<html><head><base href="${SX}/"></head><body><a href="/en/exhibitors-list">Exhibitors List</a><img src="/projects/iteca/assets/logolight.webp"></body></html>` },
  [SX_LIST]: { body: eraPage({ id: '486', options: OPTIONS_2026 }) },
  [eraPageUrl(sxList(), 0)]: { body: feedPage(0, WITH_HEAD) },
  [eraPageUrl(sxList(), 100)]: { body: feedPage(100, WITH_HEAD) },
  ...overrides,
});
const SECUREX: EditionTarget = { name: 'SECUREX UZBEKISTAN', startDate: '2026-11-10', city: 'Tashkent', website: SX };

describe('ITECA ERA feeds: pure rules', () => {
  it('reads the feed (against the page’s base address) and the edition its year selector names', () => {
    expect(sxList()).toEqual({
      feedUrl: 'https://securex.uz/ERAForms/companies_list.php?l=en&exhibition=486',
      exhibitionId: '486',
      pageUrl: SX_LIST,
      label: 'Securex Uzbekistan',
      year: 2026,
      startDate: '2026-11-10',
    });
    // No selector entry: the title states the year ("Exhibitors List – BakuBuild 2025").
    expect(eraList(eraPage({ id: '451', options: '<option value="2026" selected>2026</option>', heading: '', title: 'Exhibitors List – BakuBuild 2025' }), 'https://bakubuild.az/en/exhibitors-list')).toMatchObject({
      label: 'BakuBuild 2025',
      year: 2025,
      startDate: null,
    });
    expect(eraPageUrl(sxList(), 100)).toBe('https://securex.uz/ERAForms/companies_list.php?l=en&exhibition=486&draw=1&start=100&length=100');
  });

  it('reads rows with their stand and public profile; group headings are not exhibitors', () => {
    const cards = eraCards(WITH_HEAD.slice(0, 3), sxList());
    expect(cards).toEqual([
      { id: '1000', name: 'COMPANY 000 LLC', logoUrl: null, booths: ['A 0'], description: null, profileUrl: 'https://securex.uz/en/exhibitor-info-486-1000', access: 'public' },
      { id: '1001', name: 'COMPANY 001 LLC', logoUrl: null, booths: ['A 1'], description: null, profileUrl: 'https://securex.uz/en/exhibitor-info-486-1001', access: 'public' },
    ]);
  });
});

describe('ITECA ERA feeds: discovery', () => {
  it('reads every page of the feed', async () => {
    const result = await run(SECUREX, network(sxRoutes()));
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'iteca', editionLabel: 'Securex Uzbekistan 2026', directoryUrl: SX_LIST });
    expect(result.exhibitors).toHaveLength(150);
    expect(result).toMatchObject({ total: null, partial: false });
  });

  it('keeps what it read and states the total when a page cannot be read', async () => {
    const result = await run(SECUREX, network(sxRoutes({ [eraPageUrl(sxList(), 100)]: new Error('fetch failed (ECONNRESET)') })));
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', total: 151 });
    expect(result.exhibitors).toHaveLength(99);
  });

  it('rejects a list of another edition', async () => {
    const old = '<option value="486" selected>2025 (11 - 13 November 2025)</option>';
    const result = await run(SECUREX, network(sxRoutes({ [SX_LIST]: { body: eraPage({ id: '486', options: old }) } })));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'iteca' && /starts 2025-11-11|2025 edition/.test(item.reason))).toBe(true);
  });

  it('rejects a list that says neither its year nor its dates', async () => {
    const result = await run(SECUREX, network(sxRoutes({ [SX_LIST]: { body: eraPage({ id: '486', options: '' }) } })));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'iteca' && /which year/.test(item.reason))).toBe(true);
  });

  it('treats an unreadable feed as unfinished, never as "no exhibitors"', async () => {
    const result = await run(SECUREX, network(sxRoutes({ [eraPageUrl(sxList(), 0)]: { status: 404, body: 'Not Found' } })));
    expect(result.status).toBe('DISCOVERY_INCOMPLETE');
  });
});
