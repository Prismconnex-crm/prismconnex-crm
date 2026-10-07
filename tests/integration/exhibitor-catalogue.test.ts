import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { catalogueCardForDisplay, catalogueCards, catalogueEdition, catalogueSearchUrl, catalogueStand } from '@/lib/find-shows/exhibitor-adapters/brand-card-catalogue';
import { withCatalogueLinks } from '@/lib/find-shows/exhibitor-resolver';
import type { EditionTarget, ExhibitorDirectory, ExhibitorPlatform } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

type Answer = { status?: number; body: string; url?: string } | Error;

function network(routes: Record<string, Answer>) {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    const route = routes[url] ?? { status: 404, body: '' };
    if (route instanceof Error) throw route;
    const response: Fetched = { url: route.url ?? url, status: route.status ?? 200, contentType: 'text/html', headers: {}, body: Buffer.from(route.body), truncated: false };
    return response;
  };
  return { fetcher, calls };
}

const now = () => new Date('2026-09-30T12:00:00Z');
const run = (target: EditionTarget, net: ReturnType<typeof network>) => discoverExhibitors(target, { fetcher: net.fetcher, now, retryDelayMs: 0 });

/** A catalogue page as the software renders it: heading, search form, then one card per entry. */
function catalogue(heading: string, entries: [id: string, type: string, name: string, stand: string][]) {
  const cards = entries
    .map(([id, type, name, stand]) => `<div class="col-md-3 text-start"><div class="card scheda-blocco divOpenPopupBrand" id="divOpenPopupBrand_${id}" data-aziendaId="${id}" data-catalogoId="53381" data-brandType="${type}">
      <div class="card-header"><img src="/img/loghi/${id}.jpg" onerror="this.src='../img/loghi/logo_eicma_nero.svg';" class="img-fluid lazyload" alt="Logo"></div>
      <div class="card-body"><div class="row card-stand"><div class="col"><p class="text-lg-center padiglione mb-0">${name}</p></div></div>
      <div class="row rappresentanza-card"><div class="col"><h5 class="mt-lg-3 rappresentato">${stand}</h5><p class="mt-0 mb-0 brand">ITALY - IT</p></div></div></div></div></div>`)
    .join('');
  return `<html><head><title>Home</title></head><body><h2>${heading}</h2><form method="post" id="formRicerca"><input name="Nominativo"></form>
    <div class="bloc risultati-ricerca" id="bloc-10">${cards}</div><script src="/js/custom/brand.js"></script></body></html>`;
}

const ENTRIES: [string, string, string, string][] = [
  ['13253', '1', '3D BETA', 'Pad. 6 - Stand I39'],
  ['20791', '1', '79BIKE', 'Pad. 24,11 - Stand E66,O07'],
  ['12', '1', 'ABUS', 'Pad. 9 - Stand E81'],
  // Represented companies and brands (types 2 and 3) are not exhibitors.
  ['83315', '2', 'A-SIDER INNOVACION SOBRE DOS RUEDAS SL - FORBIKES SRL', 'Pad. 9 - Stand E53'],
  ['20286', '3', '"MASS" CUSTOM SUIT - S.S.BAJWA &amp; SONS', 'Pad. 18 - Stand D89'],
];

const EICMA: EditionTarget = { name: 'EICMA - ESPOSIZIONE INTERNAZIONALE DEL CICLO E MOTOCICLO', startDate: '2026-11-05', city: 'Milan', website: 'http://www.eicma.it/en' };

