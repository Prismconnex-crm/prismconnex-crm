import { describe, expect, it, beforeEach } from 'vitest';
import {
  containsClockTime,
  formatEventClockTime,
  isValidIanaTimeZone,
  parseClockTime,
} from '../../lib/find-shows/event-time';
import {
  discoverEventTiming,
  extractSchemaOrgTiming,
  extractTextOpeningHours,
  hasPlaceholderClockPair,
  findOfficialHoursPageLinks,
  isEventseyeDomain,
  type TimingDiscoveryInput,
  type TimingFetcher,
} from '../../lib/find-shows/event-timing-discovery';
import {
  timingEditionKey,
  resolveEventTiming,
  searchTimingEdition,
} from '../../lib/find-shows/event-timing-resolver';
import {
  editionEvidence,
  extractDailySchedule,
  extractLabelledHours,
  findClockRanges,
  findDateMentions,
  timeContext,
} from '../../lib/find-shows/event-timing-parse';
import os from 'os';
import path from 'path';
import {
  clearTimingMemoryCacheForTests,
  isTimingRecordFresh,
  readTimingRecord,
  writeTimingRecord,
  type StoredTimingRecord,
} from '../../lib/find-shows/event-timing-store';
import type { FindShowEvent } from '../../types/find-shows';

describe('Find Shows Event Timing - Time Parsing & Formatting', () => {
  it('identifies valid clock times and rejects date-only strings', () => {
    // Clock times
    expect(containsClockTime('2027-04-10T09:30:00Z')).toBe(true);
    expect(containsClockTime('2027-04-10T09:30:00+02:00')).toBe(true);
    expect(containsClockTime('2027-04-10 10:00')).toBe(true);
    expect(containsClockTime('09:30')).toBe(true);
    expect(containsClockTime('18:00')).toBe(true);
    expect(containsClockTime('9:00 AM')).toBe(true);
    expect(containsClockTime('6:30 PM')).toBe(true);

    // Date-only strings (must NOT be treated as clock times)
    expect(containsClockTime('2027-04-10')).toBe(false);
    expect(containsClockTime('10 Apr 2027')).toBe(false);
    expect(containsClockTime('April 2027')).toBe(false);
    expect(containsClockTime('')).toBe(false);
    expect(containsClockTime(null)).toBe(false);
    expect(containsClockTime(undefined)).toBe(false);
  });

  it('validates IANA timezones strictly', () => {
    expect(isValidIanaTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidIanaTimeZone('America/New_York')).toBe(true);
    expect(isValidIanaTimeZone('Asia/Tokyo')).toBe(true);
    expect(isValidIanaTimeZone('UTC')).toBe(true);

    expect(isValidIanaTimeZone('Invalid/Timezone')).toBe(false);
    expect(isValidIanaTimeZone('')).toBe(false);
    expect(isValidIanaTimeZone(null)).toBe(false);
  });

  it('formats verified clock times cleanly without inventing timezones', () => {
    // 24h clock times
    expect(formatEventClockTime('09:00')).toBe('09:00 AM');
    expect(formatEventClockTime('18:00')).toBe('06:00 PM');
    expect(formatEventClockTime('13:45')).toBe('01:45 PM');

    // 12h clock times
    expect(formatEventClockTime('9:30 AM')).toBe('09:30 AM');
    expect(formatEventClockTime('5:00 PM')).toBe('05:00 PM');

    // Rejects unverified / date-only
    expect(formatEventClockTime('2027-04-10')).toBeNull();
    expect(formatEventClockTime('')).toBeNull();
    expect(formatEventClockTime(null)).toBeNull();
  });

  it('formats ISO timestamps with explicit offset when timezone is available', () => {
    const formatted = formatEventClockTime('2027-05-15T09:30:00+02:00');
    expect(formatted).toBe('09:30 AM (UTC+2)');

    const utcFormatted = formatEventClockTime('2027-05-15T14:00:00Z');
    expect(utcFormatted).toBe('02:00 PM UTC');
  });

  it('formats ISO timestamps with valid IANA timezone', () => {
    const formatted = formatEventClockTime('2027-05-15T09:00:00Z', 'UTC');
    expect(formatted).toContain('09:00 AM');
    expect(formatted).toContain('UTC');
  });
});

