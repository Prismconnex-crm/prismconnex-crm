import { deflateSync } from 'zlib';
import { describe, expect, it } from 'vitest';
import {
  carriesBrand,
  saysPlanComingSoon,
  decorationFile,
  looksLikePhoto,
  editionDates,
  imageSize,
  originalImageUrl,
  photoFileName,
  unlikelyPlanImage,
  urlWords,
  editionProfile,
  extractLinks,
  floorPlanKind,
  isGenericLinkText,
  judgeCandidate,
  namesEditionDates,
  namesFloorPlan,
  namesNotPlan,
  pageHeadline,
  pdfMetadata,
  pdfText,
  sameLocationForYear,
  siteKey,
  sitemapLocations,
  websiteDomain,
  type CandidateEvidence,
  type FloorPlanEvent,
} from '../../lib/find-shows/floor-plan';
import { BUTTON_IMAGE, discoverFloorPlan, NetworkError, sectionOf, type Fetched, type Fetcher } from '../../lib/find-shows/floor-plan-discovery';

// Editions of an organizer running shows in several cities from one site.
const melbourne2026: FloorPlanEvent = {
  name: 'Franchising Expo',
  city: 'Melbourne',
  startDate: '2026-08-01',
  venue: 'Melbourne Convention and Exhibition Centre',
  otherCities: ['Sydney', 'Brisbane'],
};
const melbourne2027: FloorPlanEvent = { ...melbourne2026, startDate: '2027-08-07' };
const sydney2026: FloorPlanEvent = { ...melbourne2026, city: 'Sydney', startDate: '2026-05-01', venue: 'ICC Sydney', otherCities: ['Melbourne', 'Brisbane'] };
// A show with its own site: its name identifies it.
const heim2026: FloorPlanEvent = { name: 'HEIM+HANDWERK', city: 'Munich', startDate: '2026-11-25', venue: 'Messe München' };

/** A one-page PDF whose content stream (Flate-compressed) draws `text`, with an optional Info title. */
function pdfWith(text: string, info = '') {
  const content = deflateSync(Buffer.from(`BT /F1 12 Tf 72 720 Td (${text}) Tj ET`, 'latin1'));
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj << /Length ' + content.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1'),
    content,
    Buffer.from(`\nendstream\nendobj\n2 0 obj << ${info} >>\nendobj\n%%EOF`, 'latin1'),
  ]);
}

const candidate = (overrides: Partial<CandidateEvidence>): CandidateEvidence => ({
  kind: 'pdf',
  role: 'plan',
  link: '',
  page: '',
  ...overrides,
});

describe('recognizing floor plans in any catalog language', () => {
  it('names floor plans by link text or file name', () => {
    for (const text of [
      'Download the Floor Plan',
      'Floorplan-Melbourne-2026.pdf',
      'Hallenplan 2026',
      'HHFL26_Geländeplan_screen',
      'Plan du salon',
      'Plano de la feria',
      'Planimetria padiglioni',
      'Plattegrond beurs',
      'Plan targów',
      'Exhibition layout',
      '会場マップ',
      '展位图',
      '부스배치도',
      'Схема павильона',
    ]) {
      expect(namesFloorPlan(text), text).toBe(true);
    }
  });

  it('does not take a sitemap, a post-show report or a form for a plan', () => {
    expect(namesFloorPlan('ele26 Gelaendeplan 297x210 E')).toBe(true);
    expect(namesFloorPlan('plan niveau 2')).toBe(true);
    // Verbs and "plan your visit" pages are not plans.
    expect(namesFloorPlan('FRUIT LOGISTICA Bilder Messe planen Unbenannt')).toBe(false);
    expect(namesFloorPlan('trade fair plan your visit opening hours')).toBe(false);
    expect(namesFloorPlan('Standplanung und Standbau')).toBe(false);
    expect(namesFloorPlan('Sitemap')).toBe(false);
    expect(namesFloorPlan('site map')).toBe(false);
    expect(namesNotPlan('Post Show Report 2026')).toBe(true);
    expect(namesNotPlan('AVTAL FORMEX MIDI form')).toBe(true);
    expect(namesNotPlan('Floor plan 2026')).toBe(false);
  });

  it('hears an organizer say the plan is not out yet, in any language', () => {
    expect(saysPlanComingSoon('Menu\nPlan targów będzie udostępniony wkrótce!\nKontakt')).toBe(true);
    expect(saysPlanComingSoon('Floor plan\nComing soon')).toBe(true);
    expect(saysPlanComingSoon('Hallenplan folgt in Kürze')).toBe(true);
    // "Coming soon" about something else does not mean the plan is.
    expect(saysPlanComingSoon('Floor plan\nHall 1 Hall 2\nRegistration\nTickets coming soon')).toBe(false);
  });

  it('tells generic download links from named ones', () => {
    expect(isGenericLinkText('Download')).toBe(true);
    expect(isGenericLinkText('PDF 2 MB')).toBe(true);
    expect(isGenericLinkText('Pobierz')).toBe(true);
    expect(isGenericLinkText('Post show report')).toBe(false);
  });
});