describe('brand-card exhibitor catalogues: pure rules', () => {
  it('reads the edition from the catalogue heading, in English or Italian', () => {
    expect(catalogueEdition(catalogue('eicma 2026 exhibitors', []))).toEqual({ label: 'eicma 2026', year: 2026 });
    expect(catalogueEdition(catalogue('Espositori Moto Expo 2027', []))).toEqual({ label: 'Moto Expo 2027', year: 2027 });
    expect(catalogueEdition('<h2>Our exhibitors</h2>')).toBeNull();
  });

  it('keeps direct exhibitors only, with stand and logo', () => {
    const cards = catalogueCards(catalogue('eicma 2026 exhibitors', ENTRIES), 'https://catalogo.eicma.it/Espositore');
    expect(cards.map((card) => card.name)).toEqual(['3D BETA', '79BIKE', 'ABUS']);
    expect(cards[1]).toEqual({
      id: '20791',
      name: '79BIKE',
      logoUrl: 'https://catalogo.eicma.it/img/loghi/20791.jpg',
      booths: ['E66, O07 · Halls 24, 11'],
      description: null,
      profileUrl: 'https://catalogo.eicma.it/Espositore?Nominativo=79BIKE',
      profileKind: 'catalogue-search',
      access: 'public',
    });
  });

  it('writes the stand line once, keeping every hall and stand', () => {
    expect(catalogueStand('Pad. 6 - Stand I39')).toBe('I39 · Hall 6');
    expect(catalogueStand('Pad. 14 - Stand E06,E12')).toBe('E06, E12 · Hall 14');
    // Halls and stands are not paired by the catalogue (2 halls, 3 stands), so they stay two lists.
    expect(catalogueStand('Pad. 5,14 - Stand A88,A80,A04')).toBe('A88, A80, A04 · Halls 5, 14');
    expect(catalogueStand('  Pad.  24,11 -  Stand  E66,O07 ')).toBe('E66, O07 · Halls 24, 11');
    expect(catalogueStand('Pad. - Stand')).toBeNull();
    expect(catalogueStand('Outdoor area')).toBe('Outdoor area');
  });

  it('links each card to the official catalogue filtered to that exhibitor, never as a profile page', () => {
    expect(catalogueSearchUrl('https://catalogo.eicma.it/Espositore?culture=en-US#top', 'PIAGGIO & C S.P.A.')).toBe(
      'https://catalogo.eicma.it/Espositore?Nominativo=PIAGGIO+%26+C+S.P.A.'
    );
    const cards = catalogueCards(catalogue('eicma 2026 exhibitors', ENTRIES), 'https://catalogo.eicma.it/Espositore');
    expect(cards.every((card) => card.profileKind === 'catalogue-search' && card.profileUrl !== 'https://catalogo.eicma.it/Espositore')).toBe(true);
  });

  it('shows lists stored before the same way, and leaves current cards unchanged', () => {
    const stored = { id: '20791', name: '79BIKE', logoUrl: null, booths: ['Pad. 24,11 - Stand E66,O07'], description: null, profileUrl: 'https://catalogo.eicma.it/Espositore', access: 'public' as const };
    const shown = catalogueCardForDisplay(stored, 'https://catalogo.eicma.it/Espositore');
    expect(shown).toMatchObject({ booths: ['E66, O07 · Halls 24, 11'], profileUrl: 'https://catalogo.eicma.it/Espositore?Nominativo=79BIKE', profileKind: 'catalogue-search' });
    expect(catalogueCardForDisplay(shown, 'https://catalogo.eicma.it/Espositore')).toEqual(shown);
    expect(catalogueCardForDisplay({ ...stored, booths: ['Pad. - Stand'] }, 'https://catalogo.eicma.it/Espositore').booths).toEqual([]);
  });
});

describe('brand-card exhibitor catalogues: shown from the store', () => {
  const directory = (platform: ExhibitorPlatform): ExhibitorDirectory => ({
    status: 'VERIFIED_LIST',
    reason: 'list',
    checkedAt: '2026-10-01T07:05:38Z',
    source: { platform, platformLabel: 'x', editionLabel: 'EICMA 2026', directoryUrl: 'https://catalogo.eicma.it/Espositore', loginUrl: null, foundOn: 'x' },
    exhibitors: [{ id: '1', name: '3D BETA', logoUrl: null, booths: ['Pad. 6 - Stand I39'], description: null, profileUrl: 'https://catalogo.eicma.it/Espositore', access: 'public' }],
    rejected: [],
  });

  it('rewrites only brand-card catalogue lists', () => {
    expect(withCatalogueLinks(directory('brand-card-catalogue')).exhibitors[0]).toMatchObject({
      booths: ['I39 · Hall 6'],
      profileUrl: 'https://catalogo.eicma.it/Espositore?Nominativo=3D+BETA',
      profileKind: 'catalogue-search',
    });
    const other = directory('organizer-directory');
    expect(withCatalogueLinks(other)).toBe(other);
  });
});