describe('Find Shows Event Timing - Official Source Discovery', () => {
  const baseInput: TimingDiscoveryInput = {
    name: 'Tech Innovation Expo 2027',
    startDate: '2027-05-10',
    endDate: '2027-05-12',
    city: 'Paris',
    website: 'https://www.techexpo-paris.com',
  };

  it('strictly rejects Eventseye as a source for event times', () => {
    expect(isEventseyeDomain('https://www.eventseye.com/fairs/f-test-123.html')).toBe(true);
    expect(isEventseyeDomain('http://eventseye.com')).toBe(true);
    expect(isEventseyeDomain('https://sub.eventseye.com/page')).toBe(true);
    expect(isEventseyeDomain('https://www.official-event.com')).toBe(false);
  });

  it('extracts verified start and end time from Schema.org Event JSON-LD', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tech Innovation Expo 2027</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "ExhibitionEvent",
          "name": "Tech Innovation Expo 2027",
          "startDate": "2027-05-10T09:00:00+02:00",
          "endDate": "2027-05-12T18:00:00+02:00",
          "location": {
            "@type": "Place",
            "name": "Paris Expo Porte de Versailles",
            "timeZone": "Europe/Paris"
          }
        }
        </script>
      </head>
      <body><h1>Welcome</h1></body>
      </html>
    `;

    const result = extractSchemaOrgTiming(html, baseInput, 'https://www.techexpo-paris.com');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('VERIFIED_TIME');
    expect(result?.startTime).toBe('2027-05-10T09:00:00+02:00');
    expect(result?.formattedStartTime).toContain('09:00 AM');
    // Day-1 rule: the endDate time closes 12 May, not day 1 — no end time is shown.
    expect(result?.endTime).toBeNull();
    expect(result?.formattedEndTime).toBeNull();
    expect(result?.evidence).toContain('Schema.org Event JSON-LD');
    expect(result?.evidence).toContain('no day-1 closing time');
  });

  it('uses both JSON-LD times for a single-day entry', () => {
    const html = `<script type="application/ld+json">
      {"@type": "Event", "startDate": "2027-05-10T09:00:00+02:00", "endDate": "2027-05-10T18:00:00+02:00"}
    </script>`;
    const result = extractSchemaOrgTiming(html, baseInput, 'https://www.techexpo-paris.com');
    expect(result?.formattedStartTime).toBe('09:00 AM (UTC+2)');
    expect(result?.formattedEndTime).toBe('06:00 PM (UTC+2)');
  });

  it('prefers a complete day-1 text schedule over a multi-day JSON-LD start', async () => {
    const html = `
      <script type="application/ld+json">
      {"@type": "Event", "startDate": "2027-05-10T09:00:00+02:00", "endDate": "2027-05-12T17:00:00+02:00"}
      </script>
      <h2>Opening hours — 10-12 May 2027</h2><p>10 May 2027: 09:00 - 19:00</p><p>12 May 2027: 09:00 - 17:00</p>`;
    const timing = await discoverEventTiming(baseInput, async (url) => ({ ok: true, status: 200, url, html }));
    expect([timing.startTime, timing.endTime]).toEqual(['09:00', '19:00']);
  });

  it('falls back to the JSON-LD start time alone when no day-1 closing time is published', async () => {
    const html = `<script type="application/ld+json">
      {"@type": "Event", "startDate": "2027-05-10T09:00:00+02:00", "endDate": "2027-05-12T17:00:00+02:00"}
    </script>`;
    const timing = await discoverEventTiming(baseInput, async (url) => ({ ok: true, status: 200, url, html }));
    expect(timing.status).toBe('VERIFIED_TIME');
    expect(timing.formattedStartTime).toBe('09:00 AM (UTC+2)');
    expect(timing.formattedEndTime).toBeNull();
  });

  it('rejects date-only Schema.org JSON-LD without inferring times', () => {
    const dateOnlyHtml = `
      <script type="application/ld+json">
      {
        "@type": "Event",
        "name": "Tech Innovation Expo 2027",
        "startDate": "2027-05-10",
        "endDate": "2027-05-12"
      }
      </script>
    `;

    const result = extractSchemaOrgTiming(dateOnlyHtml, baseInput, 'https://www.techexpo-paris.com');
    expect(result).toBeNull();
  });

  it('rejects Schema.org JSON-LD from a different edition or year', () => {
    const pastEditionHtml = `
      <script type="application/ld+json">
      {
        "@type": "Event",
        "name": "Tech Innovation Expo 2026",
        "startDate": "2026-05-10T09:00:00+02:00",
        "endDate": "2026-05-12T18:00:00+02:00"
      }
      </script>
    `;

    const result = extractSchemaOrgTiming(pastEditionHtml, baseInput, 'https://www.techexpo-paris.com');
    expect(result).toBeNull();
  });

  it('extracts official opening hours from visitor information page text', () => {
    const hoursHtml = `
      <div class="content">
        <h2>Visitor Information — 10 to 12 May 2027</h2>
        <p>Exhibition opening hours: 09:30 - 18:00 CET</p>
      </div>
    `;

    const result = extractTextOpeningHours(hoursHtml, 'https://www.techexpo-paris.com/visiting', baseInput);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('VERIFIED_TIME');
    expect(result?.startTime).toBe('09:30');
    expect(result?.endTime).toBe('18:00');
    expect(result?.formattedStartTime).toBe('09:30 AM CET');
    expect(result?.formattedEndTime).toBe('06:00 PM CET');
    expect(result?.evidence).toContain('Opening Hours');
  });

  it('discovers opening hours sub-links on the official domain', () => {
    const mainHtml = `
      <nav>
        <a href="/about">About</a>
        <a href="/opening-hours">Opening Hours</a>
        <a href="/exhibitor-list">Exhibitors</a>
        <a href="https://external.com/schedule">External</a>
      </nav>
    `;

    const links = findOfficialHoursPageLinks(mainHtml, 'https://www.techexpo-paris.com');
    expect(links).toEqual(['https://www.techexpo-paris.com/opening-hours']);
  });

  it('runs discovery via mock fetcher and handles verified source end-to-end', async () => {
    const mockFetcher: TimingFetcher = async (url) => {
      if (url === 'https://www.techexpo-paris.com') {
        return {
          ok: true,
          status: 200,
          url,
          html: `
            <h1>Tech Innovation Expo — 10-12 May 2027, Paris</h1>
            <a href="/opening-times">Visitor Hours</a>
          `,
        };
      }
      if (url === 'https://www.techexpo-paris.com/opening-times') {
        return {
          ok: true,
          status: 200,
          url,
          html: `
            <p>Show opening times: 9:00 AM to 6:00 PM</p>
          `,
        };
      }
      return { ok: false, status: 404, url };
    };

    const timing = await discoverEventTiming(baseInput, mockFetcher);
    expect(timing.status).toBe('VERIFIED_TIME');
    expect(timing.formattedStartTime).toBe('09:00 AM');
    expect(timing.formattedEndTime).toBe('06:00 PM');
  });

  it('returns UNAVAILABLE and never invents times when official source has no clock times', async () => {
    const mockFetcher: TimingFetcher = async (url) => ({
      ok: true,
      status: 200,
      url,
      html: '<html><body>Welcome to the trade show! No schedule published yet.</body></html>',
    });

    const timing = await discoverEventTiming(baseInput, mockFetcher);
    expect(timing.status).toBe('UNAVAILABLE');
    expect(timing.startTime).toBeNull();
    expect(timing.endTime).toBeNull();
    expect(timing.formattedStartTime).toBeNull();
    expect(timing.formattedEndTime).toBeNull();
  });

  it('returns FETCH_ERROR (retried later, never "none published") when the official website fails', async () => {
    const mockFetcher: TimingFetcher = async (url) => ({
      ok: false,
      status: 500,
      url,
      error: 'HTTP 500 Internal Server Error',
    });

    const timing = await discoverEventTiming(baseInput, mockFetcher);
    expect(timing.status).toBe('FETCH_ERROR');
    expect(timing.startTime).toBeNull();
  });
});

describe('Find Shows Event Timing - Edition Resolver & Caching', () => {
  beforeEach(() => {
    process.env.FIND_SHOWS_TIMING_STORE = path.join(
      os.tmpdir(),
      `timing-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    clearTimingMemoryCacheForTests();
  });

  it('constructs stable edition keys per domain, section, city, and start date', () => {
    const eventA: Pick<FindShowEvent, 'website' | 'city' | 'startDate'> = {
      website: 'https://www.auto-expo.de/frankfurt',
      city: 'Frankfurt (Germany)',
      startDate: '2027-09-15',
    };
    const eventB: Pick<FindShowEvent, 'website' | 'city' | 'startDate'> = {
      website: 'http://auto-expo.de/frankfurt',
      city: 'Frankfurt',
      startDate: '2027-09-15',
    };
    // Duplicate catalog records share the same edition key
    expect(timingEditionKey(eventA)).toBe(timingEditionKey(eventB));
    expect(timingEditionKey(eventA)).toBe('auto-expo.de/frankfurt|frankfurt|2027-09-15');

    // A different year/edition gets a distinct key
    const event2028: Pick<FindShowEvent, 'website' | 'city' | 'startDate'> = {
      website: 'https://www.auto-expo.de/frankfurt',
      city: 'Frankfurt',
      startDate: '2028-09-15',
    };
    expect(timingEditionKey(eventA)).not.toBe(timingEditionKey(event2028));
  });

  it('resolves timing from cache without triggering additional fetches', async () => {
    let fetchCount = 0;
    const mockFetcher: TimingFetcher = async (url) => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        url,
        html: `
          <script type="application/ld+json">
          {
            "@type": "Event",
            "name": "Auto Expo",
            "startDate": "2027-09-15T09:00:00+02:00",
            "endDate": "2027-09-18T18:00:00+02:00"
          }
          </script>
        `,
      };
    };

    const mockEvent = {
      slug: 'auto-expo-2027',
      name: 'Auto Expo 2027',
      startDate: '2027-09-15',
      endDate: '2027-09-18',
      city: 'Frankfurt',
      website: 'https://www.auto-expo.de/frankfurt',
    } as FindShowEvent;

    // First call: discovers and caches
    const firstResult = await resolveEventTiming(mockEvent, null, mockFetcher);
    expect(firstResult.status).toBe('VERIFIED_TIME');
    expect(fetchCount).toBe(1);

    // Second call: served directly from cache (0 new fetches)
    const secondResult = await resolveEventTiming(mockEvent, null, mockFetcher);
    expect(secondResult.status).toBe('VERIFIED_TIME');
    expect(fetchCount).toBe(1);
    expect(secondResult.formattedStartTime).toBe(firstResult.formattedStartTime);
  });
});

