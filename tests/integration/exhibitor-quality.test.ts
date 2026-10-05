import { describe, expect, it } from 'vitest';
import { cleanCards, decodeEntities, markSharedProfileLinks, officialProfileLink, type EditionTarget, type ExhibitorCard, type ExhibitorDirectory } from '@/lib/find-shows/exhibitors';
import { extractDirectoryPage, judgeOrganizerPage, notExhibitorLinks, notListPage } from '@/lib/find-shows/exhibitor-adapters/organizer-directory';
import { rxEditionName } from '@/lib/find-shows/exhibitor-adapters/established';
import { siteKey } from '@/lib/find-shows/floor-plan';
import { mergeAttempt, withCleanCards } from '@/lib/find-shows/exhibitor-resolver';

// What the final audit of the stored lists found, kept from coming back.

const card = (name: string, extra: Partial<ExhibitorCard> = {}): ExhibitorCard => ({
  id: name,
  name,
  logoUrl: null,
  booths: [],
  description: null,
  profileUrl: `https://show.example/exhibitors/${encodeURIComponent(name.toLowerCase())}`,
  access: 'public',
  ...extra,
});

const target = (name: string, startDate: string, website = 'http://www.show.example'): EditionTarget => ({ name, startDate, city: 'London', website });

describe('organizer lists: a past edition’s list is not this edition’s', () => {
  it('rejects "Past Exhibitors" and a list headed with an earlier year', () => {
    expect(judgeOrganizerPage(target('ARABLAB EXPO', '2026-10-26'), 'ARABLAB LIVE 2026 - Past Exhibitors | /sponsors-and-exhibitors.stm', '2026').ok).toBe(false);
    expect(judgeOrganizerPage(target('HR TECHNOLOGIES UK', '2027-05-05'), 'Our 2026 Exhibitors - HR Technologies UK 2027 | /visiting/our-exhibitors', '2027').reason).toContain('2026’s exhibitors');
    expect(judgeOrganizerPage(target('EU BC&E', '2027-05-25'), 'List of exhibitors 2026 – EUBCE 2027 | /list-of-exhibitors-2026/', '2027').ok).toBe(false);
  });

  it('trusts the headline over a reused address', () => {
    // "/exhibitor-list-2025" serving the 2026 list; Zoomark's 2027 catalogue under a 2025 path.
    expect(judgeOrganizerPage(target('FARM BUSINESS INNOVATION', '2026-11-04'), 'Exhibitor List - Farm Business Innovation 2026 | /exhibitor-list-2025', '2026').ok).toBe(true);
    expect(judgeOrganizerPage(target('ZOOMARK', '2027-05-11'), 'DIRECTORY 2027 | 2027 exhibitors catalogue | /2025-exhibitors-catalogue/2027-exhibitors-catalogue/', '2027').ok).toBe(true);
  });
});