describe('links on an official page', () => {
  it('resolves relative links against <base href>', () => {
    // Without <base>, this would resolve to /exhibit/exhibit/2026-exhibitor-list (a 404 the crawler used to follow).
    const [link] = extractLinks('<base href="/"><a href="exhibit/2026-exhibitor-list">List</a>', 'https://www.propakcape.co.za/exhibit/');
    expect(link.url).toBe('https://www.propakcape.co.za/exhibit/2026-exhibitor-list');
  });

  it('finds plans shown without an <a>: preloaded images, CSS backgrounds, frames and URLs in scripts', () => {
    const links = extractLinks(
      `<link rel="preload" as="image" href="/uploads/2026/01/MAPKA-TARGOWA.jpg">
       <div style="background-image:url('/img/hall-plan.png')"></div>
       <iframe src="https://show2026.expofp.com"></iframe>
       <script>window.data={"plan":"https:\\/\\/cdn.example.com\\/files\\/floorplan-2026.pdf"}</script>`,
      'https://www.example-expo.com/fair-plan/'
    );
    expect(links.map((link) => [link.tag, link.url])).toEqual([
      ['bg', 'https://www.example-expo.com/uploads/2026/01/MAPKA-TARGOWA.jpg'],
      ['bg', 'https://www.example-expo.com/img/hall-plan.png'],
      ['frame', 'https://show2026.expofp.com/'],
      ['raw', 'https://cdn.example.com/files/floorplan-2026.pdf'],
    ]);
  });

  it('reads menu links carried as JSON props (script-rendered navigation)', () => {
    const html = `<nav-menu :items="[{&quot;title&quot;:&quot;Site Plan&quot;,&quot;link&quot;:&quot;\/sueffa\/en\/travel\/site-plan\/&quot;}]"></nav-menu>`;
    const [link] = extractLinks(html, 'https://www.messe-stuttgart.de/sueffa/en/');
    expect(link).toMatchObject({ url: 'https://www.messe-stuttgart.de/sueffa/en/travel/site-plan/', text: 'Site Plan', tag: 'a' });
  });

  it('keeps the words around a link and skips social/login links', () => {
    const links = extractLinks(
      '<p>Melbourne 2026 — <a href="/fp.pdf">Download</a></p><a href="https://facebook.com/x">f</a><a href="/wp-login.php">in</a>',
      'https://www.example-expo.com/'
    );
    expect(links).toHaveLength(1);
    expect(links[0].near).toContain('Melbourne 2026');
  });

  it('reads sitemaps and site keys', () => {
    expect(sitemapLocations('<urlset><url><loc>https://x.example/floor-plan</loc></url></urlset>')).toEqual(['https://x.example/floor-plan']);
    expect(siteKey('https://www.bauma.messe-muenchen.de/x')).toBe('messe-muenchen.de');
    expect(siteKey('franchisingexpo.com.au')).toBe('franchisingexpo.com.au');
  });
});