describe('Find Shows Event Timing - Clock and date formats', () => {
  it('reads clock ranges in English, 24-hour, French, German and dotted formats', () => {
    const read = (text: string) => findClockRanges(text).map((r) => [r.start, r.end]);
    expect(read('10AM - 6:30PM')).toEqual([['10:00', '18:30']]);
    expect(read('09:30 – 18:00')).toEqual([['09:30', '18:00']]);
    expect(read('9:00 a.m. to 5:00 p.m.')).toEqual([['09:00', '17:00']]);
    expect(read('9.30am – 5.30pm')).toEqual([['09:30', '17:30']]);
    expect(read('de 10h à 18h')).toEqual([['10:00', '18:00']]);
    expect(read('10h30-19h')).toEqual([['10:30', '19:00']]);
    expect(read('10 bis 18 Uhr')).toEqual([['10:00', '18:00']]);
    expect(read('9:00 – 17:00 Uhr')).toEqual([['09:00', '17:00']]);
  });

  it('never reads bare numbers, date ranges or reversed ranges as clock times', () => {
    expect(findClockRanges('2-5 November 2026')).toEqual([]);
    expect(findClockRanges('Halls 10 - 18')).toEqual([]);
    expect(findClockRanges('Version 1.10 - 2.20')).toEqual([]);
    expect(findClockRanges('18:00 - 09:00')).toEqual([]);
    expect(findClockRanges('13pm - 14pm')).toEqual([]);
  });

  it('finds date mentions in several languages and numeric forms', () => {
    const dates = (text: string) => findDateMentions(text).flatMap((m) => m.dates);
    expect(dates('2 November, 2026')).toEqual(['2026-11-02']);
    expect(dates('November 2-5, 2026')).toEqual(['2026-11-02', '2026-11-05']);
    expect(dates('7th - 8th August 2027')).toEqual(['2027-08-07', '2027-08-08']);
    expect(dates('du 10 au 12 mai 2027')).toEqual(['2027-05-10', '2027-05-12']);
    expect(dates('15. September 2027')).toEqual(['2027-09-15']);
    expect(dates('2 de noviembre de 2026')).toEqual(['2026-11-02']);
    expect(dates('2026-11-02')).toEqual(['2026-11-02']);
    // Day-first and month-first readings; the edition range picks one.
    expect(dates('03/04/2027')).toEqual(['2027-04-03', '2027-03-04']);
  });

  it('judges edition evidence by explicit-year dates only', () => {
    const edition = { startDate: '2026-08-01', endDate: '2026-08-02' };
    expect(editionEvidence('Melbourne, 1-2 August 2026', edition)).toBe('match');
    expect(editionEvidence('7th - 8th August 2027 Melbourne', edition)).toBe('conflict');
    expect(editionEvidence('Open daily 10am - 5pm. © 2026 Specialised Events', edition)).toBe('none');
  });
});

