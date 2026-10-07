import { describe, expect, it } from 'vitest';
import { judgeEdition, judgeOwnName, placeQualifiers, regionalEditionMismatch, sameShow, type EditionTarget, type ExhibitorDirectory } from '@/lib/find-shows/exhibitors';
import { judgeOrganizerPage } from '@/lib/find-shows/exhibitor-adapters/organizer-directory';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { effectiveDirectory, mergeAttempt } from '@/lib/find-shows/exhibitor-resolver';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

// Regional editions of one show, and other shows sharing a name: a directory must be this edition's.

const IAAPA_EUROPE: EditionTarget = { name: 'IAAPA EXPO EUROPE', startDate: '2026-09-21', city: 'London', website: 'http://www.iaapa.org/expos/euro-attractions-show/home' };
const IAAPA_ORLANDO: EditionTarget = { name: 'IAAPA ATTRACTIONS EXPO', startDate: '2026-11-16', city: 'Orlando, FL', website: 'http://www.iaapa.org/expos/iaapa-expo' };

describe('regional editions: edition rule', () => {
  it('does not give IAAPA Expo Europe the Orlando IAAPA Expo’s list', () => {
    const verdict = judgeEdition(IAAPA_EUROPE, { label: 'IAAPA Expo 2026', year: 2026 });
    expect(verdict).toEqual({ ok: false, reason: '"IAAPA Expo 2026" does not name europe — it may be another edition of the show' });
    // The Orlando show is the one that list belongs to.
    expect(judgeEdition(IAAPA_ORLANDO, { label: 'IAAPA Expo 2026', year: 2026 }).ok).toBe(true);
    // Another region's edition stays rejected too.
    expect(judgeEdition(IAAPA_EUROPE, { label: 'IAAPA Expo Asia 2026', year: 2026 }).ok).toBe(false);
  });

  it('does not give a country edition on its organizer’s site the flagship’s list', () => {
    const china: EditionTarget = { name: 'BAUMA CHINA', startDate: '2026-11-24', city: 'Shanghai', website: 'http://www.messe-muenchen.de/en/bauma-china' };
    expect(judgeEdition(china, { label: 'bauma 2026', year: 2026 })).toEqual({ ok: false, reason: '"bauma 2026" does not name china — it may be another edition of the show' });
  });

  it('accepts a regional edition that names its city instead of its region', () => {
    const cphi: EditionTarget = { name: 'CPHI EUROPE', startDate: '2026-10-06', city: 'Milan', website: 'http://www.cphi.com/europe' };
    expect(judgeEdition(cphi, { label: 'CPHI Milan 2026', year: 2026 }).ok).toBe(true);
  });

  it('accepts a place written inside a word, or a label naming a place of its own', () => {
    const asia: EditionTarget = { name: 'ELECTRONIC ASIA', startDate: '2026-10-13', city: 'Hong Kong', website: 'http://www.hktdc.com/fair/electronicasia-en' };
    expect(regionalEditionMismatch(asia, 'electronicAsia 2026')).toEqual([]);
    const blech: EditionTarget = { name: 'EURO-BLECH', startDate: '2026-10-20', city: 'Hannover', website: 'http://www.euroblech.com' };
    expect(regionalEditionMismatch(blech, 'EuroBLECH')).toEqual([]);
    const big5: EditionTarget = { name: 'THE BIG 5 CONSTRUCT EAST AFRICA', startDate: '2026-11-04', city: 'Nairobi', website: 'http://www.big5constructkenya.com' };
    expect(regionalEditionMismatch(big5, 'The Big 5 Construct Kenya 2026')).toEqual([]);
  });

  it('accepts a label that names no show: the official site’s own exhibitor page', () => {
    const cloud: EditionTarget = { name: 'CLOUD EXPO ASIA - SINGAPORE', startDate: '2026-09-29', city: 'Singapore', website: 'http://www.cloudexpoasia.com' };
    expect(regionalEditionMismatch(cloud, 'Exhibitor List 2026')).toEqual([]);
  });

  it('lets a domain of the show’s own vouch for its brand, but never a section of a shared host', () => {
    const stoc: EditionTarget = { name: 'STOCEXPO EUROPE', startDate: '2027-03-23', city: 'Rotterdam', website: 'http://www.stocexpo.com' };
    expect(judgeEdition(stoc, { label: 'StocExpo 2027', year: 2027 }).ok).toBe(true);
    const ise: EditionTarget = { name: 'ISE (INTEGRATED SYSTEMS EUROPE)', startDate: '2027-02-02', city: 'Barcelona', website: 'http://www.iseurope.org' };
    expect(judgeEdition(ise, { label: 'ISE 2027', year: 2027 }).ok).toBe(true);
    // A language or home segment is still the show's own domain; a path naming a section is a shared host.
    const concrete: EditionTarget = { name: 'CONCRETE SHOW SOUTH AMERICA', startDate: '2026-08-12', city: 'São Paulo', website: 'http://www.concreteshow.com.br/en/home.html' };
    expect(regionalEditionMismatch(concrete, 'Concrete Show 2026')).toEqual([]);
    expect(regionalEditionMismatch(IAAPA_EUROPE, 'IAAPA Expo 2026')).toEqual(['europe']);
  });

  it('leaves editions identified by their dates or location to those', () => {
    // A platform stating the edition's own dates has identified it, whatever its name leaves out.
    expect(judgeEdition(IAAPA_EUROPE, { label: 'IAAPA Expo 2026', year: 2026, startDate: '2026-09-21' }).ok).toBe(true);
    // …and the Orlando dates are still rejected by the date rule.
    expect(judgeEdition(IAAPA_EUROPE, { label: 'IAAPA Expo 2026', year: 2026, startDate: '2026-11-17' }).ok).toBe(false);
    const caravans: EditionTarget = { name: 'CARAVANS SALON POLAND', startDate: '2026-10-15', city: 'Poznan', website: 'http://www.caravans-salon.pl' };
    expect(judgeOwnName(caravans, { label: 'Caravans Salon 2026', year: 2026, startDate: '2026-10-15' }).ok).toBe(true);
  });

  it('reads places as whole words', () => {
    expect(placeQualifiers('IAAPA EXPO EUROPE')).toEqual(['europe']);
    expect(placeQualifiers('CPHI MIDDLE EAST')).toEqual(['middle east']);
    expect(placeQualifiers('INDIANA BUILDING SHOW')).toEqual([]);
    expect(placeQualifiers('WOMAN EXPO')).toEqual([]);
  });
});