describe('brand-card exhibitor catalogues: discovery', () => {
  it('lists the edition’s exhibitors from the catalogue the official site links', async () => {
    const net = network({
      'http://www.eicma.it/en': { body: '<a href="https://catalogo.eicma.it/Espositore?culture=en-US">Exhibitor catalogue</a>' },
      'https://catalogo.eicma.it/Espositore': { body: catalogue('eicma 2026 exhibitors', ENTRIES) },
    });
    const result = await run(EICMA, net);
    expect(result.status).toBe('VERIFIED_LIST');
    expect(result.source).toMatchObject({ platform: 'brand-card-catalogue', editionLabel: 'EICMA 2026', directoryUrl: 'https://catalogo.eicma.it/Espositore' });
    expect(result.exhibitors.map((card) => card.name)).toEqual(['3D BETA', '79BIKE', 'ABUS']);
    expect(result).toMatchObject({ total: null, partial: false });
  });

  it('keeps published logos, and drops logo paths the catalogue does not serve yet', async () => {
    const withLogos = network({
      'http://www.eicma.it/en': { body: '<a href="https://catalogo.eicma.it/Espositore">Exhibitor catalogue</a>' },
      'https://catalogo.eicma.it/Espositore': { body: catalogue('eicma 2026 exhibitors', ENTRIES) },
      'https://catalogo.eicma.it/img/loghi/13253.jpg': { body: 'img' },
    });
    // The fake network answers text/html; mark the logo as an image.
    const imageFetcher: Fetcher = async (url, options) => {
      const answer = await withLogos.fetcher(url, options);
      return url.endsWith('13253.jpg') ? { ...answer, contentType: 'image/jpeg' } : answer;
    };
    const kept = await discoverExhibitors(EICMA, { fetcher: imageFetcher, now, retryDelayMs: 0 });
    expect(kept.exhibitors[0].logoUrl).toBe('https://catalogo.eicma.it/img/loghi/13253.jpg');

    const none = await run(EICMA, network({
      'http://www.eicma.it/en': { body: '<a href="https://catalogo.eicma.it/Espositore">Exhibitor catalogue</a>' },
      'https://catalogo.eicma.it/Espositore': { body: catalogue('eicma 2026 exhibitors', ENTRIES) },
    }));
    expect(none.exhibitors.every((card) => card.logoUrl === null)).toBe(true);
  });

  it('works for any show on the same catalogue software (not only EICMA)', async () => {
    const moto: EditionTarget = { name: 'MOTO EXPO VERONA', startDate: '2027-01-22', city: 'Verona', website: 'http://www.motoexpo.example' };
    const net = network({
      'http://www.motoexpo.example': { body: '<a href="/Espositore">Espositori</a>' },
      'http://www.motoexpo.example/Espositore': { body: catalogue('Espositori Moto Expo 2027', ENTRIES) },
    });
    const result = await run(moto, net);
    expect(result).toMatchObject({ status: 'VERIFIED_LIST', source: { platform: 'brand-card-catalogue', editionLabel: 'MOTO EXPO 2027' } });
    expect(result.exhibitors).toHaveLength(3);
  });

  it('rejects another year’s catalogue', async () => {
    const net = network({
      'http://www.eicma.it/en': { body: '<a href="https://catalogo.eicma.it/Espositore">Exhibitor catalogue</a>' },
      'https://catalogo.eicma.it/Espositore': { body: catalogue('eicma 2025 exhibitors', ENTRIES) },
    });
    const result = await run(EICMA, net);
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(result.rejected.some((item) => item.platform === 'brand-card-catalogue' && /2025 edition/.test(item.reason))).toBe(true);
  });

  it('rejects a co-located or different show’s catalogue', async () => {
    const net = network({
      'http://www.eicma.it/en': { body: '<a href="https://catalogo.eicma.it/Espositore">Exhibitor catalogue</a>' },
      'https://catalogo.eicma.it/Espositore': { body: catalogue('Milano Bike City 2026 exhibitors', ENTRIES) },
    });
    const result = await run(EICMA, net);
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(result.rejected.some((item) => item.platform === 'brand-card-catalogue' && /different show/.test(item.reason))).toBe(true);
  });

  it('keeps a temporary failure apart from "no exhibitors"', async () => {
    const net = network({
      'http://www.eicma.it/en': { body: '<a href="https://catalogo.eicma.it/Espositore">Exhibitor catalogue</a>' },
      'https://catalogo.eicma.it/Espositore': new Error('fetch failed (ECONNRESET)'),
    });
    expect((await run(EICMA, net)).status).toBe('DISCOVERY_INCOMPLETE');
  });
});