describe('Find Shows Event Timing - Official site shapes', () => {
  const page = (body: string, jsonLd?: object) =>
    `<html><head>${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}</head><body>${body}</body></html>`;
  const siteFetcher =
    (pages: Record<string, string>): TimingFetcher =>
    async (url) =>
      pages[url] !== undefined ? { ok: true, status: 200, url, html: pages[url] } : { ok: false, status: 404, url, error: 'HTTP 404' };

  // Shape of a dmg-events style homepage: Organization JSON-LD only, per-day timings in the footer.
  const adipecHome = page(
    `<h1>ADIPEC 2026 | 2 - 5 November 2026, Abu Dhabi, UAE</h1>
     <a href="/visit/">Visit</a>
     ${'<p>Conference programme and sponsor content for the energy industry.</p>'.repeat(3000)}
     <footer><div class="footer__col footer__col-contact"><h6>TIMINGS</h6>
       <div class="footer__col-contact-block"><span><img src="/images/calendar.svg" /></span>
       2 November, 2026: 10AM - 6:30PM<br />3 November, 2026: 10AM - 6:30PM<br />
       4 November, 2026: 10AM - 6:30PM<br />5 November, 2026: 10AM - 5:30PM</div></div></footer>`,
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'ADIPEC' }
  );
  const adipecInput: TimingDiscoveryInput = {
    name: 'ADIPEC',
    startDate: '2026-11-02',
    endDate: '2026-11-05',
    city: 'Abu Dhabi (UAE - United Arab Emirates)',
    website: 'https://www.adipec.com/',
  };

  it('reads a per-day footer schedule and applies the day-1 rule', async () => {
    expect(adipecHome.length).toBeGreaterThan(180 * 1024);
    const timing = await discoverEventTiming(adipecInput, siteFetcher({ 'https://www.adipec.com/': adipecHome }));
    expect(timing.status).toBe('VERIFIED_TIME');
    expect(timing.startTime).toBe('10:00');
    expect(timing.endTime).toBe('18:30');
    expect(timing.formattedStartTime).toBe('10:00 AM');
    expect(timing.formattedEndTime).toBe('06:30 PM');
    expect(timing.sourceUrl).toBe('https://www.adipec.com/');
    expect(timing.evidence).toContain('day 1 (2026-11-02)');
    expect(timing.evidence).toContain('2026-11-05 10:00-17:30');
  });

  it('rejects the same schedule for a different edition of the show', async () => {
    const timing = await discoverEventTiming(
      { ...adipecInput, startDate: '2027-11-01', endDate: '2027-11-04' },
      siteFetcher({ 'https://www.adipec.com/': adipecHome })
    );
    expect(timing.status).toBe('UNAVAILABLE');
    expect(timing.startTime).toBeNull();
  });

  // Multi-city organiser site: homepage is a city picker, the edition page names its own dates.
  const franchisingPages = {
    'https://www.franchisingexpo.com.au/': page(
      `<p>Select your city. We run annually in Brisbane, Sydney and Melbourne.</p>
       <a href="https://www.franchisingexpo.com.au/expos/sydney-2027">Sydney</a>
       <a href="https://www.franchisingexpo.com.au/expos/melbourne-2027">Melbourne</a>`,
      { '@context': 'http://schema.org/', '@type': 'LocalBusiness', name: 'Franchising Expo' }
    ),
    'https://www.franchisingexpo.com.au/expos/melbourne-2027': page(
      `<h2>7th - 8th August 2027 Melbourne</h2>
       <p>Ticket: $28</p><p>When Open daily 10am - 5pm</p>
       <p>Where Melbourne Convention &amp; Exhibition Centre</p><p>&copy; 2026 - SPECIALISED EVENTS</p>`
    ),
  };
  const melbourne = (startDate: string, endDate: string): TimingDiscoveryInput => ({
    name: 'FRANCHISING & BUSINESS OPPORTUNITIES EXPO - MELBOURNE',
    startDate,
    endDate,
    city: 'Melbourne (Australia)',
    website: 'https://www.franchisingexpo.com.au/',
  });

  it('follows the edition city page on a multi-city site and reads labelled hours', async () => {
    const timing = await discoverEventTiming(melbourne('2027-08-07', '2027-08-08'), siteFetcher(franchisingPages));
    expect(timing.status).toBe('VERIFIED_TIME');
    expect(timing.formattedStartTime).toBe('10:00 AM');
    expect(timing.formattedEndTime).toBe('05:00 PM');
    expect(timing.sourceUrl).toBe('https://www.franchisingexpo.com.au/expos/melbourne-2027');
  });

  it("does not reuse next year's hours for a past edition", async () => {
    const timing = await discoverEventTiming(melbourne('2026-08-01', '2026-08-02'), siteFetcher(franchisingPages));
    expect(timing.status).toBe('UNAVAILABLE');
    expect(timing.formattedStartTime).toBeNull();
  });

  it('reads a German numeric-date schedule (day 1 wins)', async () => {
    const html = page(
      `<h1>Auto Expo Frankfurt</h1><h2>Öffnungszeiten</h2>
       <p>15.09.2027: 09:00 – 18:00 Uhr</p><p>16.09.2027: 09:00 – 18:00 Uhr</p><p>18.09.2027: 09:00 – 16:00 Uhr</p>`
    );
    const timing = await discoverEventTiming(
      { name: 'Auto Expo', startDate: '2027-09-15', endDate: '2027-09-18', city: 'Frankfurt', website: 'https://auto-expo.example/' },
      siteFetcher({ 'https://auto-expo.example/': html })
    );
    expect(timing.status).toBe('VERIFIED_TIME');
    expect([timing.startTime, timing.endTime]).toEqual(['09:00', '18:00']);
  });

  it('reads French labelled hours on a dated page', async () => {
    const html = page(`<h1>Salon Habitat</h1><p>Horaires d'ouverture : du 10 au 12 mai 2027, de 10h à 18h</p>`);
    const timing = await discoverEventTiming(
      { name: 'Salon Habitat', startDate: '2027-05-10', endDate: '2027-05-12', city: 'Lyon', website: 'https://salon.example/' },
      siteFetcher({ 'https://salon.example/': html })
    );
    expect(timing.status).toBe('VERIFIED_TIME');
    expect(timing.formattedStartTime).toBe('10:00 AM');
    expect(timing.formattedEndTime).toBe('06:00 PM');
  });

  it('reads US-style "Show Hours" on a visitor sub-page linked from a dated homepage', async () => {
    const timing = await discoverEventTiming(
      { name: 'Pack Expo', startDate: '2026-11-02', endDate: '2026-11-05', city: 'Las Vegas, NV', website: 'https://pack.example/' },
      siteFetcher({
        'https://pack.example/': page(`<h1>November 2-5, 2026 · Las Vegas</h1><a href="/plan-your-visit/">Plan your visit</a>`),
        'https://pack.example/plan-your-visit/': page(`<h2>Show Hours</h2><p>10:00 AM – 5:00 PM daily</p>`),
      })
    );
    expect(timing.status).toBe('VERIFIED_TIME');
    expect(timing.sourceUrl).toBe('https://pack.example/plan-your-visit/');
    expect([timing.formattedStartTime, timing.formattedEndTime]).toEqual(['10:00 AM', '05:00 PM']);
  });

  it('ignores conference agenda slots that are not introduced as show hours', () => {
    const text = 'Conference programme 2 November 2026: 09:00 - 10:00 Opening keynote, 3 November 2026: 11:00 - 12:00 Panel';
    expect(extractDailySchedule(text, { startDate: '2026-11-02', endDate: '2026-11-05' })).toEqual([]);
  });

  it('does not accept undated hours when nothing ties the site to the edition', async () => {
    const timing = await discoverEventTiming(
      { name: 'Expo', startDate: '2027-03-03', endDate: '2027-03-06', city: 'Dubai', website: 'https://expo.example/' },
      siteFetcher({ 'https://expo.example/': page('<p>Opening hours: 10:00 - 18:00</p>') })
    );
    expect(timing.status).toBe('UNAVAILABLE');
  });

  it('chooses the day-1 sub-event from Schema.org JSON-LD', () => {
    const html = page('', {
      '@type': 'ExhibitionEvent',
      startDate: '2027-05-10',
      endDate: '2027-05-12',
      subEvent: [
        { '@type': 'Event', startDate: '2027-05-11T09:00:00+02:00', endDate: '2027-05-11T19:00:00+02:00' },
        { '@type': 'Event', startDate: '2027-05-10T10:00:00+02:00', endDate: '2027-05-10T18:00:00+02:00' },
      ],
    });
    const result = extractSchemaOrgTiming(
      html,
      { name: 'X', startDate: '2027-05-10', endDate: '2027-05-12', city: 'Paris', website: 'https://x.example' },
      'https://x.example'
    );
    expect(result?.startTime).toBe('2027-05-10T10:00:00+02:00');
    expect(result?.endTime).toBe('2027-05-10T18:00:00+02:00');
  });

  it('never reports "no time published" for a site it could not read', async () => {
    const input = { name: 'X', startDate: '2027-05-10', endDate: '2027-05-12', city: 'Paris', website: 'https://x.example/' };
    const failing = (status: number, error: string): TimingFetcher => async (url) => ({ ok: false, status, url, error });
    expect((await discoverEventTiming(input, failing(0, 'Timeout'))).status).toBe('FETCH_ERROR');
    expect((await discoverEventTiming(input, failing(0, 'ENOTFOUND'))).status).toBe('FETCH_ERROR');
    expect((await discoverEventTiming(input, failing(403, 'HTTP 403'))).status).toBe('FETCH_ERROR');
    const gone = await discoverEventTiming(input, siteFetcher({}));
    expect(gone.status).toBe('FETCH_ERROR');
    expect(gone.evidence).toContain('HTTP 404');
  });

  it('reports UNAVAILABLE once the official site was read and a missing sub-page is just absent', async () => {
    const input = { name: 'X', startDate: '2027-05-10', endDate: '2027-05-12', city: 'Paris', website: 'https://x.example/' };
    const timing = await discoverEventTiming(
      input,
      siteFetcher({ 'https://x.example/': page('<h1>10-12 May 2027</h1><a href="/opening-hours">Opening hours</a>') })
    );
    expect(timing.status).toBe('UNAVAILABLE');
  });

  it('never fetches Eventseye pages', async () => {
    const fetched: string[] = [];
    const fetcher: TimingFetcher = async (url) => {
      fetched.push(url);
      return { ok: false, status: 404, url };
    };
    const timing = await discoverEventTiming(
      { name: 'X', startDate: '2027-05-10', endDate: '2027-05-12', city: 'Paris', website: 'https://www.eventseye.com/fairs/f-x-1.html' },
      fetcher
    );
    expect(fetched).toEqual([]);
    expect(timing.status).toBe('UNAVAILABLE');
  });
});