// --- Discovery and the store ------------------------------------------------------------

function fakeFetcher(routes: Record<string, string>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    const body = routes[url];
    const response: Fetched = { url, status: body === undefined ? 404 : 200, contentType: 'text/html', headers: {}, body: Buffer.from(body ?? ''), truncated: false };
    return response;
  }) as unknown as Fetcher & { calls: string[] };
  fetcher.calls = calls;
  return fetcher;
}

describe('regional editions: discovery', () => {
  it('rejects the flagship’s Map Your Show directory linked from a regional edition’s page, without reading its exhibitors', async () => {
    const fetcher = fakeFetcher({
      'http://www.iaapa.org/expos/euro-attractions-show/home': '<a href="https://iaapaexpo26.mapyourshow.com/8_0/">Exhibitor list</a>',
      'https://iaapaexpo26.mapyourshow.com/8_0/explore/exhibitor-alphalist.cfm': '<title>IAAPA Expo 2026 | Search for All Exhibitors</title><script>showid = "IAAPA2026";</script>',
    });
    const result = await discoverExhibitors(IAAPA_EUROPE, { fetcher, now: () => new Date('2026-09-01T12:00:00Z'), retryDelayMs: 0 });
    expect(result.status).not.toBe('VERIFIED_LIST');
    expect(result.exhibitors).toEqual([]);
    expect(result.rejected).toContainEqual(expect.objectContaining({ platform: 'map-your-show', label: 'IAAPA Expo 2026', reason: expect.stringContaining('does not name europe') }));
    expect(fetcher.calls.some((url) => url.includes('remote-proxy'))).toBe(false);
  });
});