describe('judging a candidate against the edition', () => {
  const p2026 = editionProfile(melbourne2026);

  it('accepts a plan whose link names the edition’s year and city', () => {
    const verdict = judgeCandidate(candidate({ link: 'melbourne 2026 floorplan Floorplan Melbourne 2026 pdf' }), p2026);
    expect(verdict).toMatchObject({ accept: true, strength: 'link' });
  });

  it('accepts a plan whose own text names the year and venue', () => {
    const verdict = judgeCandidate(
      candidate({ link: 'files floorplan pdf', contentBody: 'Franchising Expo 1 - 2 August 2026 Melbourne Convention and Exhibition Centre Stand 101 Stand 102 entrance café' }),
      p2026
    );
    expect(verdict).toMatchObject({ accept: true, strength: 'content' });
  });

  it('rejects another year’s plan, even one announcing this year’s dates', () => {
    expect(judgeCandidate(candidate({ link: 'melbourne 2027 Floorplan Melbourne 2027 pdf' }), p2026)).toMatchObject({
      accept: false,
      reason: 'link is for the 2027 edition',
    });
    // Last year's report printing next year's dates in its closing page.
    const report = judgeCandidate(
      candidate({
        link: 'post show report 2025 plan',
        contentBody: 'Franchising Expo 2025 Melbourne results 2025 visitors 2025 exhibitors — see you 1 - 2 August 2026',
      }),
      p2026
    );
    expect(report.accept).toBe(false);
  });

  it('rejects a plan printing mostly another year', () => {
    const verdict = judgeCandidate(
      candidate({
        link: 'floorplan pdf',
        contentBody: 'Franchising Expo Melbourne 12 May 2025 hall plan 2025 edition 3 May 2025 next edition 2026',
      }),
      p2026
    );
    expect(verdict.accept).toBe(false);
  });

  it('never takes another city’s plan, even for the right year', () => {
    expect(judgeCandidate(candidate({ link: 'sydney 2026 Floorplan Sydney 2026 pdf' }), p2026)).toMatchObject({ accept: false });
    expect(
      judgeCandidate(candidate({ link: 'floorplan pdf', contentBody: 'Franchising Expo Sydney 1 - 2 May 2026 ICC Sydney Stand 1 Stand 2 Stand 3 entrance' }), p2026)
    ).toMatchObject({ accept: false });
    // Same year but a city not on the organizer's list: any catalog city counts in a file name.
    const kolkata = editionProfile({ name: 'Industech Expo', city: 'Kolkata', startDate: '2027-04-23', knownCities: new Set(['bhiwadi', 'kolkata']) });
    expect(judgeCandidate(candidate({ link: 'Bhiwadi Floor Plan 2027 Blank pdf Floor Plan' }), kolkata).accept).toBe(false);
  });

  it('lets nearby words add evidence but never override the link’s own year', () => {
    // "2026CincyMoveInScheduleFloorPlan.pdf" under a heading naming the next show.
    const cincinnati = editionProfile({ name: 'Ford Cincinnati Travel, Sports and Boat Show', city: 'Cincinnati', startDate: '2027-01-15' });
    expect(
      judgeCandidate(candidate({ link: 'wp content uploads 2026Cincy Move In Schedule Floor Plan pdf', near: '2027 Cincinnati Travel Sports Boat Show exhibitors' }), cincinnati)
        .accept
    ).toBe(false);
    // A generic "Floor plan" link under the edition's heading is confirmed by it.
    expect(judgeCandidate(candidate({ link: 'files fp pdf Floor plan', near: 'Melbourne 2026 exhibitors' }), editionProfile(melbourne2026)).accept).toBe(true);
  });

  it('treats another edition’s year code ("ATA26_Floorplan") as that edition’s plan', () => {
    const agritechnica = editionProfile({ name: 'Agritechnica Asia', city: 'Ho Chi Minh', startDate: '2027-03-17' });
    expect(judgeCandidate(candidate({ kind: 'image', link: 'ATA26 Floorplan 3 png' }), agritechnica)).toMatchObject({ accept: false, reason: 'link is for the 2026 edition' });
  });

  it('knows a venue by the acronym the catalog writes for it', () => {
    const bauma = editionProfile({ name: 'bauma CHINA', city: 'Shanghai', startDate: '2026-11-24', venue: 'Shanghai New International Expo Centre - SNIEC', otherCities: ['Munich'] });
    expect(bauma.venueAcronyms).toContain('sniec');
    expect(judgeCandidate(candidate({ kind: 'image', link: 'bC2026 Fairgrounds Map 260724 SNIEC Pavilion EN PNG' }), bauma)).toMatchObject({ accept: true });
  });

  it('rejects a file the organizer uploaded after this edition took place (a later show’s plan)', () => {
    // "09-AZ26-Floor-Plan-Exhibitors-Show-Schedule.pdf", uploaded 2026/09, for the 7-8 August 2026 Schaumburg show.
    const schaumburg = editionProfile({ name: 'Stamp & Scrapbook Expo Schaumburg', city: 'Schaumburg, IL', startDate: '2026-08-07', endDate: '2026-08-08', otherCities: ['Mesa, AZ', 'Ontario, CA'] });
    const verdict = judgeCandidate(
      candidate({ link: 'wp content uploads 09 AZ26 Floor Plan Exhibitors Show Schedule pdf', uploadDate: '2026-09', contentBody: 'Stamp & Scrapbook Expo 2026 show schedule Schaumburg Mesa Ontario floor plan booths' }),
      schaumburg
    );
    expect(verdict).toMatchObject({ accept: false, reason: 'file was uploaded in 2026-09, after this edition took place' });
  });

  it('does not let a tour schedule listing several cities stand for this city', () => {
    const schaumburg = editionProfile({ name: 'Stamp & Scrapbook Expo', city: 'Schaumburg, IL', startDate: '2026-08-07', otherCities: ['Mesa, AZ', 'Ontario, CA'] });
    const verdict = judgeCandidate(
      candidate({ link: 'files floor plan exhibitors show schedule pdf', contentBody: 'Stamp & Scrapbook Expo 7 August 2026 show schedule: Schaumburg, Mesa, Ontario. Floor plan booths 101 102' }),
      schaumburg
    );
    expect(verdict.evidence).not.toContain('plan names Schaumburg');
  });

  it('rejects another edition in the same city and year ("June 2026" plan for the August phase)', () => {
    const vietbuild = editionProfile({ name: 'Vietbuild Exhibition - Ho Chi Minh - Phase 2', city: 'Ho Chi Minh', startDate: '2026-08-12', endDate: '2026-08-16' });
    expect(judgeCandidate(candidate({ kind: 'image', link: 'uploads Floor Plan Of Vietbuild HCMC June 2026 1 png' }), vietbuild)).toMatchObject({
      accept: false,
      reason: expect.stringContaining('names June 2026, but this edition is in August 2026'),
    });
    // A date in another month ("CPM_27_feb_kontur" for a September show) is another edition too.
    const cpm = editionProfile({ name: 'CPM - Collection Premiere Moscow', city: 'Moscow', startDate: '2026-09-01', endDate: '2026-09-04' });
    expect(judgeCandidate(candidate({ kind: 'image', link: 'uploads CPM 27 feb kontur date png Floor plan 2026 Moscow' }), cpm).reason).toContain('names 27 February');
    // A month next to the edition (move-in the week before) is not another edition.
    expect(judgeCandidate(candidate({ kind: 'image', link: 'Floor Plan Vietbuild Ho Chi Minh July 2026 png' }), vietbuild).reason).not.toContain('another edition that year');
  });

  it('needs the dates or month when the organizer runs several editions in the city that year', () => {
    const phase2 = editionProfile({ name: 'Vietbuild - Phase 2', city: 'Ho Chi Minh', startDate: '2026-08-12', endDate: '2026-08-16', sameCityYearEditions: 2 });
    const cityAndYearOnly = judgeCandidate(candidate({ kind: 'image', link: 'Floor plan of HO CHI MINH CITY at SKY EXPO CENTER 2026 png' }), phase2);
    expect(cityAndYearOnly).toMatchObject({ accept: false, reason: expect.stringContaining('cannot verify edition: 3 editions in ho chi minh in 2026') });
    expect(judgeCandidate(candidate({ kind: 'image', link: 'Floor plan Ho Chi Minh August 2026 png' }), phase2).accept).toBe(true);
  });

  it('reads two-digit year codes in file names ("HHFL26")', () => {
    const verdict = judgeCandidate(candidate({ link: 'Heim Handwerk Downloads Plan HHFL26 Geländeplan screen pdf' }), editionProfile(heim2026));
    expect(verdict).toMatchObject({ accept: true, strength: 'link' });
  });

  it('accepts a plan with no words of its own only from a page about this edition', () => {
    const plain = candidate({ kind: 'image', link: 'files plan jpg' });
    const heim = editionProfile(heim2026);
    // The page prints the edition's dates and names the event: its plan is this edition's.
    expect(
      judgeCandidate({ ...plain, page: 'plan HEIM+HANDWERK 2026', pageBody: 'HEIM+HANDWERK 25. November 2026 bis 29. November 2026 Messe München' }, heim)
    ).toMatchObject({ accept: true, strength: 'page' });
    // An evergreen page with no year says nothing about which edition the plan is.
    expect(judgeCandidate({ ...plain, page: 'plan HEIM+HANDWERK', pageBody: 'Welcome' }, heim).accept).toBe(false);
    // A file made years before the edition is an old plan left online.
    expect(
      judgeCandidate({ ...plain, page: 'plan HEIM+HANDWERK 2026 Munich', pageBody: '', fileDate: '2022-03' }, heim)
    ).toMatchObject({ accept: false, reason: expect.stringContaining('before the previous edition') });
    // Annual show: a file from 11+ months before is the previous edition's; a biennial one has two years.
    expect(judgeCandidate({ ...plain, page: 'plan HEIM+HANDWERK 2026 Munich', fileDate: '2025-11' }, heim).accept).toBe(false);
    expect(judgeCandidate({ ...plain, page: 'plan HEIM+HANDWERK 2026 Munich', fileDate: '2026-06' }, heim).accept).toBe(true);
    const biennial = editionProfile({ ...heim2026, frequency: 'every 2 years' });
    expect(judgeCandidate({ ...plain, page: 'plan HEIM+HANDWERK 2026 Munich', fileDate: '2025-11' }, biennial).accept).toBe(true);
  });

  it('on a site running several cities, needs this city named somewhere', () => {
    const plain = candidate({ kind: 'image', link: 'files plan jpg' });
    expect(judgeCandidate({ ...plain, page: 'Floor plan Franchising Expo 2026' }, p2026).accept).toBe(false);
    expect(judgeCandidate({ ...plain, page: 'Floor plan Franchising Expo Melbourne 2026' }, p2026).accept).toBe(true);
  });

  it('accepts a manual only if its text carries the floor plan', () => {
    const manual = candidate({ role: 'document', link: 'exhibitor manual 2026 melbourne' });
    expect(judgeCandidate({ ...manual, contentBody: 'Exhibitor manual 2026 Melbourne. Move-in times, catering, badges and parking.' }, p2026).accept).toBe(false);
    expect(
      judgeCandidate({ ...manual, contentBody: 'Exhibitor manual 2026 Melbourne. Floor plan: see the floor plan on page 4. Hall 1 layout.' }, p2026).accept
    ).toBe(true);
  });
});