describe('Find Shows Event Timing - Cache refresh', () => {
  beforeEach(() => {
    process.env.FIND_SHOWS_TIMING_STORE = path.join(os.tmpdir(), `timing-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    clearTimingMemoryCacheForTests();
  });

  const event = {
    slug: 'trade-fair-2027',
    name: 'Trade Fair',
    startDate: '2027-05-10',
    endDate: '2027-05-12',
    city: 'Paris (France)',
    website: 'https://fair.example/',
  } as FindShowEvent;

  const hoursHtml = '<h1>10-12 May 2027</h1><p>Opening hours: 09:30 - 18:00</p>';
  const counting = (html: string | null) => {
    const fetcher: TimingFetcher & { calls: number } = Object.assign(
      async (url: string) => {
        fetcher.calls++;
        return html === null ? { ok: false, status: 0, url, error: 'Timeout' } : { ok: true, status: 200, url, html };
      },
      { calls: 0 }
    );
    return fetcher;
  };

  const stored = (status: StoredTimingRecord['status'], ageMs: number): StoredTimingRecord => {
    const at = new Date(Date.now() - ageMs).toISOString();
    return {
      status,
      startTime: null,
      endTime: null,
      timeZone: null,
      formattedStartTime: null,
      formattedEndTime: null,
      sourceUrl: 'https://fair.example/',
      evidence: null,
      checkedAt: at,
      lastAttemptAt: at,
      key: timingEditionKey(event),
      edition: { name: event.name, startDate: event.startDate, endDate: event.endDate, city: 'Paris', website: 'https://fair.example/' },
    };
  };

  it('serves a recent UNAVAILABLE from the store without fetching', async () => {
    await writeTimingRecord(stored('UNAVAILABLE', 60_000));
    const fetcher = counting(hoursHtml);
    expect((await resolveEventTiming(event, null, fetcher)).status).toBe('UNAVAILABLE');
    expect(fetcher.calls).toBe(0);
  });

  it('re-checks an expired UNAVAILABLE and picks up newly published hours', async () => {
    await writeTimingRecord(stored('UNAVAILABLE', 8 * 24 * 60 * 60 * 1000));
    const fetcher = counting(hoursHtml);
    const timing = await resolveEventTiming(event, null, fetcher);
    expect(timing.status).toBe('VERIFIED_TIME');
    expect(timing.formattedStartTime).toBe('09:30 AM');
    expect((await readTimingRecord(timingEditionKey(event)))?.status).toBe('VERIFIED_TIME');
  });

  it('retries a FETCH_ERROR after an hour, but not before', async () => {
    await writeTimingRecord(stored('FETCH_ERROR', 5 * 60_000));
    expect(isTimingRecordFresh(stored('FETCH_ERROR', 5 * 60_000))).toBe(true);
    expect(isTimingRecordFresh(stored('FETCH_ERROR', 2 * 60 * 60_000))).toBe(false);
    const fetcher = counting(hoursHtml);
    expect((await resolveEventTiming(event, null, fetcher)).status).toBe('FETCH_ERROR');
    expect(fetcher.calls).toBe(0);
  });

  it('never replaces a verified time with a later failure', async () => {
    const first = await searchTimingEdition(event, null, { fetcher: counting(hoursHtml) });
    expect(first.status).toBe('VERIFIED_TIME');
    const second = await searchTimingEdition(event, null, { fetcher: counting(null) });
    expect(second.status).toBe('VERIFIED_TIME');
    expect(second.formattedStartTime).toBe('09:30 AM');
    expect(second.lastAttemptStatus).toBe('FETCH_ERROR');
    expect(second.attempts).toBe(2);
  });

  it('shares one search between concurrent requests for the same edition', async () => {
    const fetcher = counting(hoursHtml);
    const [a, b] = await Promise.all([resolveEventTiming(event, null, fetcher), resolveEventTiming(event, null, fetcher)]);
    expect(a.status).toBe('VERIFIED_TIME');
    expect(b.status).toBe('VERIFIED_TIME');
    expect(fetcher.calls).toBe(1);
  });
});

describe('Find Shows Event Timing - Catalog run regressions', () => {
  const sept = { name: 'Show', startDate: '2026-09-01', endDate: '2026-09-03', city: 'Dubai', website: 'https://show.example/' };
  const read = (html: string, input = sept) =>
    discoverEventTiming(input, async (url) => (url === input.website ? { ok: true, status: 200, url, html } : { ok: false, status: 404, url }));

  it('rejects labelled hours that name another edition’s date', async () => {
    // The page mentions this edition somewhere, but the hours are for May 2027.
    const timing = await read('<p>Archive: 1-3 September 2026</p><h3>OPENING TIMES</h3><p>11 May 2027: Tuesday: 10:00 - 18:00</p>');
    expect(timing.status).toBe('UNAVAILABLE');
  });

  it('rejects "When <other date> <hours>"', async () => {
    const timing = await read('<p>Last year: 2 September 2026</p><p>When 6 October 2026 09:00 - 17:30</p>');
    expect(timing.status).toBe('UNAVAILABLE');
  });

  it('accepts labelled hours whose date is inside the edition', async () => {
    const timing = await read('<h1>1-3 September 2026</h1><p>Opening Hours Day 1 (Sep 1) 9:00 AM - 6:00 PM</p>');
    expect([timing.formattedStartTime, timing.formattedEndTime]).toEqual(['09:00 AM', '06:00 PM']);
  });

  it('ignores JSON-LD midnight placeholders and UTC instants without a stated time zone', () => {
    const ld = (startDate: string, endDate: string, extra: object = {}) =>
      `<script type="application/ld+json">${JSON.stringify({ '@type': 'Event', startDate, endDate, ...extra })}</script>`;
    const read = (html: string) => extractSchemaOrgTiming(html, sept, 'https://show.example/');
    // Date placeholders: midnight / 23:59.
    expect(read(ld('2026-09-01T00:00:00+04:00', '2026-09-01T23:59:00+04:00'))).toBeNull();
    // UTC only: "17:00Z" is not the venue's clock time.
    expect(read(ld('2026-09-01T06:00:00Z', '2026-09-01T14:00:00Z'))).toBeNull();
    expect(read(ld('2026-09-01T06:00:00+00:00', '2026-09-01T14:00:00+00:00'))).toBeNull();
    // UTC with an IANA zone converts to local time; a local offset is a local time.
    expect(read(ld('2026-09-01T06:00:00Z', '2026-09-01T14:00:00Z', { location: { timeZone: 'Asia/Dubai' } }))?.formattedStartTime).toMatch(/^10:00 AM/);
    expect(read(ld('2026-09-01T10:00:00+04:00', '2026-09-01T18:00:00+04:00'))?.formattedEndTime).toBe('06:00 PM (UTC+4)');
  });

  describe('identical start and end clock times (metadata timestamps)', () => {
    const ld = (startDate: string, endDate: string, extra: object = {}) =>
      `<script type="application/ld+json">${JSON.stringify({ '@type': 'Event', startDate, endDate, ...extra })}</script>`;
    const nov = { name: 'Trade fair', startDate: '2026-11-09', endDate: '2026-11-13', city: 'São Paulo', website: 'https://fair.example/' };

    it('rejects a multi-day entry whose start and end share one clock time (a page timestamp)', () => {
      expect(extractSchemaOrgTiming(ld('2026-11-09 09:21', '2026-11-13 09:21'), nov, 'https://fair.example/')).toBeNull();
      expect(extractSchemaOrgTiming(ld('2026-11-09T09:21:37+03:00', '2026-11-13T09:21:37+03:00'), nov, 'https://fair.example/')).toBeNull();
    });

    it('rejects a single-day entry that opens and closes at the same minute', () => {
      expect(extractSchemaOrgTiming(ld('2026-11-09T10:00:00-03:00', '2026-11-09T10:00:00-03:00'), nov, 'https://fair.example/')).toBeNull();
    });

    it('keeps identical clock times when a stated duration matches start→end exactly', () => {
      const timing = extractSchemaOrgTiming(
        ld('2026-11-09T09:00:00-03:00', '2026-11-11T09:00:00-03:00', { duration: 'PT48H' }),
        nov,
        'https://fair.example/'
      );
      expect(timing?.formattedStartTime).toBe('09:00 AM (UTC-3)');
      // A duration that does not match is not evidence.
      expect(
        extractSchemaOrgTiming(ld('2026-11-09T09:00:00-03:00', '2026-11-11T09:00:00-03:00', { duration: 'PT8H' }), nov, 'https://fair.example/')
      ).toBeNull();
    });

    it('does not affect entries with different start and end clock times', () => {
      expect(hasPlaceholderClockPair('2026-11-09T10:00:00-03:00', '2026-11-13T18:00:00-03:00', undefined)).toBe(false);
      expect(hasPlaceholderClockPair('2026-11-09', '2026-11-13', undefined)).toBe(false);
      expect(hasPlaceholderClockPair('2026-11-09 09:21', '2026-11-13 09:21', undefined)).toBe(true);
    });

    it('falls through to the official text when the JSON-LD pair is a timestamp', async () => {
      const html = `${ld('2026-11-09 09:21', '2026-11-13 09:21')}<h1>9-13 November 2026</h1><p>Opening hours: 13:00 - 21:00</p>`;
      const timing = await discoverEventTiming(nov, async (url) => ({ ok: true, status: 200, url, html }));
      expect([timing.formattedStartTime, timing.formattedEndTime]).toEqual(['01:00 PM', '09:00 PM']);
      expect(timing.evidence).toContain('Official Opening Hours');
    });

    it('reports no time when only the timestamp pair is published', async () => {
      const html = `${ld('2026-11-09 09:21', '2026-11-13 09:21')}<h1>9-13 November 2026</h1>`;
      const timing = await discoverEventTiming(nov, async (url) => ({ ok: true, status: 200, url, html }));
      expect(timing.status).toBe('UNAVAILABLE');
    });

    it('never reads an official text range that closes when it opens', async () => {
      const html = '<h1>9-13 November 2026</h1><p>Opening hours: 10:00 - 10:00</p>';
      const timing = await discoverEventTiming(nov, async (url) => ({ ok: true, status: 200, url, html }));
      expect(timing.status).toBe('UNAVAILABLE');
    });
  });

  it('survives links with malformed percent-escapes', async () => {
    const pages: Record<string, string> = {
      'https://show.example/': '<h1>1-3 September 2026</h1><a href="/visit%E2%80/">Bad</a><a href="/100%/">Bad</a><a href="/visitor-info/">Visit</a>',
      'https://show.example/visitor-info/': '<p>Opening hours: 10:00 - 18:00</p>',
    };
    const timing = await discoverEventTiming(sept, async (url) =>
      pages[url] ? { ok: true, status: 200, url, html: pages[url] } : { ok: false, status: 404, url }
    );
    expect([timing.formattedStartTime, timing.formattedEndTime]).toEqual(['10:00 AM', '06:00 PM']);
  });

  it('does not read "Timing Chip Pick-Up" as show hours', async () => {
    const timing = await read('<h1>1 September 2026</h1><p>Timing Chip Pick-Up for Sprint athletes • 5:00 am– 6:30 am</p>');
    expect(timing.status).toBe('UNAVAILABLE');
  });

  it('a recheck drops a stored time the current rules no longer verify, but a fetch failure keeps it', async () => {
    process.env.FIND_SHOWS_TIMING_STORE = path.join(os.tmpdir(), `timing-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    clearTimingMemoryCacheForTests();
    const event = { slug: 's', name: 'Show', startDate: '2026-09-01', endDate: '2026-09-03', city: 'Dubai', website: 'https://show.example/' } as FindShowEvent;
    const serve = (html: string | null): TimingFetcher => async (url) =>
      html === null ? { ok: false, status: 0, url, error: 'Timeout' } : { ok: true, status: 200, url, html };

    await searchTimingEdition(event, null, { fetcher: serve('<h1>1-3 September 2026</h1><p>Opening hours: 10:00 - 18:00</p>') });
    // Site unreachable during the recheck: the verified time stays.
    expect((await searchTimingEdition(event, null, { fetcher: serve(null), revalidate: true })).status).toBe('VERIFIED_TIME');
    // Without revalidate, "nothing found" never erases a verified time.
    expect((await searchTimingEdition(event, null, { fetcher: serve('<p>Welcome</p>') })).status).toBe('VERIFIED_TIME');
    // With revalidate, a readable site that no longer verifies it replaces it.
    expect((await searchTimingEdition(event, null, { fetcher: serve('<p>Welcome</p>'), revalidate: true })).status).toBe('UNAVAILABLE');
  });
});

describe('Find Shows Event Timing - Main hours vs side activities, "When" headings', () => {
  const site = (pages: Record<string, string>): TimingFetcher => async (url) =>
    pages[url] !== undefined ? { ok: true, status: 200, url, html: pages[url] } : { ok: false, status: 404, url, error: 'HTTP 404' };
  const nov = (startDate: string, endDate: string, name = 'Trade Expo') => ({
    name,
    startDate,
    endDate,
    city: 'Cologne',
    website: 'https://expo.example/',
  });

  describe('scanning', () => {
    it('finds a range that overlaps a rejected candidate ("11 - 10:00 - 17:00")', () => {
      expect(findClockRanges('November 11 - 10:00 - 17:00 (drinks reception from 17:00 to 18:30)').map((r) => [r.start, r.end])).toEqual([
        ['10:00', '17:00'],
        ['17:00', '18:30'],
      ]);
    });

    it('never reads the opening hour as the end of a day range', () => {
      expect(findDateMentions('November 11 - 10:00 - 17:00', 2026).flatMap((m) => m.dates)).toEqual(['2026-11-11']);
      expect(findDateMentions('Nov 11 - 9am', 2026).flatMap((m) => m.dates)).toEqual(['2026-11-11']);
      // A real day range is still a range.
      expect(findDateMentions('November 11 - 12, 2026').flatMap((m) => m.dates)).toEqual(['2026-11-11', '2026-11-12']);
    });
  });

  describe('side activities', () => {
    it('takes the show hours, not the drinks reception after them (Motorsport shape)', async () => {
      const html =
        '<p>11 - 12 November, 2026 Hall 10.1, Koelnmesse</p><h2>Opening Times</h2>' +
        '<p>Wednesday, November 11 - 10:00 - 17:00 (drinks reception from 17:00 to 18:30 with the awards starting at 17:15)</p>' +
        '<p>Thursday, November 12 - 10:00 to 17:00</p>';
      const timing = await discoverEventTiming(nov('2026-11-10', '2026-11-11'), site({ 'https://expo.example/': html }));
      expect([timing.formattedStartTime, timing.formattedEndTime]).toEqual(['10:00 AM', '05:00 PM']);
    });

    it('skips a registration slot and takes the exhibition hours under the same label', () => {
      const text = '9-11 November 2026. Opening hours: Registration 08:00 - 09:00, Exhibition 09:00 - 17:00';
      expect(extractLabelledHours(text, nov('2026-11-09', '2026-11-11'))).toMatchObject({ start: '09:00', end: '17:00' });
    });

    it('rejects hours labelled for a conference, seminar, reception or awards', async () => {
      // MRO Australasia shape: only a welcome reception and conference timings are published.
      const mro =
        '<h1>November 10-11, 2026</h1><p>Event Timings Welcome Reception November 9, 2026: 6pm - 8pm ' +
        'Conference Timings November 10: 9am – 5:30pm November 11: 9am – 4:00pm</p>';
      expect((await discoverEventTiming(nov('2026-11-11', '2026-11-12', 'MRO Australasia'), site({ 'https://expo.example/': mro }))).status).toBe(
        'UNAVAILABLE'
      );
      for (const line of [
        'Seminar opening times: 09:00 - 12:00',
        'Awards ceremony timings: 19:00 - 22:00',
        'Exhibitor build-up hours: 07:00 - 09:00',
        'Opening hours. Networking drinks: 18:00 - 20:00',
      ]) {
        expect(extractLabelledHours(`9-11 November 2026. ${line}`, nov('2026-11-09', '2026-11-11'))).toBeNull();
      }
    });

    it('keeps hours whose side-activity word is the event’s own name', () => {
      const text = '9-11 November 2026. Congress opening hours: 08:30 - 18:00';
      expect(extractLabelledHours(text, nov('2026-11-09', '2026-11-11', 'ESC CONGRESS'))).toMatchObject({ start: '08:30', end: '18:00' });
      expect(extractLabelledHours(text, nov('2026-11-09', '2026-11-11', 'Trade Expo'))).toBeNull();
    });

    it('takes the trade-fair block, not the congress block above it (Medcare Leipzig shape)', () => {
      const text =
        'Öffnungszeiten Veranstaltungsdatum 1. und 2. September 2026 Einlass 1. September 2026, ab 9:00 Uhr 2. September 2026, ab 9:00 Uhr ' +
        'Kongress 1. September 2026, 10:00 bis 17:00 Uhr 2. September 2026, 10:00 bis 16:00 Uhr ' +
        'Fachmesse 1. September 2026, 9:00 bis 17:30 Uhr 2. September 2026, 9:00 bis 17:00 Uhr ' +
        'MEDCARE-Abend 1. September 2026, 17:15 bis 20:00 Uhr';
      expect(extractDailySchedule(text, { startDate: '2026-09-01', endDate: '2026-09-02', name: 'MEDCARE' }).map((d) => [d.date, d.start, d.end])).toEqual([
        ['2026-09-01', '09:00', '17:30'],
        ['2026-09-02', '09:00', '17:00'],
      ]);
    });

    it('does not let a side activity on an earlier line reject the next day (Agrotec shape)', () => {
      const text =
        'Visiting Hours PARTICIPANT VISITOR Thursday, September 10, 2026 Opening Ceremony (Optional) 13:00 – 19:00 ' +
        'Friday, September 11, 2026 10:00 AM – 7:00 PM Saturday, September 12, 2026 10:00 AM – 7:00 PM';
      const days = extractDailySchedule(text, { startDate: '2026-09-10', endDate: '2026-09-13' });
      // The ceremony day has no show hours; the first verified show day is 11 September.
      expect(days[0]).toMatchObject({ date: '2026-09-11', start: '10:00', end: '19:00' });
    });

    it('does not read an exhibitor/visitor two-column table as one schedule (Analytica shape)', () => {
      const text =
        'Opening hours for Hyderabad - 2026 Date Exhibitors Visitors Thursday September 10, 2026 9:00–18:00 10:00–18:00 Friday September 11, 2026 9:00–18:00 10:00–18:00';
      expect(extractDailySchedule(text, { startDate: '2026-09-10', endDate: '2026-09-12' })).toEqual([]);
    });

    it('does not mistake an e-mail address for a side activity (ADIPEC footer shape)', () => {
      const text = 'Visitor enquiries: registration@show.example TIMINGS 2 November, 2026: 10AM - 6:30PM 3 November, 2026: 10AM - 6:30PM';
      expect(extractDailySchedule(text, { startDate: '2026-11-02', endDate: '2026-11-03' })[0]).toMatchObject({ start: '10:00', end: '18:30' });
    });

    it('skips a JSON-LD sub-event for a side activity', () => {
      const html = `<script type="application/ld+json">${JSON.stringify({
        '@type': 'ExhibitionEvent',
        name: 'Trade Expo',
        startDate: '2026-11-09',
        endDate: '2026-11-11',
        subEvent: [
          { '@type': 'Event', name: 'Welcome drinks reception', startDate: '2026-11-09T08:00:00+01:00', endDate: '2026-11-09T09:00:00+01:00' },
          { '@type': 'Event', name: 'Exhibition day 1', startDate: '2026-11-09T09:30:00+01:00', endDate: '2026-11-09T18:00:00+01:00' },
        ],
      })}</script>`;
      const timing = extractSchemaOrgTiming(html, nov('2026-11-09', '2026-11-11'), 'https://expo.example/');
      expect([timing?.formattedStartTime, timing?.formattedEndTime]).toEqual(['09:30 AM (UTC+1)', '06:00 PM (UTC+1)']);
    });

    it('does not take a named session sub-event as the day-1 hours (Advanced Textiles shape)', () => {
      const html = `<script type="application/ld+json">${JSON.stringify({
        '@type': 'ExhibitionEvent',
        name: 'Advanced Textiles Expo',
        startDate: '2026-11-03T07:00:00-06:00',
        endDate: '2026-11-05T18:00:00-06:00',
        subEvent: [{ '@type': 'Event', name: 'The future of smart fabrics', startDate: '2026-11-03T08:30:00-06:00', endDate: '2026-11-03T09:45:00-06:00' }],
      })}</script>`;
      const timing = extractSchemaOrgTiming(html, nov('2026-11-03', '2026-11-05', 'ADVANCED TEXTILES EXPO'), 'https://expo.example/');
      // The session is skipped; the event's own entry gives the opening time (its endDate closes a later day).
      expect([timing?.formattedStartTime, timing?.formattedEndTime]).toEqual(['07:00 AM (UTC-6)', null]);
    });

    it('keeps the top-level JSON-LD event even when the event itself is a seminar (Argentina shape)', () => {
      const html = `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Event',
        name: '20th International Seminar Argentina Gold, Silver and Copper',
        startDate: '2026-12-02T09:00:00-03:00',
        endDate: '2026-12-03T18:00:00-03:00',
      })}</script>`;
      const timing = extractSchemaOrgTiming(html, nov('2026-12-01', '2026-12-31', 'ARGENTINA GOLD, SILVER AND COPPER'), 'https://expo.example/');
      expect(timing?.formattedStartTime).toBe('09:00 AM (UTC-3)');
    });

    it('reads "The event will be open during the below times: <date>: <hours>" (Scent Arabia FAQ shape)', () => {
      const text =
        'What dates and times does the show open? The event will be open during the below times: 24 November 2026: 3pm - 10pm ' +
        '25 November 2026: 3pm - 10pm 27 November 2026: 1pm - 10pm';
      expect(extractDailySchedule(text, { startDate: '2026-11-24', endDate: '2026-11-28' })[0]).toMatchObject({ date: '2026-11-24', start: '15:00', end: '22:00' });
    });

    it('classifies the words nearest a range', () => {
      expect(timeContext('Opening Times Wednesday, November 11 - ')).toBe('main');
      expect(timeContext('Opening Times 10:00 - 17:00 (drinks reception from ')).toBe('side');
      expect(timeContext('Conference Timings November 10: ')).toBe('side');
      expect(timeContext('When & where Wednesday ')).toBeNull();
    });
  });

  describe('"When" headings', () => {
    it('reads "When & where <date in edition> <hours>" (Aluminium Arabia shape)', async () => {
      const html =
        '<p>Aluminium Portfolio When & where Wednesday 11 November 2026 10:00 - 19:00 Thursday 12 November 2026 10:00 - 19:00 Arena Riyadh</p>';
      const timing = await discoverEventTiming(nov('2026-11-11', '2026-11-12', 'ALUMINIUM ARABIA'), site({ 'https://expo.example/': html }));
      expect([timing.startTime, timing.endTime]).toEqual(['10:00', '19:00']);
    });

    it('reads "The opening and closing times for …: <date>: <hours>"', () => {
      const text = 'When The opening and closing times for ALUMINIUM Arabia: Wednesday 11 November 2026: 10:00 - 19:00';
      expect(extractDailySchedule(text, { startDate: '2026-11-11', endDate: '2026-11-12' })[0]).toMatchObject({ start: '10:00', end: '19:00' });
    });

    it('reads "WHEN? <weekday> <day month> | <hours>" with the year elsewhere on the page (summit shape)', async () => {
      const html =
        '<p>The Sustainable Packaging Summit returns 10–12 November 2026 at the Beatrix Theatre, Jaarbeurs, Utrecht</p>' +
        '<p>Already registered? WHEN? Tues 10th November | 08:00 - 21:30 Weds 11th November | 08:00 - 23:00 Thurs 12th November | 08:00 - 16:00</p>';
      const timing = await discoverEventTiming(nov('2026-11-10', '2026-11-12', 'SUSTAINABLE PACKAGING SUMMIT'), site({ 'https://expo.example/': html }));
      expect([timing.startTime, timing.endTime]).toEqual(['08:00', '21:30']);
    });

    it('still rejects "When" headings with another edition’s date', async () => {
      const html = '<p>Last edition: 2 September 2026</p><p>When & where Tuesday 6 October 2026 09:00 - 17:30</p>';
      expect((await discoverEventTiming(nov('2026-09-16', '2026-09-17'), site({ 'https://expo.example/': html }))).status).toBe('UNAVAILABLE');
    });

    it('reads "When" headings followed by a weekday and/or date (catalog shapes)', async () => {
      const read = async (body: string, startDate: string, endDate: string) =>
        discoverEventTiming(nov(startDate, endDate), site({ 'https://expo.example/': `<h1>${body}</h1>` }));
      // "When Friday 9:00 AM - 6:00 PM" on a page that names the edition's dates.
      expect((await read('January 8-10, 2027 · When Friday 9:00 AM - 6:00 PM', '2027-01-08', '2027-01-10')).formattedStartTime).toBe('09:00 AM');
      expect((await read('When Tuesday 9 March 2027 | 11:00 AM - 6:00 PM', '2027-03-09', '2027-03-11')).formattedEndTime).toBe('06:00 PM');
      expect(
        (await read('When? 2027 Show Dates & Times Friday 22nd January 9.30 am – 12.30 pm. 22-24 January 2027', '2027-01-22', '2027-01-24')).startTime
      ).toBe('09:30');
    });

    it('does not let a previous sentence decide the context ("…no registration required. When Open 10am - 5pm")', async () => {
      const html = '<h2>7th - 8th August 2027 Melbourne</h2><p>Children: free when accompanied by an adult, no registration required. When Open 10am - 5pm</p>';
      const timing = await discoverEventTiming(nov('2027-08-07', '2027-08-08'), site({ 'https://expo.example/': html }));
      expect([timing.formattedStartTime, timing.formattedEndTime]).toEqual(['10:00 AM', '05:00 PM']);
    });

    it('uses the nearest label that heads the line, past a "when" in prose', () => {
      const text = 'Opening hours. Please arrive early when you can. 2 November 2026: 10:00 - 18:00';
      expect(extractDailySchedule(text, { startDate: '2026-11-02', endDate: '2026-11-03' })[0]).toMatchObject({ start: '10:00', end: '18:00' });
    });

    it('reads "Day 1 May 27, 2027" as May 27, not "1 May"', () => {
      expect(findDateMentions('Day 1 May 27, 2027 10:00hrs - 18:00hrs').flatMap((m) => m.dates)).toEqual(['2027-05-27']);
      const text = 'Opening Hours Magereza Ground - Arusha THURSDAY | Day 1 May 27, 2027 10:00hrs - 18:00hrs';
      expect(extractLabelledHours(text, nov('2027-05-27', '2027-05-30'))).toMatchObject({ start: '10:00', end: '18:00' });
    });

    it('accepts weak labels headed by "Day 1 & Day 2" or by the exhibition itself', () => {
      const edition = nov('2027-03-05', '2027-03-07');
      expect(extractLabelledHours('timings Day 1 & Day 2 10:00 AM to 6:00 PM', edition)).toMatchObject({ start: '10:00', end: '18:00' });
      expect(extractLabelledHours('timings? The exhibition will be open from 10:00 AM to 6:00 PM', edition)).toMatchObject({ start: '10:00', end: '18:00' });
      // A weak label followed by a sentence about something else still does not count.
      expect(extractLabelledHours('when the model underneath changes 10:25am - 11:10am', edition)).toBeNull();
    });

    it('rejects a "When?" schedule for a day outside the edition (another city or year)', () => {
      const text = 'When? 2027 Show Dates & Times Friday 22nd January 9.30 am – 12.30 pm';
      expect(extractLabelledHours(text, nov('2027-01-08', '2027-01-10'))).toBeNull();
      expect(extractLabelledHours(text, nov('2027-01-22', '2027-01-24'))).toMatchObject({ start: '09:30', end: '12:30' });
    });

    it('does not read "when" in a sentence as a heading', async () => {
      const html = '<h1>9-11 November 2026</h1><p>Please note when you arrive between 09:00 - 10:00 the queues are long.</p>';
      expect((await discoverEventTiming(nov('2026-11-09', '2026-11-11'), site({ 'https://expo.example/': html }))).status).toBe('UNAVAILABLE');
    });
  });
});
