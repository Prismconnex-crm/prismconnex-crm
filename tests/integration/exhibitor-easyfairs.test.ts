import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { easyfairsEditions, easyfairsPage, easyfairsPageUrl, type EasyfairsHit } from '@/lib/find-shows/exhibitor-adapters/easyfairs';
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

const SITE = 'https://www.metavak.nl';
const HOME = `${SITE}/en`;
const LIST = `${SITE}/en/exhibitors/`;
const LOADER = '<script src="https://my.easyfairs.com/widgets/api/loader/?hostDomain=www.metavak.nl&amp;ver=1.0.10"></script>';

type Stand = [id: string, event: string, name: string, stand: string];
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hit = ([id, event, name, stand]: Stand): EasyfairsHit => ({
  objectID: id,
  containerId: event.startsWith('METAVAK') ? 2606 : 2498,
  eventName: event,
  name,
  standNumber: stand,
  standLogo: `https://my.easyfairs.com/backend/uploads/${id}.png`,
  showLogo: true,
  teaser: { en: `${name} teaser`, nl: `${name} nl` },
  description: { en: `${name} long description`, nl: null },
});

/** An Easyfairs exhibitor page as the site renders it: the widget, its embedded search answer, and one linked card per exhibitor. */
function listPage(stands: Stand[], o: { page: number; nbPages: number; events: Record<string, number>; header?: string }) {
  const results = {
    stands: {
      state: { index: 'stands', filters: '(containerId: 2498 OR containerId: 2606)', hitsPerPage: 2 },
      results: [{ index: 'stands', nbHits: Object.values(o.events).reduce((a, b) => a + b, 0), nbPages: o.nbPages, page: o.page, hitsPerPage: 2, facets: { eventName: o.events }, hits: stands.map(hit) }],
    },
  };
  const cards = stands.map(([id, , name]) => `<li class="ais-Hits-item"><article class="card"><a href="/en/exhibitors/${slug(name)}-${id}/" class="card__link">${name}</a></article></li>`).join('');
  return `<html lang="en"><head><title>Exhibitors | Metavak</title>${LOADER}</head><body><header>${o.header ?? '6 - 8 October 2026 | Evenementenhal Gorinchem'}</header>
    <stand-list languagemapping='{"nl":"","en":"en"}' language="en"><ol class="ais-Hits-list">${cards}</ol></stand-list>
    <script>window[Symbol.for("InstantSearchInitialResults")] = ${JSON.stringify(results)};</script></body></html>`;
}

// METAVAK and the co-located Welding Week, listed together two to a page.
const PAGES: Stand[][] = [
  [['245231', 'Welding Week 2026', '#Team Fronius', 'E48'], ['225152', 'METAVAK 2026', '247Tailorsteel B.V.', 'D24']],
  [['243739', 'METAVAK 2026', '54U Media BV', 'A19'], ['235014', 'Welding Week 2026', 'Binzel Benelux', 'H50']],
  [['250724', 'METAVAK 2026', 'AATEQ', 'J20']],
];
const EVENTS = { 'METAVAK 2026': 3, 'Welding Week 2026': 2 };
const routes = (overrides: Record<string, Answer> = {}): Record<string, Answer> => ({
  [HOME]: { body: `<html><head>${LOADER}</head><body><nav><a href="/en/exhibitors/">Exhibitors</a><a href="/en/visit/">Visit</a></nav></body></html>` },
  [LIST]: { body: listPage(PAGES[0], { page: 0, nbPages: 3, events: EVENTS }) },
  [easyfairsPageUrl(LIST, 2)]: { body: listPage(PAGES[1], { page: 1, nbPages: 3, events: EVENTS }) },
  [easyfairsPageUrl(LIST, 3)]: { body: listPage(PAGES[2], { page: 2, nbPages: 3, events: EVENTS }) },
  ...overrides,
});

const METAVAK: EditionTarget = { name: 'METAVAK GORINCHEM', startDate: '2026-10-06', city: 'Gorinchem', website: HOME };