describe('what the plan itself says', () => {
  const header = 'franchising expo 2026 - 1 - 2 August 2026 | Melbourne Convention Exhibition Centre - Contact the organisers';

  it('reads the text drawn on a Flate-compressed PDF page and its metadata title/date', () => {
    const pdf = pdfWith(header, '/Title (Floorplan Melbourne 2026) /CreationDate (D:20260412093000)');
    expect(pdfText(pdf)).toContain('1 - 2 August 2026 | Melbourne Convention Exhibition Centre');
    expect(pdfMetadata(pdf)).toEqual({ title: 'Floorplan Melbourne 2026', created: '2026-04' });
  });

  it('returns null ("cannot tell") for a PDF with no readable text', () => {
    expect(pdfText(Buffer.from('%PDF-1.4\n1 0 obj << >>\nstream\n\u0001\u0002\u0003ÿ\nendstream\n%%EOF', 'latin1'))).toBeNull();
  });

  it('ignores binary streams that happen to contain text markers', () => {
    const image = Buffer.from('stream\n\u0000ÿBT (\u0001\u0002þ) Tj ET\u0000\nendstream\n', 'latin1');
    expect(pdfText(Buffer.concat([pdfWith(header), image]))).toContain('1 - 2 August 2026');
  });

  it('reads what a web page says it is: its title and main heading, not its body', () => {
    const html = `<html><head><title>2026 Floor Plan | Cruise Ship Interiors Europe 2026 | Hamburg</title></head>
      <body><h1>Floor Plan</h1><p>Also see our Miami 2027 show</p></body></html>`;
    expect(pageHeadline(html)).toContain('Hamburg');
    expect(pageHeadline(html)).not.toContain('Miami');
  });

  it('finds the edition’s printed dates in several formats and languages', () => {
    const profile = editionProfile(melbourne2026);
    expect(namesEditionDates('1 - 2 August 2026', profile)).toBe(true);
    expect(namesEditionDates('August 1-2, 2026', profile)).toBe(true);
    expect(namesEditionDates('01.08.2026 – 02.08.2026', profile)).toBe(true);
    expect(namesEditionDates('1. bis 2. August 2026', profile)).toBe(true);
    expect(namesEditionDates('2026年8月1日', profile)).toBe(true);
    expect(namesEditionDates('1 - 2 August 2027', profile)).toBe(false);
  });

  it('reads the printed dates for the caption', () => {
    expect(editionDates(header, '2026')).toBe('1 - 2 August 2026');
    expect(editionDates('30th April - 3rd May 2027, Kolkata', '2027')).toBe('30th April - 3rd May 2027');
    expect(editionDates('Hall plan, June 9-10, 2026', '2026')).toBe('June 9-10, 2026');
    expect(editionDates('No dates here', '2026')).toBeUndefined();
  });
});