describe('regional editions: stored lists', () => {
  const edition = { key: 'k', edition: { name: 'IAAPA EXPO EUROPE', startDate: '2026-09-21', city: 'London', website: 'w', slugs: ['x'] } };
  const orlandoList: ExhibitorDirectory = {
    status: 'VERIFIED_LIST',
    reason: '1391 exhibitors',
    checkedAt: '2026-10-01T06:22:02Z',
    source: { platform: 'map-your-show', platformLabel: 'Map Your Show', editionLabel: 'IAAPA Expo 2026', directoryUrl: 'https://iaapaexpo26.mapyourshow.com/8_0/explore/exhibitor-gallery.cfm?featured=false', loginUrl: null, foundOn: 'x' },
    exhibitors: [{ id: '1', name: 'Orlando Co', logoUrl: null, booths: [], description: null, profileUrl: 'p', access: 'public' }],
    rejected: [],
  };
  const attempt = (rejected: ExhibitorDirectory['rejected'], status: ExhibitorDirectory['status'] = 'NO_VERIFIED_DIRECTORY'): ExhibitorDirectory => ({
    status,
    reason: status,
    checkedAt: '2026-10-05T12:00:00Z',
    source: null,
    exhibitors: [],
    rejected,
  });
  const stored = mergeAttempt(null, edition, orlandoList);

  it('drops a stored list once a search rejects that same directory as another edition', () => {
    const verdict = { platform: 'map-your-show' as const, label: 'IAAPA Expo 2026', url: 'u', reason: '"IAAPA Expo 2026" does not name europe — it may be another edition of the show' };
    const record = mergeAttempt(stored, edition, attempt([verdict]));
    expect(record.verified).toBeNull();
    expect(effectiveDirectory(record).status).toBe('NO_VERIFIED_DIRECTORY');
  });

  it('keeps it when a search fails, finds nothing, or rejects some other directory', () => {
    expect(mergeAttempt(stored, edition, attempt([], 'DISCOVERY_INCOMPLETE')).verified).not.toBeNull();
    expect(mergeAttempt(stored, edition, attempt([])).verified).not.toBeNull();
    const other = { platform: 'map-your-show' as const, label: 'IAAPA Expo Asia 2027', url: 'u', reason: 'names a different show' };
    expect(mergeAttempt(stored, edition, attempt([other])).verified).not.toBeNull();
  });

  it('keeps it when the same page has moved on to next year: still that edition’s list', () => {
    const rolledOver = { platform: 'map-your-show' as const, label: 'IAAPA Expo 2026', url: 'u', reason: 'the page announces the edition of 2027-09-28, not 2026-09-21' };
    expect(mergeAttempt(stored, edition, attempt([rolledOver])).verified).not.toBeNull();
  });
});

// --- Touring shows: one show in several cities on one organizer site ------------------------------

const tour = (name: string, city: string, startDate: string, touringEditions: EditionTarget['touringEditions']): EditionTarget => ({
  name,
  city,
  startDate,
  website: 'http://www.organizer.example',
  otherCities: touringEditions!.map((edition) => edition.city),
  touringEditions,
});

describe('touring shows: which records are one show', () => {
  it('pairs a show’s stops, not an organizer’s different shows', () => {
    expect(sameShow({ name: 'ESOTIKA PET SHOW - AREZZO', city: 'Arezzo' }, { name: 'ESOTIKA PET SHOW - BUSTIO ARIZO', city: 'Busto Arsizio' })).toBe(true);
    expect(sameShow({ name: 'BABY & MATERNITY EXPO NASHVILLE', city: 'Franklin, TN' }, { name: 'BABY & MATERNITY EXPO ATLANTA', city: 'Duluth, GA' })).toBe(true);
    expect(sameShow({ name: 'PRINT 2 PACK - EGYPT', city: 'Cairo' }, { name: 'PRINT 2 PACK - SAUDI ARABIA', city: 'Jeddah' })).toBe(true);
    expect(sameShow({ name: 'WHITE LABEL WORLD EXPO - UK', city: 'London' }, { name: 'WHITE LABEL EXPO WORLD EXPO - USA - LAS VEGAS', city: 'Las Vegas, NV' })).toBe(true);
    expect(sameShow({ name: 'HIGHWAYS UK', city: 'Birmingham' }, { name: 'IDENTITY WEEK - NETHERLANDS', city: 'Amsterdam' })).toBe(false);
  });
});