describe('Easyfairs exhibitor lists: pure rules', () => {
  it('reads the embedded search answer, the shows it counts and the profile each card links', () => {
    const page = easyfairsPage(listPage(PAGES[0], { page: 0, nbPages: 3, events: EVENTS }), LIST)!;
    expect(page).toMatchObject({ nbHits: 5, nbPages: 3, page: 0, events: EVENTS, language: 'en' });
    expect(page.hits.map((item) => item.name)).toEqual(['#Team Fronius', '247Tailorsteel B.V.']);
    expect(page.profiles['225152']).toBe('https://www.metavak.nl/en/exhibitors/247tailorsteel-b-v-225152/');
    expect(easyfairsPage('<html><stand-list></stand-list></html>', LIST)).toBeNull();
  });

  it('pages the list the way the site does: ?stands[page]=N, 1-based', () => {
    expect(easyfairsPageUrl(LIST, 1)).toBe(LIST);
    expect(easyfairsPageUrl(`${LIST}?stands%5Bpage%5D=4`, 2)).toBe('https://www.metavak.nl/en/exhibitors/?stands%5Bpage%5D=2');
  });

  it('keeps only the catalog event’s own shows and editions', () => {
    expect(easyfairsEditions(METAVAK, ['METAVAK 2026', 'Welding Week 2026'], '').kept).toEqual(['METAVAK 2026']);
    expect(easyfairsEditions(METAVAK, ['METAVAK 2024'], '').kept).toEqual([]);
    // A combined catalog event keeps each of its shows.
    const porto: EditionTarget = { name: 'EMPACK AND LOGISTICS & AUTOMATION - PORTO', startDate: '2027-04-28', city: 'Porto', website: 'https://x.example' };
    expect(easyfairsEditions(porto, ['Empack Porto 2027', 'Logistics & Automation Porto 2027', 'Empack Madrid 2027'], '').kept).toEqual(['Empack Porto 2027', 'Logistics & Automation Porto 2027']);
    // Another city's edition of the same show is not this one.
    const zurich: EditionTarget = { name: 'EMPACK ZÜRICH', startDate: '2027-01-27', city: 'Zurich', website: 'https://x.example' };
    expect(easyfairsEditions(zurich, ['Empack Zürich 2027', 'Empack Bern 2027'], '').kept).toEqual(['Empack Zürich 2027']);
  });

  it('judges a show named without its year by the dates the page announces', () => {
    const futurebuild: EditionTarget = { name: 'FUTUREBUILD BELGIUM', startDate: '2027-01-27', city: 'Brussels', website: 'https://x.example' };
    expect(easyfairsEditions(futurebuild, ['Futurebuild Belgium'], '27 28 january 2027 brussels expo').kept).toEqual(['Futurebuild Belgium']);
    expect(easyfairsEditions(futurebuild, ['Futurebuild Belgium'], '').kept).toEqual([]);
    expect(easyfairsEditions(futurebuild, ['Futurebuild Belgium'], '29 30 january 2025').kept).toEqual([]);
  });
});

describe('Easyfairs exhibitor lists: discovery', () => {
  it('reads every page and lists only this show’s exhibitors, with stand, logo, text and official profile', async () => {
    const net = network(routes());
    const result = await run(METAVAK, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'easyfairs', editionLabel: 'METAVAK 2026', directoryUrl: LIST });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['247Tailorsteel B.V.', '54U Media BV', 'AATEQ']);
    expect(result.exhibitors[0]).toEqual({
      id: '225152',
      name: '247Tailorsteel B.V.',
      logoUrl: 'https://my.easyfairs.com/backend/uploads/225152.png',
      booths: ['D24'],
      description: '247Tailorsteel B.V. teaser',
      profileUrl: 'https://www.metavak.nl/en/exhibitors/247tailorsteel-b-v-225152/',
      access: 'public',
    });
    expect(result).toMatchObject({ total: null, partial: false });
    expect(net.calls).toContain(easyfairsPageUrl(LIST, 3));
  });

  it('gives the co-located show its own exhibitors from the same list', async () => {
    const welding: EditionTarget = { name: 'WELDING WEEK NEDERLAND', startDate: '2026-10-06', city: 'Gorinchem', website: HOME };
    const result = await run(welding, network(routes()));
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', source: { editionLabel: 'Welding Week 2026' } });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['Binzel Benelux', '#Team Fronius']);
  });

  it('rejects a list of another edition', async () => {
    const old = { 'METAVAK 2024': 3 };
    const result = await run(METAVAK, network(routes({ [LIST]: { body: listPage(PAGES[0], { page: 0, nbPages: 1, events: old }) } })));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'easyfairs' && /2024 edition/.test(item.reason))).toBe(true);
  });

  it('keeps what it read and states the total when a page cannot be read', async () => {
    const result = await run(METAVAK, network(routes({ [easyfairsPageUrl(LIST, 3)]: new Error('fetch failed (ECONNRESET)') })));
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', total: 3 });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['247Tailorsteel B.V.', '54U Media BV']);
  });

  it('never reports a blocked or unreachable list as "no exhibitors"', async () => {
    const wall = { status: 403, body: '<html><head><title>Just a moment...</title></head></html>' };
    expect((await run(METAVAK, network(routes({ [LIST]: wall })))).status).toBe('DISCOVERY_INCOMPLETE');
    expect((await run(METAVAK, network(routes({ [LIST]: new Error('connect ETIMEDOUT') })))).status).toBe('DISCOVERY_INCOMPLETE');
    expect((await run(METAVAK, network({ [HOME]: new Error('connect ETIMEDOUT') }))).status).toBe('DISCOVERY_INCOMPLETE');
  });

  it('does not claim an empty list is this edition’s: with no exhibitors it names no show', async () => {
    const result = await run(METAVAK, network(routes({ [LIST]: { body: listPage([], { page: 0, nbPages: 0, events: {} }) } })));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.exhibitors).toEqual([]);
  });

  it('never gives the event a list that holds only a co-located show', async () => {
    const result = await run(METAVAK, network(routes({ [LIST]: { body: listPage([PAGES[0][0]], { page: 0, nbPages: 1, events: { 'Welding Week 2026': 1 } }) } })));
    expect(result.status).toBe('NO_VERIFIED_DIRECTORY');
    expect(result.rejected.some((item) => item.platform === 'easyfairs' && /different show/.test(item.reason))).toBe(true);
  });
});