describe('helpers', () => {
  it('tells PDFs, images, interactive plans and pages apart', () => {
    expect(floorPlanKind('https://x.example/plan.pdf')).toBe('pdf');
    expect(floorPlanKind('https://x.example/plan', 'application/pdf')).toBe('pdf');
    expect(floorPlanKind('https://x.example/plan.PNG?v=2')).toBe('image');
    expect(floorPlanKind('https://myshow2026.expofp.com/')).toBe('interactive');
    // A booth-reservation flow shows no plan once the event has passed.
    expect(floorPlanKind('https://app.expofp.com/reservebooth?expoId=32378&culture=en')).toBe('page');
    expect(namesNotPlan('reservebooth expoId 32378')).toBe(true);
    expect(floorPlanKind('https://x.example/floor-plan')).toBe('page');
    expect(floorPlanKind('https://x.example/plan.pdf', 'text/html')).toBe('page'); // the server's word wins
  });

  it('swaps an edition year in a file location, but never an upload-date folder', () => {
    expect(sameLocationForYear('https://s3.example.com/expo/melbourne-2027/Floorplan-Melbourne-2027.pdf', '2027', '2026')).toBe(
      'https://s3.example.com/expo/melbourne-2026/Floorplan-Melbourne-2026.pdf'
    );
    expect(sameLocationForYear('https://x.example/wp-content/uploads/2025/01/plan-2025.pdf', '2025', '2026')).toBe(
      'https://x.example/wp-content/uploads/2025/01/plan-2026.pdf'
    );
    expect(sameLocationForYear('https://x.example/floorplan.pdf', '2027', '2026')).toBeNull();
  });

  it('recognizes the organizer’s own file buckets, not pages mentioning its name', () => {
    expect(carriesBrand('https://s3-ap-southeast-2.amazonaws.com/franchising-expo-production/melbourne-2026/fp.pdf', 'franchisingexpo')).toBe(true);
    expect(carriesBrand('https://files.franchisingexpo-cdn.com/fp.pdf', 'franchisingexpo')).toBe(true);
    expect(carriesBrand('https://aggregator.example/franchising-expo-melbourne-2026-floorplan.pdf', 'franchisingexpo')).toBe(false);
  });

  it('never reads an upload-date folder as the edition year', () => {
    expect(urlWords('https://x.example/wp-content/uploads/2026/01/metaltech-MAPKA-TARGOWA-1.jpg')).not.toContain('2026');
    expect(judgeCandidate(candidate({ kind: 'image', link: urlWords('https://x.example/wp-content/uploads/2026/01/plan-2027.png') }), editionProfile({ ...heim2026, startDate: '2027-01-19' })).reason).not.toContain('2026');
  });

  it('reads image sizes and rules out icons, thumbnails, banners and camera photos', () => {
    const png = (width: number, height: number) => {
      const buffer = Buffer.alloc(24);
      buffer.writeUInt32BE(0x89504e47, 0);
      buffer.writeUInt32BE(width, 16);
      buffer.writeUInt32BE(height, 20);
      return buffer;
    };
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0x38, 0x07, 0x80, 0x03, 0x01, 0x22, 0x00]);
    expect(imageSize(png(2000, 1400))).toEqual({ width: 2000, height: 1400 });
    expect(imageSize(jpeg)).toEqual({ width: 1920, height: 1080 });
    expect(unlikelyPlanImage({ width: 2000, height: 1400 })).toBeNull();
    expect(unlikelyPlanImage({ width: 212, height: 300 })).toContain('too small');
    expect(unlikelyPlanImage({ width: 2100, height: 500 })).toContain('banner');
    expect(photoFileName('https://www.worldartdubai.com/images/img03.jpg')).toBe(true);
    expect(photoFileName('https://x.example/DSC_1234.JPG')).toBe(true);
    expect(photoFileName('https://x.example/uploads/LCSS-26-Floor-Plan-2-10.jpg')).toBe(false);
    // Drawn plans compress far better than photos (measured: plans 0.05–0.19 bytes/px, photos 0.28–0.55).
    expect(looksLikePhoto(68_045, { width: 800, height: 566 }, 'image/jpeg')).toBe(false);
    expect(looksLikePhoto(230_440, { width: 822, height: 628 }, 'image/jpeg')).toBe(true);
    expect(decorationFile('https://gulfoodmanufacturing.com/wp-content/themes/gm/assets/images/floor-plan-section/floor-bg-layer.svg')).toBe(true);
    expect(decorationFile('https://v2.imarcexpo.com/_media/companies/69ce29eb.jpg')).toBe(true);
    expect(decorationFile('https://x.example/uploads/LCSS-26-Floor-Plan.jpg')).toBe(false);
    expect(originalImageUrl('https://x.example/uploads/plan-hali-724x1024.png')).toBe('https://x.example/uploads/plan-hali.png');
    expect(originalImageUrl('https://x.example/uploads/LCSS-23-Floorplan-scaled.jpg')).toBe('https://x.example/uploads/LCSS-23-Floorplan.jpg');
  });

  it('finds the event’s own section of a shared venue site', () => {
    expect(sectionOf('http://www.messe-stuttgart.de/sueffa/en')).toBe('/sueffa');
    expect(sectionOf('http://akjassociates.com/event/germany')).toBe('/event/germany');
    expect(sectionOf('http://www.franchiseshowinfo.com/tampa/visitor')).toBe('/tampa');
    expect(sectionOf('http://www.electronica.de/en/home')).toBeNull();
    expect(sectionOf('http://www.viscomitalia.it/en-gb.html')).toBeNull();
  });

  it('reads the website domain, ignoring eventseye', () => {
    expect(websiteDomain('http://www.franchisingexpo.com.au')).toBe('franchisingexpo.com.au');
    expect(websiteDomain('https://www.eventseye.com/fairs/x.html')).toBeNull();
    expect(websiteDomain('')).toBeNull();
  });
});