describe('touring shows: an organizer’s list page', () => {
  const esotika = tour('ESOTIKA PET SHOW - AREZZO', 'Arezzo', '2026-09-12', [
    { city: 'Perugia', startDate: '2026-10-24' },
    { city: 'Vicenza', startDate: '2026-11-01' },
  ]);

  it('rejects one list shared by every stop: it names no stop and no dates', () => {
    const verdict = judgeOrganizerPage(esotika, 'Espositori 2026 | Espositori | /espositori/', 'Espositori 2026. Acquario Rossi, Zoo Bianchi…', 'www.esotikapetshow.it');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('it may be another edition of the show');
  });

  it('accepts the stop’s own page: city in the headline, address or host', () => {
    expect(judgeOrganizerPage(esotika, 'Espositori Arezzo 2026 | /espositori/', 'Espositori 2026', 'www.esotikapetshow.it').ok).toBe(true);
    expect(judgeOrganizerPage(esotika, 'Exhibitors 2026 | /arezzo/espositori/', 'Exhibitors 2026', 'www.esotikapetshow.it').ok).toBe(true);
    expect(judgeOrganizerPage(esotika, 'Exhibitors 2026 | /exhibitors/', 'Exhibitors 2026', 'arezzo.esotikapetshow.it').ok).toBe(true);
  });

  it('accepts a list announcing this stop’s dates, with a "next show" mention of one other stop', () => {
    const text = 'Exhibitors. 12-13 September 2026, Arezzo Fiere. Next show: 24-25 October 2026.';
    expect(judgeOrganizerPage(esotika, 'Exhibitors 2026 | /exhibitors/', text, 'www.esotikapetshow.it').ok).toBe(true);
  });

  it('rejects another stop’s list, and a tour calendar', () => {
    const perugia = 'Exhibitors. 24-25 October 2026. Book your stand.';
    expect(judgeOrganizerPage({ ...esotika, startDate: '2026-10-20' }, 'Exhibitors 2026 | /exhibitors/', perugia, 'www.esotikapetshow.it').reason).toContain('Perugia');
    const calendar = 'Our shows: 12-13 September 2026 · 24-25 October 2026 · 1-2 November 2026.';
    const verdict = judgeOrganizerPage(esotika, 'Exhibitors 2026 | /exhibitors/', calendar, 'www.esotikapetshow.it');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('several stops');
  });

  it('names a stop by the country or region in the show’s name too', () => {
    const print = tour('PRINT 2 PACK - EGYPT', 'Cairo', '2026-09-15', [{ city: 'Jeddah', startDate: '2026-11-16' }]);
    expect(judgeOrganizerPage(print, 'Exhibitor list 2026 | /exhibitor-list/', 'Exhibitors 2026', 'print2packexpo.com').ok).toBe(false);
    expect(judgeOrganizerPage(print, 'Exhibitor list 2026 | /egypt/exhibitor-list/', 'Exhibitors 2026', 'print2packexpo.com').ok).toBe(true);
  });

  it('leaves shows that do not tour to the usual rules', () => {
    const single: EditionTarget = { name: 'ESOTIKA PET SHOW', city: 'Arezzo', startDate: '2026-09-12', website: 'http://www.esotikapetshow.it' };
    expect(judgeOrganizerPage(single, 'Espositori 2026 | /espositori/', 'Espositori 2026', 'www.esotikapetshow.it').ok).toBe(true);
  });
});