describe('organizer lists: pages and links that are not an exhibitor directory', () => {
  it('rejects a home page and a news article as the list page', () => {
    expect(notListPage('https://www.ibexindia.com/')).toContain('home page');
    expect(notListPage('https://www.show.example/en')).toContain('home page');
    expect(notListPage('https://cremonamusica.com/fiera-della-musica-cremona-musica-expo-festival-2026-da-venerdi-2-ottobre/')).toContain('article');
    expect(notListPage('https://www.show.example/en/exhibitor-list/')).toBeNull();
  });

  it('rejects the site’s own pages, in any language or spelling', () => {
    const imdex = ['Book A Booth', 'Disclaimer', 'Privacy Policy', 'Media', 'Acme Ltd', 'Beta GmbH'].map((name) => card(name, { profileUrl: `https://www.imdexasia.com/${name.toLowerCase().replace(/ /g, '-')}` }));
    expect(notExhibitorLinks(imdex)).toContain('site\'s own pages');
    const wdie = ['ServiceTraffic', 'About', 'MediaCoverage', 'News', 'ServiceHotel', 'DataDownload'].map((page, index) => card(`菜单${index}`, { profileUrl: `http://www.wide.org.cn/${page}.html` }));
    expect(notExhibitorLinks(wdie)).not.toBeNull();
  });

  it('rejects category, letter and pager links', () => {
    const categories = ['Art & Ceramics', 'Beauty', 'Candles'].map((name) => card(name, { profileUrl: `https://www.goodhousekeepinglive.co.uk/exhibitor-list?cat=${encodeURIComponent(name)}` }));
    expect(notExhibitorLinks(categories)).toContain('categories');
    const pager = [
      card('0 - 9', { profileUrl: 'https://www.techshowmadrid.es/expositores?azletter=0-9' }),
      card('Next Page', { profileUrl: 'https://www.techshowmadrid.es/expositores?page=2' }),
      card('Regístrate Ya', { profileUrl: 'https://www.techshowmadrid.es/registro' }),
      card('E-Show', { profileUrl: 'https://www.techshowmadrid.es/e-show' }),
    ];
    expect(notExhibitorLinks(pager)).not.toBeNull();
  });

  it('rejects a page for booking a stand, and partner or speaker links', () => {
    expect(notListPage('https://fanexpohq.com/megaconorlando/become-an-exhibitor/')).toContain('booking a stand');
    expect(notListPage('https://www.show.example/de/aussteller-werden')).toContain('booking a stand');
    const partners = ['Cintriq', 'Fosway', 'HR Magazine'].map((name) => card(name, { profileUrl: `https://www.hrtechnologies.co.uk/exhibitors/partners/${name.toLowerCase()}` }));
    expect(notExhibitorLinks(partners)).toContain('partners');
  });

  it('accepts a real list, even with a stray footer link', () => {
    const list = ['Acme', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'].map((name) => card(name));
    expect(notExhibitorLinks([...list, card('Cookie Policy', { profileUrl: 'https://show.example/cookie-policy' })])).toBeNull();
  });
});

describe('organizer lists: another show’s site', () => {
  it('rejects a list on another organizer’s site that does not name this show', () => {
    const eat = target('EAT & DRINK FESTIVAL - LONDON', '2027-04-02', 'http://www.eatanddrinklondon.com');
    const verdict = judgeOrganizerPage(eat, 'Exhibitors - Ideal Home Show 2027 | /exhibitors', '2027', 'www.idealhomeshow.co.uk');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('idealhomeshow.co.uk');
  });

  it('accepts the show’s other domain when it names the show, by name or initials', () => {
    const pmw = target('PROFESSIONAL MOTORSPORT WORLD EXPO', '2026-11-10', 'http://www.professionalmotorsport-expo.com');
    expect(judgeOrganizerPage(pmw, 'Exhibitor List 2026 | /exhibitor-list', '2026', 'www.pmw-expo.com').ok).toBe(true);
    const bondexpo = target('BONDEXPO', '2026-10-06', 'http://www.bondexpo-messe.com');
    expect(judgeOrganizerPage(bondexpo, 'Ausstellerliste 2026 | /ausstellerliste', '2026', 'www.bondexpo-messe.de').ok).toBe(true);
  });
});

describe('organizer lists: a card’s name is the element that names it', () => {
  const page = (cards: string) => `<html><body><main><h1>Exhibitors 2026</h1>${cards}</main></body></html>`;
  const many = (make: (index: number) => string) => Array.from({ length: 16 }, (_, index) => make(index)).join('');
  const names = (html: string, url: string) => extractDirectoryPage(html, url, siteKey(url))!.cards.map((item) => ({ name: item.name, booths: item.booths, description: item.description }));

  it('takes the brand, not the email, address and categories the card link also holds (Casalia)', () => {
    const html = page(many((i) => `<a href="/brand-${i}" class="cs-expo-card" data-brand="BRAND ${i}"><img alt="BRAND ${i}" src="/l${i}.png"><span class="cs-expo-card__stand"> Pad.&nbsp;Oval &nbsp;0${i} </span><div class="cs-expo-card__body"><div class="cs-expo-card__brand">BRAND ${i}</div><div class="cs-expo-card__ragione">owner${i}@gmail.com</div><span class="cs-expo-card__loc">Strada Nino Bixio 60, 43125 Parma</span><span class="cs-expo-card__merc-tag">Complementi d'arredo</span></div></a>`));
    expect(names(html, 'https://casaliatorino.it/catalogo-espositori')[0]).toEqual({ name: 'BRAND 0', booths: ['Pad. Oval 00'], description: null });
  });

  it('takes the title, not title and categories (Grand Pavois), and the heading inside a dated title block (Hampton Court)', () => {
    const pavois = page(`<ul>${many((i) => `<a href="https://grand-pavois.com/yard-${i}/"><li class="exposant"><div class="titre">YARD ${i}</div><div class="rubriques"><ul><li>Sailing boats</li></ul></div></li></a>`)}</ul>`);
    expect(names(pavois, 'https://grand-pavois.com/en/visit/exhibitors/')[0].name).toBe('YARD 0');
    const hampton = page(many((i) => `<div class="exhibitor_listing"><div class="exhibitor_listing_title"><h3><a href="https://www.hrpfestivals.com/festive-fayre/exhibitors-producers/detail/maker-${i}">Maker ${i}</a></h3> 4 - 6 December 2026 11 - 13 December 2026<br></div></div>`));
    expect(names(hampton, 'https://www.hrpfestivals.com/festive-fayre/exhibitors-producers')[0]).toEqual({ name: 'Maker 0', booths: [], description: null });
  });

  it('keeps hall and stand together (Mieux Vivre)', () => {
    const html = page(many((i) => `<a class="ListExposants-link" href="https://www.mieux-vivre-expo.com/exposant/maison-${i}/"><ul><li class="ListExposants-enseigne">MAISON ${i}</li><li class="ListExposants-secteur">Services</li><li class="ListExposants-hall">HALL A</li><li class="ListExposants-stand">Stand : ART1${i}</li></ul></a>`));
    expect(names(html, 'https://www.mieux-vivre-expo.com/liste-des-exposants/')[0]).toEqual({ name: 'MAISON 0', booths: ['HALL A / ART10'], description: null });
  });
});

describe('exhibitor details: the one way out to the official site', () => {
  const official = { platformLabel: 'Official exhibitor list' };
  const mys = { platformLabel: 'Map Your Show' };

  it('opens the verified official profile, unchanged, for a card from any platform', () => {
    const profile = 'https://aapex2026.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=26731';
    expect(officialProfileLink({ profileUrl: profile, access: 'public' }, mys)).toEqual({ href: profile, label: 'Open official profile', note: null });
  });

  it('says when the official site has no page per exhibitor, or keeps it behind its own sign-in', () => {
    const catalogue = officialProfileLink({ profileUrl: 'https://catalogo.eicma.it/Espositore?Nominativo=79BIKE', profileKind: 'catalogue-search', access: 'public' }, official);
    expect(catalogue).toMatchObject({ href: 'https://catalogo.eicma.it/Espositore?Nominativo=79BIKE', label: 'Find on official catalogue' });
    expect(catalogue.note).toContain('the official event website');
    const login = officialProfileLink({ profileUrl: 'https://rx.example/exhibitor-details.123.html', access: 'login-required' }, { platformLabel: 'Official exhibitor directory' });
    expect(login).toMatchObject({ label: 'Open official profile', href: 'https://rx.example/exhibitor-details.123.html' });
    expect(login.note).toContain('sign in');
  });
});

describe('RX: an edition still named by an earlier date', () => {
  it('is shown by the year its dates give', () => {
    expect(rxEditionName('FIBO - 16/04/2026', 2027)).toBe('FIBO 2027');
    expect(rxEditionName('Show 2026', 2027)).toBe('Show 2027');
    expect(rxEditionName('FIBO 2027', 2027)).toBe('FIBO 2027');
    expect(rxEditionName('Lifestyle Week Tokyo [Autumn]', 2026)).toBe('Lifestyle Week Tokyo [Autumn]');
  });
});

describe('stored lists: a list that was never this edition’s is taken back', () => {
  const edition = { key: 'k', edition: { name: 'ARABLAB EXPO', startDate: '2026-10-26', city: 'Dubai', website: 'w', slugs: ['x'] } };
  const list: ExhibitorDirectory = {
    status: 'VERIFIED_LIST',
    reason: 'list',
    checkedAt: '2026-10-01T00:00:00Z',
    source: { platform: 'organizer-directory', platformLabel: 'Official exhibitor list', editionLabel: 'ARABLAB LIVE 2026 - Past Exhibitors', directoryUrl: 'u', loginUrl: null, foundOn: 'u' },
    exhibitors: [card('Acme')],
    rejected: [],
  };
  const attempt = (reason: string): ExhibitorDirectory => ({
    status: 'NO_VERIFIED_DIRECTORY',
    reason,
    checkedAt: '2026-10-05T00:00:00Z',
    source: null,
    exhibitors: [],
    rejected: [{ platform: 'organizer-directory', label: 'ARABLAB LIVE 2026 - Past Exhibitors', url: 'u', reason }],
  });

  it('drops it on a "not this edition’s list" verdict, keeps it on a page that moved on', () => {
    const stored = mergeAttempt(null, edition, list);
    const past = judgeOrganizerPage(target('ARABLAB EXPO', '2026-10-26'), 'ARABLAB LIVE 2026 - Past Exhibitors | /x', '2026').reason;
    expect(mergeAttempt(stored, edition, attempt(past)).verified).toBeNull();
    expect(mergeAttempt(stored, edition, attempt('the page announces the edition of 2027-10-13, not 2026-10-26')).verified).not.toBeNull();
  });
});

describe('cards as shown', () => {
  it('decodes HTML entities, case-sensitively', () => {
    expect(decodeEntities('&Auml;tztechnik Herz · M&uuml;ller · Benecol&reg; · AGENCE DE L&rsquo;ENERGIE · Biotech&#160;Co')).toBe('Ätztechnik Herz · Müller · Benecol® · AGENCE DE L’ENERGIE · Biotech Co');
    // A shown name collapses that no-break space like any other.
    expect(cleanCards([card('Biotech&#160;Co')])[0].name).toBe('Biotech Co');
  });

  it('leaves out placeholder and menu cards, and shows the same entry once', () => {
    const cards = cleanCards([card('Acme'), card('TEST'), card('Next Page'), card('Stand Booking 6257735001457197356'), card('Acme', { id: 'acme-2' }), card('Exhibitor')]);
    expect(cards.map((item) => item.name)).toEqual(['Acme']);
  });

  it('keeps one company’s separate official entries: their own profiles, or other stands', () => {
    const rx = cleanCards([
      card('Avalon Waterways', { id: 'org-1', booths: ['H41'], profileUrl: 'https://iltm.example/org-1.html' }),
      card('Avalon Waterways', { id: 'org-2', booths: ['H41'], profileUrl: 'https://iltm.example/org-2.html' }),
      card('Caterpillar Inc.', { id: 'c1', booths: ['3084'] }),
      card('Caterpillar Inc.', { id: 'c2', booths: ['11039'] }),
    ]);
    expect(rx).toHaveLength(4);
  });

  it('shows a postal address or a run of dates as no description', () => {
    const [address, dates, real] = cleanCards([
      card('Andrea Raimondi Group', { description: 'Via Leopardi 9/A, 24066 Pedrengo, (Bergamo)' }),
      card('Historically Candles', { description: '4 - 6 December 2026 11 - 13 December 2026 Historically Candles' }),
      card('Zeta Spa', { description: 'Via del Mare is our flagship collection of outdoor furniture.' }),
    ]);
    expect(address.description).toBeNull();
    expect(dates.description).toBeNull();
    expect(real.description).toBe('Via del Mare is our flagship collection of outdoor furniture.');
  });

  it('never shows contact details, and keeps every other word of the directory', () => {
    const [shown] = cleanCards([
      card('MORENO PISAPIA moreno.pisapia@gmail.com', { description: 'Call +44(0)1202 662 180 or 800-860-2872, mail sales@aurand.net. ISO 9001 14001 certified since 1998 2005.' }),
    ]);
    expect(shown.name).toBe('MORENO PISAPIA');
    expect(shown.description).toBe('Call or, mail. ISO 9001 14001 certified since 1998 2005.');
  });

  it('drops placeholder booths and splits stands joined into one line', () => {
    const [messe, spiel] = cleanCards([card('Messe Düsseldorf GmbH', { booths: ['Unsettled / NN'] }), card('Spiel Co', { booths: ['Hall 6|Hall 4 / 6E110|4D400'] })]);
    expect(messe.booths).toEqual([]);
    expect(spiel.booths).toEqual(['Hall 6 / 6E110', 'Hall 4 / 4D400']);
  });

  it('files a decoded name where it belongs in A–Z', () => {
    expect(cleanCards([card('Beta'), card('&Auml;tztechnik')]).map((item) => item.name)).toEqual(['Ätztechnik', 'Beta']);
  });

  it('marks cards that all open one list page as "find on official catalogue"', () => {
    const list = 'https://kioge.kz/en/exhibition/exhibitors-list/2026';
    const marked = markSharedProfileLinks([card('Acme', { profileUrl: list }), card('Beta', { profileUrl: list }), card('Gamma', { profileUrl: list })]);
    expect(marked.every((item) => item.profileKind === 'catalogue-search')).toBe(true);
    const profiles = markSharedProfileLinks([card('Acme'), card('Beta'), card('Gamma')]);
    expect(profiles.some((item) => item.profileKind)).toBe(false);
  });

  it('leaves an empty or failed answer untouched', () => {
    const empty: ExhibitorDirectory = { status: 'NO_VERIFIED_DIRECTORY', reason: 'r', checkedAt: 'c', source: null, exhibitors: [], rejected: [] };
    expect(withCleanCards(empty)).toBe(empty);
  });
});