// --- The search, against in-memory sites --------------------------------------

type FakeSite = Record<string, { body: string | Buffer; type?: string; status?: number }>;

function fakeFetcher(site: FakeSite): Fetcher {
  return async (url): Promise<Fetched> => {
    const key = url.replace(/^http:/, 'https:');
    // "https://site.example" and "https://site.example/" are the same page.
    const entry = site[key] ?? site[key.replace(/\/$/, '')] ?? site[`${key}/`];
    if (!entry) {
      if (/\/(?:robots\.txt|sitemap[^/]*\.xml|wp-json\/.*)$/.test(new URL(key).pathname + new URL(key).search)) {
        return { url: key, status: 404, contentType: 'text/html', headers: {}, body: Buffer.from(''), truncated: false } satisfies Fetched;
      }
      throw new Error(`no route to ${key}`);
    }
    const type = entry.type ?? (key.endsWith('.pdf') ? 'application/pdf' : key.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
    const body = typeof entry.body === 'string' ? Buffer.from(entry.body) : entry.body;
    return { url: key, status: entry.status ?? 200, contentType: type, headers: { 'content-type': type }, body, truncated: false };
  };
}

const franchising = {
  name: 'Franchising Expo',
  city: 'Melbourne',
  startDate: '2026-08-01',
  endDate: '2026-08-02',
  country: 'Australia',
  venue: 'Melbourne Convention and Exhibition Centre',
  organizer: 'Expertise Events',
  website: 'http://www.franchisingexpo.example',
  otherCities: ['Sydney', 'Brisbane'],
};
const budget = { timeMs: 10_000 };

describe('discovering the plan on the official sources', () => {
  it('follows exhibitor pages to this edition’s plan and skips other cities’ plans', async () => {
    const fetcher = fakeFetcher({
      'https://www.franchisingexpo.example': {
        body: '<title>Franchising Expo</title><a href="/exhibit">Exhibit</a><a href="/about">About us</a>',
      },
      'https://www.franchisingexpo.example/exhibit': {
        body: `<title>Exhibit | Franchising Expo</title>
          <a href="https://cdn.example/fe/Floorplan-Sydney-2026.pdf">Sydney floor plan</a>
          <a href="https://cdn.example/fe/Floorplan-Melbourne-2026.pdf">Melbourne floor plan</a>`,
      },
      'https://cdn.example/fe/Floorplan-Sydney-2026.pdf': { body: pdfWith('Franchising Expo Sydney 1 May 2026 ICC Sydney Stand 1 Stand 2 Stand 3 entrance') },
      'https://cdn.example/fe/Floorplan-Melbourne-2026.pdf': { body: pdfWith('Franchising Expo 1 - 2 August 2026 Melbourne Convention Exhibition Centre stands entrance') },
    });
    const result = await discoverFloorPlan(franchising, { fetcher, search: null, budget });
    expect(result.status).toBe('VERIFIED_PLAN');
    expect(result.floorPlan).toMatchObject({
      kind: 'pdf',
      url: 'https://cdn.example/fe/Floorplan-Melbourne-2026.pdf',
      edition: '1 - 2 August 2026',
      verification: 'plan-content',
    });
    expect(result.trace.sources.map((source) => source.url)).toContain('https://www.franchisingexpo.example/exhibit');
  });

  it('finds a plan listed only in the sitemap', async () => {
    const fetcher = fakeFetcher({
      'https://www.franchisingexpo.example': { body: '<title>Franchising Expo</title>' },
      'https://www.franchisingexpo.example/robots.txt': { body: 'Sitemap: https://www.franchisingexpo.example/sitemap.xml', type: 'text/plain' },
      'https://www.franchisingexpo.example/sitemap.xml': {
        body: '<urlset><url><loc>https://www.franchisingexpo.example/files/melbourne-2026-floor-plan.pdf</loc></url></urlset>',
        type: 'application/xml',
      },
      'https://www.franchisingexpo.example/files/melbourne-2026-floor-plan.pdf': { body: Buffer.from('%PDF-1.4 unreadable') },
    });
    const result = await discoverFloorPlan(franchising, { fetcher, search: null, budget });
    expect(result.floorPlan).toMatchObject({ url: 'https://www.franchisingexpo.example/files/melbourne-2026-floor-plan.pdf', verification: 'official-link' });
  });

  it('tries this year’s file where last year’s plan lives', async () => {
    const fetcher = fakeFetcher({
      'https://www.franchisingexpo.example': {
        body: '<a href="https://cdn.example/fe/melbourne-2025/Floorplan-Melbourne-2025.pdf">Floor plan</a>',
      },
      'https://cdn.example/fe/melbourne-2025/Floorplan-Melbourne-2025.pdf': { body: pdfWith('Franchising Expo 2 - 3 August 2025 Melbourne stands entrance cafe') },
      'https://cdn.example/fe/melbourne-2026/Floorplan-Melbourne-2026.pdf': { body: pdfWith('Franchising Expo 1 - 2 August 2026 Melbourne stands entrance cafe') },
    });
    const result = await discoverFloorPlan(franchising, { fetcher, search: null, budget });
    expect(result.floorPlan?.url).toBe('https://cdn.example/fe/melbourne-2026/Floorplan-Melbourne-2026.pdf');
    expect(result.trace.candidates.find((entry) => entry.url.includes('2025'))?.decision).not.toBe('accepted');
  });

  it('says VERIFIED_NO_PLAN only after searching a reachable site through', async () => {
    const fetcher = fakeFetcher({
      'https://www.franchisingexpo.example': { body: '<a href="/exhibit">Exhibit</a><a href="/fp-2025.pdf">Floor plan 2025</a>' },
      'https://www.franchisingexpo.example/exhibit': { body: '<title>Exhibit</title><p>Floor plan coming soon.</p>' },
      'https://www.franchisingexpo.example/fp-2025.pdf': { body: pdfWith('Franchising Expo Melbourne 2 - 3 August 2025 stands entrance cafe') },
    });
    const result = await discoverFloorPlan(franchising, { fetcher, search: null, budget });
    expect(result.status).toBe('VERIFIED_NO_PLAN');
    expect(result.floorPlan).toBeNull();
    expect(result.trace.candidates.some((entry) => entry.decision === 'rejected')).toBe(true);
  });

  it('follows this city’s page for the next edition to reach this edition’s file (a past edition no longer linked)', async () => {
    const fetcher = fakeFetcher({
      'https://www.franchisingexpo.example': { body: '<a href="/expos/melbourne-2027">Melbourne</a><a href="/expos/sydney-2027">Sydney</a>' },
      'https://www.franchisingexpo.example/expos/melbourne-2027': {
        body: '<title>Melbourne 2027</title><a href="https://cdn.example/fe/melbourne-2027/floorplan/Floorplan-Melbourne-2027.pdf">Floor plan</a>',
      },
      'https://www.franchisingexpo.example/expos/sydney-2027': { body: '<title>Sydney 2027</title>' },
      'https://cdn.example/fe/melbourne-2026/floorplan/Floorplan-Melbourne-2026.pdf': { body: pdfWith('Franchising Expo 1 - 2 August 2026 Melbourne stands entrance cafe') },
    });
    const result = await discoverFloorPlan(franchising, { fetcher, search: null, budget });
    expect(result.floorPlan?.url).toBe('https://cdn.example/fe/melbourne-2026/floorplan/Floorplan-Melbourne-2026.pdf');
    expect(result.trace.sources.map((source) => source.url)).not.toContain('https://www.franchisingexpo.example/expos/sydney-2027');
  });

  it('says DOWNLOAD_FAILED, not VERIFIED_NO_PLAN, when a plan could not be downloaded (DNS failure, timeout)', async () => {
    const site = fakeFetcher({
      'https://www.franchisingexpo.example': { body: '<a href="https://cdn.example/fe/Floorplan-Melbourne-2026.pdf">Floor plan</a>' },
    });
    let attempts = 0;
    const fetcher: Fetcher = async (url, options) => {
      if (url.includes('cdn.example')) {
        attempts++;
        throw new NetworkError('fetch failed (ENOTFOUND)');
      }
      return site(url, options);
    };
    const result = await discoverFloorPlan(franchising, { fetcher, search: null, budget: { timeMs: 20_000 } });
    expect(result.status).toBe('DOWNLOAD_FAILED');
    expect(result.trace.outcomeReason).toContain('could not be downloaded');
    expect(result.trace.candidates[0]).toMatchObject({ decision: 'rejected', reason: 'could not be checked: fetch failed (ENOTFOUND)' });
    expect(attempts).toBe(2); // retried once
  });

  it('says NETWORK_ERROR when the official site cannot be reached, DISCOVERY_INCOMPLETE when it blocks us', async () => {
    const unreachable: Fetcher = async () => {
      throw new NetworkError('fetch failed (ENOTFOUND)');
    };
    const offline = await discoverFloorPlan(franchising, { fetcher: unreachable, search: null, budget });
    expect(offline.status).toBe('NETWORK_ERROR');
    expect(offline.trace.outcomeReason).toContain('could not be reached (fetch failed (ENOTFOUND))');

    const blocked: Fetcher = async (url) => ({ url, status: 403, contentType: 'text/html', headers: {}, body: Buffer.from('Forbidden'), truncated: false });
    const refused = await discoverFloorPlan(franchising, { fetcher: blocked, search: null, budget });
    expect(refused.status).toBe('DISCOVERY_INCOMPLETE');
    expect(refused.trace.outcomeReason).toContain('blocks automated access');
  });

  it('says DISCOVERY_INCOMPLETE, not VERIFIED_NO_PLAN, when a plan is found but its edition cannot be verified', async () => {
    const fetcher = fakeFetcher({
      'https://www.franchisingexpo.example': { body: '<title>Franchising Expo</title><a href="/files/floorplan.pdf">Floor plan</a>' },
      'https://www.franchisingexpo.example/files/floorplan.pdf': { body: Buffer.from('%PDF-1.4 unreadable') },
    });
    const result = await discoverFloorPlan(franchising, { fetcher, search: null, budget });
    expect(result.status).toBe('DISCOVERY_INCOMPLETE');
    expect(result.trace.outcomeReason).toContain('insufficient evidence');
  });

  it('never takes a sign-in page or a directions map for the plan', async () => {
    const site = fakeFetcher({
      'https://www.franchisingexpo.example': {
        body: '<title>Franchising Expo Melbourne 2026</title><a href="/exhibitors/floor-plan-2026-melbourne">Floor plan</a><a href="/venue/map?add=MCEC+Melbourne&lat=-37.8">Venue map</a>',
      },
      'https://www.franchisingexpo.example/wp-login.php?redirect_to=/exhibitors/floor-plan-2026-melbourne': { body: '<title>Log in</title>' },
      'https://www.franchisingexpo.example/venue/map?add=MCEC+Melbourne&lat=-37.8': { body: '<title>Venue map Melbourne 2026</title>' },
    });
    const fetcher: Fetcher = async (url, options) =>
      url.endsWith('/exhibitors/floor-plan-2026-melbourne') ? site('https://www.franchisingexpo.example/wp-login.php?redirect_to=/exhibitors/floor-plan-2026-melbourne', options) : site(url, options);
    const result = await discoverFloorPlan(franchising, { fetcher, search: null, budget });
    expect(result.floorPlan).toBeNull();
    const reasons = result.trace.candidates.map((entry) => entry.reason);
    expect(reasons).toContain('a location/directions map, not a floor plan');
  });

  it('recognizes button graphics that link to the plan', () => {
    expect(BUTTON_IMAGE.test('click-here-for-the-cfhs26-floor-plan.png')).toBe(true);
    expect(BUTTON_IMAGE.test('floorplan-btn.jpg')).toBe(true);
    expect(BUTTON_IMAGE.test('GLEE-FLOORPLAN-With-Sectors-2026.jpg')).toBe(false);
  });

  it('uses web search results only from official sources', async () => {
    const fetcher = fakeFetcher({
      'https://www.franchisingexpo.example': { body: '<title>Franchising Expo</title>' },
      'https://www.franchisingexpo.example/docs/Floorplan-Melbourne-2026.pdf': { body: Buffer.from('%PDF-1.4 unreadable') },
    });
    const search = {
      name: 'fake',
      search: async () => [
        { url: 'https://aggregator.example/franchising-expo-melbourne-2026-floorplan.pdf', title: 'Floor plan', snippet: '' },
        { url: 'https://www.franchisingexpo.example/docs/Floorplan-Melbourne-2026.pdf', title: 'Floorplan Melbourne 2026', snippet: '' },
      ],
    };
    const result = await discoverFloorPlan(franchising, { fetcher, search, budget: { ...budget, maxSearchQueries: 1 } });
    expect(result.floorPlan?.url).toBe('https://www.franchisingexpo.example/docs/Floorplan-Melbourne-2026.pdf');
    expect(result.trace.queries[0]).toMatchObject({ ignored: 1, used: ['https://www.franchisingexpo.example/docs/Floorplan-Melbourne-2026.pdf'] });
  });
});
