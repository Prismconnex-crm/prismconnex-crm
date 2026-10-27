import { describe, expect, it } from 'vitest';
import {
  extractShareImageUrls,
  buildEventProfile,
  buildHeroSiteIndex,
  extractBodyHeroImages,
  extractEventSchemaImages,
  extractPageImages,
  heroSourcePages,
  extractPageImageCandidates,
  isEventSpecificImage,
  isMeaningfulImageText,
  isPromotionalImage,
  createHeroImageClaims,
  heroShowKey,
  HERO_EMBED_REFERER,
  isFetchableUrl,
  isLogoLikeUrl,
  isUsableHeroImage,
  originalImageCandidates,
  readImageInfo,
  resolveEventHeroImage,
  resolveEventHeroImageResult,
  type EventProfile,
  type HeroFetcher,
  type ImageCandidate,
} from '@/lib/find-shows/event-hero-image';

function jpegHeader(width: number, height: number) {
  // SOI, an APP0 segment, then SOF0 carrying height/width.
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
}

function gifHeader(width: number, height: number) {
  return new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, width & 0xff, width >> 8, height & 0xff, height >> 8]);
}

type Route = { type: string; body: string | Uint8Array; finalUrl?: string };

function fakeFetcher(routes: Record<string, Route>) {
  const requested: string[] = [];
  const fetcher: HeroFetcher = async (url) => {
    requested.push(url);
    const route = routes[url];
    if (!route) return new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
    const response = new Response(route.body as BodyInit, { status: 200, headers: { 'content-type': route.type } });
    // Response.url is read-only; a followed redirect is modelled by overriding it.
    Object.defineProperty(response, 'url', { value: route.finalUrl ?? url });
    return response;
  };
  return { fetcher, requested };
}

const AGHA_MELBOURNE = buildEventProfile({
  name: 'AGHA GIFT FAIRS - MELBOURNE',
  city: 'Melbourne',
  country: 'Australia',
  startDate: '2026-08-01',
});
const AGHA_SYDNEY = buildEventProfile({ name: 'AGHA GIFT FAIRS - SYDNEY', city: 'Sydney', country: 'Australia', startDate: '2026-09-19' });

/** A candidate as the page would offer it — body image unless stated. */
function candidate(url: string, extra: Partial<ImageCandidate> = {}): ImageCandidate {
  return { url, source: 'body', text: '', ...extra };
}

const AGHA_HOME_HTML = `<html><head>
<meta property="og:image" content="https://agha.com.au/wp-content/uploads/2025/08/AGHA-share-card.jpg" />
</head><body>
<img src="https://agha.com.au/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9A02726-scaled-e1755235482167.jpg" alt="Buyers walking the aisles of the AGHA Melbourne Gift Fair">
</body></html>`;

describe('find shows hero image', () => {
  it('reads real pixel sizes from file headers', () => {
    expect(readImageInfo(jpegHeader(2560, 1707))).toEqual({ format: 'jpeg', width: 2560, height: 1707 });
    // The Eventseye venue thumbnail that was being stretched across the banner.
    expect(readImageInfo(gifHeader(160, 146))).toEqual({ format: 'gif', width: 160, height: 146 });
    expect(readImageInfo(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('only accepts large landscape photos', () => {
    expect(isUsableHeroImage({ format: 'jpeg', width: 2560, height: 1707 })).toBe(true);
    expect(isUsableHeroImage({ format: 'jpeg', width: 700, height: 467 })).toBe(false);
    expect(isUsableHeroImage({ format: 'gif', width: 1600, height: 900 })).toBe(false);
    expect(isUsableHeroImage({ format: 'png', width: 1600, height: 900 })).toBe(false); // usually a logo card
    expect(isUsableHeroImage({ format: 'jpeg', width: 1200, height: 2000 })).toBe(false);
  });

  it('extracts share images in priority order, resolved against the page', () => {
    const html = `<meta name="twitter:image" content="/tw.jpg"><meta content="https://x.test/og.jpg?a=1&amp;b=2" property="og:image">`;
    expect(extractShareImageUrls(html, 'https://x.test/events/a')).toEqual([
      'https://x.test/og.jpg?a=1&b=2',
      'https://x.test/tw.jpg',
    ]);
  });

  it('reads the image of a schema.org Event, including inside @graph', () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"Organization","logo":"/org-logo.jpg","image":"/org.jpg"},
        {"@type":"ExhibitionEvent","name":"Show","image":[{"@type":"ImageObject","url":"/hall-2026.jpg"}]}
      ]}</script>
      <script type="application/ld+json">not json</script>`;
    expect(extractEventSchemaImages(html, 'https://show.test/en/')).toEqual(['https://show.test/hall-2026.jpg']);
  });

  it('finds large lazy-loaded slider photos and skips logos, sponsors and small images', () => {
    const html = `
      <img src="/plugins/revslider/dummy.png" data-lazyload="//show.test/uploads/hall-wide.jpg" width="1920" height="900" alt="Background">
      <img src="data:image/png;base64,AAAA" data-src="http://show.test/uploads/لوگو-اصل.jpg" data-eio-rwidth="1309" alt="انجمن">
      <img src="/uploads/partner.jpg" class="sponsor-logo" width="1600">
      <img src="/uploads/thumb.jpg" width="300">
      <img srcset="/uploads/crowd-800.jpg 800w, /uploads/crowd-2048.jpg 2048w" alt="Visitors">
      <div style="background-image: url('/uploads/stage.webp')"></div>`;
    expect(extractBodyHeroImages(html, 'https://show.test/')).toEqual([
      'https://show.test/uploads/hall-wide.jpg',
      'http://show.test/uploads/%D9%84%D9%88%DA%AF%D9%88-%D8%A7%D8%B5%D9%84.jpg',
      'https://show.test/uploads/crowd-2048.jpg',
      'https://show.test/uploads/stage.webp',
    ]);
    // The Persian "original logo" passes the size hints, so the URL filter has to catch it.
    expect(isLogoLikeUrl('http://show.test/uploads/%D9%84%D9%88%DA%AF%D9%88-%D8%A7%D8%B5%D9%84.jpg')).toBe(true);
  });

  it('never uses theme stock photos, video thumbnails, or square textures and posters', async () => {
    const { fetcher, requested } = fakeFetcher({
      'https://fmc.test/': {
        type: 'text/html',
        body: `<style>.hero{background-image:url(/uploads/revetex-texture.jpg)}</style>
          <img src="https://fmc.test/wp-content/themes/fmc/assets/images/revetex-img1.webp" width="1330">
          <img src="https://img.youtube.com/vi/abc/maxresdefault.jpg" alt="Revetex 2026">
          <img src="https://fmc.test/uploads/revetex-poster.jpg" width="2180">`,
      },
      'https://fmc.test/uploads/revetex-poster.jpg': { type: 'image/jpeg', body: jpegHeader(2180, 2180) },
      'https://fmc.test/uploads/revetex-texture.jpg': { type: 'image/jpeg', body: jpegHeader(2000, 2000) },
    });
    // Every image names the event, so these are rejected for what they are, not for lack of evidence.
    const event = buildEventProfile({ name: 'REVETEX', city: 'Casablanca', country: 'Morocco', startDate: '2026-05-01' });
    await expect(resolveEventHeroImage('https://fmc.test/', { fetcher, event })).resolves.toBeNull();
    expect(requested.filter((url) => /themes|youtube/.test(url))).toEqual([]);
  });

  it("finds the page's preloaded hero and page-builder section backgrounds", () => {
    const html = `<link rel="preload" as="image" href="https://cdn.test/uploads/3O5A7545-scaled.jpg?lossy=2&#038;webp=1">
      <style>.et_pb_section_2{background-image:url(https://s.test/uploads/2027-COVER-hires.jpg)!important}</style>
      <img src="/images/gallery/hall_thumb.jpg">`;
    expect(extractPageImages(html, 'https://s.test/')).toEqual([
      'https://cdn.test/uploads/3O5A7545-scaled.jpg?lossy=2&webp=1',
      'https://s.test/images/gallery/hall_thumb.jpg',
      'https://s.test/uploads/2027-COVER-hires.jpg',
    ]);
  });

  it('ranks the Event schema image above share images above body photos', () => {
    const html = `<meta property="og:image" content="/og.jpg">
      <script type="application/ld+json">{"@type":"Event","image":"/event.jpg"}</script>
      <img src="/body.jpg" width="2000">`;
    expect(extractPageImages(html, 'https://s.test/')).toEqual([
      'https://s.test/event.jpg',
      'https://s.test/og.jpg',
      'https://s.test/body.jpg',
    ]);
  });

  it('uses a large page photo when the share image is too small', async () => {
    const { fetcher } = fakeFetcher({
      'https://fair.test/': {
        type: 'text/html',
        body: '<meta property="og:image" content="https://fair.test/og-small.jpg"><img data-src="https://fair.test/hall.jpg" width="2400" alt="Visitors at Prowinter in Bolzano">',
      },
      'https://fair.test/og-small.jpg': { type: 'image/jpeg', body: jpegHeader(600, 315) },
      'https://fair.test/hall.jpg': { type: 'image/jpeg', body: jpegHeader(2400, 1350) },
    });
    const event = buildEventProfile({ name: 'PROWINTER', city: 'Bolzano', country: 'Italy', startDate: '2027-01-10' });
    await expect(resolveEventHeroImage('https://fair.test/', { fetcher, event })).resolves.toEqual({
      url: 'https://fair.test/hall.jpg',
      width: 2400,
      height: 1350,
    });
  });

  it('tries the WordPress original before a resized or edited derivative', () => {
    expect(originalImageCandidates('https://s.test/wp-content/uploads/2025/08/photo-scaled-e1755235482167.jpg')).toEqual([
      'https://s.test/wp-content/uploads/2025/08/photo-scaled.jpg',
      'https://s.test/wp-content/uploads/2025/08/photo-scaled-e1755235482167.jpg',
    ]);
    expect(originalImageCandidates('https://s.test/wp-content/uploads/a/hall-700x467.webp')[0]).toBe(
      'https://s.test/wp-content/uploads/a/hall.webp'
    );
    expect(originalImageCandidates('https://s.test/img/hero.jpg')).toEqual(['https://s.test/img/hero.jpg']);
  });

  it('skips logo share cards', () => {
    expect(isLogoLikeUrl('https://cdn.test/sites/bett/media/logos/Bett-OG-Logo.png/fit-in/1200x630')).toBe(true);
    expect(isLogoLikeUrl('https://s.test/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9A02726-scaled.jpg')).toBe(false);
    expect(isLogoLikeUrl('https://s.test/wp-content/uploads/2026/09/ssbe-og-image-1200x630-1.jpg')).toBe(true);
    expect(isLogoLikeUrl('https://s.test/img/catalogue-hall.jpg')).toBe(false);
  });

  it('never fetches private hosts or Eventseye for the hero', () => {
    expect(isFetchableUrl('http://127.0.0.1/a')).toBe(false);
    expect(isFetchableUrl('http://192.168.1.2/a')).toBe(false);
    expect(isFetchableUrl('http://localhost:3000/a')).toBe(false);
    expect(isFetchableUrl('file:///etc/passwd')).toBe(false);
    expect(isFetchableUrl('https://agha.com.au/')).toBe(true);
    expect(heroSourcePages('https://www.eventseye.com/fairs/f-x.html')).toEqual([]);
    expect(heroSourcePages('http://agha.com.au/events/agha-melbourne-gift-fair')).toEqual([
      'http://agha.com.au/events/agha-melbourne-gift-fair',
      'https://agha.com.au/events/agha-melbourne-gift-fair',
      'http://agha.com.au/',
      'https://agha.com.au/',
    ]);
  });

  it('resolves the full-size official photo on a single-show site, falling back from an unreachable event page to the home page', async () => {
    const { fetcher } = fakeFetcher({
      'https://agha.com.au/': { type: 'text/html', body: AGHA_HOME_HTML },
      'https://agha.com.au/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9A02726-scaled.jpg': {
        type: 'image/jpeg',
        body: jpegHeader(2560, 1707),
      },
      'https://agha.com.au/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9A02726-scaled-e1755235482167.jpg': {
        type: 'image/jpeg',
        body: jpegHeader(700, 467),
      },
    });

    await expect(
      resolveEventHeroImage('http://agha.com.au/events/agha-melbourne-gift-fair', { fetcher, event: AGHA_MELBOURNE })
    ).resolves.toEqual({
      url: 'https://agha.com.au/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9A02726-scaled.jpg',
      width: 2560,
      height: 1707,
    });
  });

  it('returns null rather than a small image, so the page shows the gradient', async () => {
    const { fetcher } = fakeFetcher({
      'https://small.test/': { type: 'text/html', body: '<meta property="og:image" content="https://small.test/og.jpg">' },
      'https://small.test/og.jpg': { type: 'image/jpeg', body: jpegHeader(700, 467) },
    });
    await expect(resolveEventHeroImage('https://small.test/', { fetcher })).resolves.toBeNull();
    await expect(resolveEventHeroImage(null, { fetcher })).resolves.toBeNull();
  });

  describe('sites listing several shows', () => {
    const MEL_EVENT_HTML =
      '<img src="https://agha.com.au/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9B05027-scaled.jpg" alt="The AGHA Melbourne Gift Fair entrance">';
    const routes: Record<string, Route> = {
      'https://agha.com.au/': { type: 'text/html', body: AGHA_HOME_HTML },
      // Melbourne's listed URL redirects to its own page, with its own photo.
      'http://agha.com.au/events/agha-melbourne-gift-fair': {
        type: 'text/html',
        body: MEL_EVENT_HTML,
        finalUrl: 'https://agha.com.au/melbourne-gift-fair/',
      },
      'https://agha.com.au/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9B05027-scaled.jpg': {
        type: 'image/jpeg',
        body: jpegHeader(2560, 1707),
      },
      // Sydney's page redirects to the home page, whose image is Melbourne's.
      'http://agha.com.au/sydney-gift-fair': { type: 'text/html', body: AGHA_HOME_HTML, finalUrl: 'https://agha.com.au/' },
      'https://agha.com.au/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9A02726-scaled.jpg': {
        type: 'image/jpeg',
        body: jpegHeader(2560, 1707),
      },
    };

    it('uses the photo declared by the event page itself', async () => {
      const { fetcher } = fakeFetcher(routes);
      await expect(
        resolveEventHeroImage('http://agha.com.au/events/agha-melbourne-gift-fair', { fetcher, sharedSite: true, event: AGHA_MELBOURNE })
      ).resolves.toMatchObject({ url: 'https://agha.com.au/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9B05027-scaled.jpg' });
    });

    it("never gives one show another show's photo via the home page", async () => {
      const { fetcher } = fakeFetcher(routes);
      await expect(
        resolveEventHeroImage('http://agha.com.au/sydney-gift-fair', { fetcher, sharedSite: true, event: AGHA_SYDNEY })
      ).resolves.toBeNull();
      // Without the shared-site rule this is exactly the bug: the Melbourne photo's
      // alt says "AGHA", which looks like evidence, and Sydney gets it.
      await expect(resolveEventHeroImage('http://agha.com.au/sydney-gift-fair', { fetcher, event: AGHA_SYDNEY })).resolves.not.toBeNull();
    });

    it('rejects an event page that only repeats the site-wide default image', async () => {
      const { fetcher } = fakeFetcher({
        ...routes,
        'http://agha.com.au/brisbane': { type: 'text/html', body: AGHA_HOME_HTML },
      });
      await expect(
        resolveEventHeroImage('http://agha.com.au/brisbane', { fetcher, sharedSite: true, event: AGHA_MELBOURNE })
      ).resolves.toBeNull();
    });

    it('uses no photo when the home page is unreachable, since the default cannot be ruled out', async () => {
      const { 'https://agha.com.au/': _home, ...withoutHome } = routes;
      const { fetcher } = fakeFetcher(withoutHome);
      await expect(
        resolveEventHeroImage('http://agha.com.au/events/agha-melbourne-gift-fair', { fetcher, sharedSite: true, event: AGHA_MELBOURNE })
      ).resolves.toBeNull();
      // ...and says it couldn't check, so the miss is retried rather than cached for a week.
      await expect(
        resolveEventHeroImageResult('http://agha.com.au/events/agha-melbourne-gift-fair', { fetcher, sharedSite: true, event: AGHA_MELBOURNE })
      ).resolves.toEqual({ image: null, reachable: false });
    });

    it('tells a site that has no suitable photo apart from one that did not answer', async () => {
      const { fetcher } = fakeFetcher(routes);
      // Answered: Sydney's page is the home page, so there is definitively no Sydney photo.
      await expect(
        resolveEventHeroImageResult('http://agha.com.au/sydney-gift-fair', { fetcher, sharedSite: true, event: AGHA_SYDNEY })
      ).resolves.toEqual({ image: null, reachable: true });
      // Nothing answered (a slow or down single-show site).
      await expect(
        resolveEventHeroImageResult('http://down.test/expo', { fetcher: fakeFetcher({}).fetcher, event: AGHA_MELBOURNE })
      ).resolves.toEqual({ image: null, reachable: false });
      await expect(
        resolveEventHeroImageResult('http://agha.com.au/events/agha-melbourne-gift-fair', { fetcher, sharedSite: true, event: AGHA_MELBOURNE })
      ).resolves.toMatchObject({ reachable: true, image: { width: 2560 } });
    });

    it('rejects an image that another show on the site also declares (a page template)', async () => {
      const TEMPLATE = '<img src="https://faire.test/wp-content/uploads/makerfaire-hero-1920x568.jpg" alt="Makers at the Maker Faire">';
      const { fetcher } = fakeFetcher({
        'https://faire.test/': { type: 'text/html', body: '<meta property="og:image" content="https://faire.test/home.jpg">' },
        'https://faire.test/porto': { type: 'text/html', body: TEMPLATE },
        'https://faire.test/san-jose': { type: 'text/html', body: TEMPLATE },
        'https://faire.test/wp-content/uploads/makerfaire-hero.jpg': { type: 'image/jpeg', body: jpegHeader(1920, 568) },
      });
      const event = buildEventProfile({ name: 'MAKER FAIRE - PORTUGAL - PORTO', city: 'Porto', country: 'Portugal', startDate: '2026-09-18' });
      await expect(
        resolveEventHeroImage('https://faire.test/porto', { fetcher, sharedSite: true, siblingPages: ['https://faire.test/san-jose'], event })
      ).resolves.toBeNull();
      // Without the sibling comparison the shared template would be accepted — its alt names the faire.
      await expect(resolveEventHeroImage('https://faire.test/porto', { fetcher, sharedSite: true, event })).resolves.not.toBeNull();
    });

    it('uses no photo when no sibling page can be loaded to compare against', async () => {
      const { fetcher } = fakeFetcher(routes);
      await expect(
        resolveEventHeroImage('http://agha.com.au/events/agha-melbourne-gift-fair', {
          fetcher,
          sharedSite: true,
          siblingPages: ['http://agha.com.au/unreachable'],
          event: AGHA_MELBOURNE,
        })
      ).resolves.toBeNull();
    });

    it('skips a page that several shows list without fetching anything', async () => {
      const { fetcher, requested } = fakeFetcher(routes);
      await expect(
        resolveEventHeroImage('http://agha.com.au/events/agha-melbourne-gift-fair', { fetcher, sharedSite: true, sharedPage: true })
      ).resolves.toBeNull();
      expect(requested).toEqual([]);
    });

    it('indexes the catalog: editions are one show, listing pages are shared, siblings are other shows', () => {
      const context = buildHeroSiteIndex([
        { name: 'AGHA GIFT FAIRS - MELBOURNE', website: 'http://agha.com.au/events/agha-melbourne-gift-fair' },
        { name: 'AGHA GIFT FAIRS - SYDNEY', website: 'http://agha.com.au/sydney-gift-fair' },
        { name: 'BETT 2026', website: 'https://www.bettshow.com/' },
        { name: 'BETT 2027', website: 'https://bettshow.com/' },
        { name: 'MAKER FAIRE - PORTUGAL - PORTO', website: 'http://makerfaire.com/upcoming-faires' },
        { name: 'MAKER FAIRE - COSTA RICA - SAN JOSÉ', website: 'https://www.makerfaire.com/upcoming-faires/' },
        { name: '上海国际车展', website: 'https://shows.test/auto' },
        { name: '广州国际照明展', website: 'https://shows.test/light' },
      ]);

      expect(
        context({ name: 'AGHA GIFT FAIRS - MELBOURNE', website: 'http://agha.com.au/events/agha-melbourne-gift-fair' })
      ).toMatchObject({
        sharedSite: true,
        sharedPage: false,
        siblingPages: ['http://agha.com.au/sydney-gift-fair'],
      });
      expect(context({ name: 'BETT 2027', website: 'https://bettshow.com/' })).toMatchObject({
        sharedSite: false,
        sharedPage: false,
        siblingPages: [],
      });
      expect(context({ name: 'MAKER FAIRE - PORTUGAL - PORTO', website: 'http://makerfaire.com/upcoming-faires' }).sharedPage).toBe(true);
      // Non-Latin names stay distinct rather than all collapsing to one empty name.
      expect(context({ name: '上海国际车展', website: 'https://shows.test/auto' }).sharedSite).toBe(true);
    });
  });

  describe('event-specific evidence', () => {
    const PROWINTER = buildEventProfile({ name: 'PROWINTER', city: 'Bolzano', country: 'Italy', startDate: '2027-01-10' });

    it("accepts a page photo only on what the page says about it — alt text, caption or the heading above it", () => {
      expect(isEventSpecificImage(candidate('https://agha.com.au/uploads/A9B05027.jpg', { text: 'AGHA Melbourne Gift Fair entrance' }), AGHA_MELBOURNE)).toBe(true);
      expect(isEventSpecificImage(candidate('https://s.test/uploads/IMG_0042.jpg', { context: 'Buyers at Prowinter in Bolzano' }), PROWINTER)).toBe(true);
      // Heading/caption context is read from the page itself.
      const html = `<h2>Impressions of Prowinter</h2><figure><img src="https://s.test/uploads/DSC_0042.jpg" alt=""><figcaption>Opening day at the Prowinter halls</figcaption></figure>`;
      const [photo] = extractPageImageCandidates(html, 'https://s.test/');
      expect(photo.context).toBe('Opening day at the Prowinter halls | Impressions of Prowinter');
      expect(isEventSpecificImage(photo, PROWINTER)).toBe(true);
    });

    it('does not accept a heading alone — it names the page section, not the picture', () => {
      // A sponsorship card with a placeholder alt under the event's countdown heading.
      const html = `<h2>Count Down Till Prowinter</h2><img src="https://s.test/uploads/Untitled-2.jpg" alt="Untitled-2">
        <h2>About Prowinter</h2><img src="https://s.test/uploads/abstract.jpg" alt="">
        <h2>Impressions of Prowinter</h2><img src="https://s.test/uploads/DSC_7.jpg" alt="Ski buyers testing boots on the hall floor">`;
      const [sponsor, abstract, photo] = extractPageImageCandidates(html, 'https://s.test/');
      expect(isEventSpecificImage(sponsor, PROWINTER)).toBe(false);
      expect(isEventSpecificImage(abstract, PROWINTER)).toBe(false);
      // A real description of the photo plus the event heading above it does qualify.
      expect(isEventSpecificImage(photo, PROWINTER)).toBe(true);
    });

    it('never accepts a file-name match, or a year plus an "edition word" in the file name', () => {
      // These were accepted before the audit; 320 of 506 file-name matches were unrelated images.
      expect(isEventSpecificImage(candidate('https://agha.com.au/wp-content/uploads/2025/08/AGHA-MEL25-Turbo360-A9B05027-scaled.jpg'), AGHA_MELBOURNE)).toBe(false);
      expect(isEventSpecificImage(candidate('https://www.fierabolzano.it/uploads/seo/prowinter_visual_2027_small.jpg'), PROWINTER)).toBe(false);
      const worldbex = buildEventProfile({ name: 'WORLDBEX', city: 'Manila', country: 'Philippines', startDate: '2027-03-01' });
      expect(isEventSpecificImage(candidate('https://worldbex.com/wp-content/uploads/2026/08/2027-WB-EXPO-HIGHLIGHTS.jpg'), worldbex)).toBe(false);
      // Alt text that merely repeats an upload name is a file name, not a statement about the picture.
      const volta = buildEventProfile({ name: 'VOLTA BASEL', city: 'Basel', country: 'Switzerland', startDate: '2027-06-01' });
      expect(isEventSpecificImage(candidate('https://cdn.test/VOLTA+Basel+2025-465.jpg', { text: 'VOLTA Basel 2025-465.jpg' }), volta)).toBe(false);
      expect(isEventSpecificImage(candidate('https://cdn.test/a.jpg', { text: 'https://cdn.test/volta-basel-2027.jpg' }), volta)).toBe(false);
      expect(isMeaningfulImageText('AGHA-MEL25-Turbo360-A9B05027', 'https://agha.com.au/AGHA-MEL25-Turbo360-A9B05027.jpg')).toBe(false);
      expect(isMeaningfulImageText('Visitors at Volta Basel', 'https://cdn.test/1.jpg')).toBe(true);
    });

    it("never accepts schema.org or og/twitter share images — they are page-level graphics, not this event's photo", () => {
      const html = `<meta property="og:image" content="https://s.test/prowinter-2027.jpg"><meta property="og:image:alt" content="Prowinter 2027">
        <script type="application/ld+json">{"@type":"Event","name":"Prowinter","image":"/prowinter-event.jpg"}</script>`;
      const candidates = extractPageImageCandidates(html, 'https://s.test/');
      expect(candidates.map((c) => c.source)).toEqual(['schema', 'share']);
      for (const c of candidates) expect(isEventSpecificImage(c, PROWINTER)).toBe(false);
      // No event profile, or a name with no distinctive word: nothing can be tied to the event.
      expect(isEventSpecificImage(candidate('https://s.test/a.jpg', { text: 'Prowinter visitors' }), undefined)).toBe(false);
      const bogota = buildEventProfile({ name: 'FERIA INTERNACIONAL DE BOGOTA', city: 'Bogota', country: 'Colombia', startDate: '2026-09-22' });
      expect(isEventSpecificImage(candidate('https://s.test/a.jpg', { text: 'Feria Internacional de Bogota' }), bogota)).toBe(false);
    });

    it('rejects promotional graphics even when they name the event', () => {
      const promos: ImageCandidate[] = [
        candidate('https://s.test/uploads/prowinter-poster-2027.jpg', { text: 'Prowinter' }),
        candidate('https://s.test/uploads/key-visual-prowinter.jpg', { text: 'Prowinter' }),
        candidate('https://s.test/uploads/rrss-prowinter.webp', { text: 'Prowinter' }),
        candidate('https://s.test/uploads/web-banner.jpg', { text: 'Prowinter' }),
        candidate('https://s.test/uploads/save-the-date.jpg', { text: 'Prowinter' }),
        candidate('https://s.test/uploads/DSC_1.jpg', { text: 'Book your stand at Prowinter now' }),
        candidate('https://s.test/uploads/DSC_2.jpg', { text: 'Prowinter tickets on sale' }),
        candidate('https://s.test/uploads/DSC_3.jpg', { context: 'Download the Prowinter app | Google Play' }),
        // Exhibitor video invitations ("KRUGO invites you to MITEX") carry a play button and dates.
        candidate('https://s.test/upload/zsz3c6n.webp', { text: 'KRUGO приглашает на Prowinter 2027' }),
      ];
      for (const promo of promos) {
        expect(isPromotionalImage(promo), promo.url).toBe(true);
        expect(isEventSpecificImage(promo, PROWINTER), promo.url).toBe(false);
      }
      // A Bedrock WordPress path (/app/uploads/) is not an "app" promo.
      expect(isPromotionalImage(candidate('https://s.test/app/uploads/2026/03/DSC_9.jpg', { text: 'Prowinter hall' }))).toBe(false);
    });

    it('never shows a previous edition unlabelled, nor an image whose text contradicts the catalog edition', () => {
      // Catalog edition 2027: a photo captioned 2025 is a previous edition (registry only).
      expect(isEventSpecificImage(candidate('https://s.test/1.jpg', { text: 'Visitors at Prowinter 2025' }), PROWINTER)).toBe(false);
      expect(isEventSpecificImage(candidate('https://s.test/1.jpg', { context: 'Prowinter 2028 dates announced' }), PROWINTER)).toBe(false);
      // The catalog edition's own year is consistent, also next to an older one.
      expect(isEventSpecificImage(candidate('https://s.test/1.jpg', { text: 'Prowinter 2027 hall plan view' }), PROWINTER)).toBe(true);
      expect(isEventSpecificImage(candidate('https://s.test/1.jpg', { context: 'Prowinter 2027 builds on 2026' }), PROWINTER)).toBe(true);
      // The image's own year outranks a heading naming the catalog year.
      expect(isEventSpecificImage(candidate('https://s.test/1.jpg', { text: 'Prowinter 2025 hall', context: ' | Prowinter 2027' }), PROWINTER)).toBe(false);
      expect(isMeaningfulImageText('DSCF0237', 'https://s.test/1.jpg')).toBe(false);
    });

    it("treats an image that refuses to load when embedded on another site as unusable", async () => {
      const page = `<img src="https://hotlink.test/uploads/hall.jpg" alt="The Prowinter exhibition hall">`;
      const routes: Record<string, Route> = { 'https://hotlink.test/': { type: 'text/html', body: page } };
      const requests: Record<string, string | undefined>[] = [];
      const fetcher: HeroFetcher = async (url, init) => {
        requests.push(init.headers);
        if (url === 'https://hotlink.test/uploads/hall.jpg') {
          // Hotlink protection: only serves the image to its own site.
          if (init.headers.referer && !init.headers.referer.startsWith('https://hotlink.test')) return new Response('forbidden', { status: 403 });
          return new Response(jpegHeader(2400, 1350) as BodyInit, { status: 200, headers: { 'content-type': 'image/jpeg' } });
        }
        return fakeFetcher(routes).fetcher(url, init);
      };
      await expect(resolveEventHeroImage('https://hotlink.test/', { fetcher, event: PROWINTER })).resolves.toBeNull();
      expect(requests.some((headers) => headers.referer === HERO_EMBED_REFERER)).toBe(true);
    });

    it('records which shows resolved a photo, so a photo two different shows share is the hero of neither', () => {
      const claims = createHeroImageClaims();
      claims.claim('https://cdn.test/techshow.jpg', heroShowKey('BIG DATA & AI WORLD LONDON'));
      expect(claims.isShared('https://cdn.test/techshow.jpg')).toBe(false);
      // Two catalog records (or editions) of one show are one show.
      claims.claim('https://cdn.test/techshow.jpg', heroShowKey('Big Data & AI World London 2027'));
      expect(claims.isShared('https://cdn.test/techshow.jpg')).toBe(false);
      claims.claim('https://cdn.test/techshow.jpg', heroShowKey('CLOUD & CYBER SECURITY EXPO EUROPE - LONDON'));
      expect(claims.isShared('https://cdn.test/techshow.jpg')).toBe(true);
    });

    it('builds profiles from distinctive name words only — not places, generic words or words many shows share', () => {
      expect(AGHA_MELBOURNE.tokens).toContain('agha');
      expect(AGHA_MELBOURNE.tokens).not.toContain('melbourne');
      expect(AGHA_MELBOURNE.tokens).not.toContain('fairs');
      expect(AGHA_MELBOURNE.years).toEqual([2026, 2025, 2024]);

      const context = buildHeroSiteIndex([
        { name: 'HONG KONG BABY PRODUCTS FAIR', city: 'Hong Kong', country: 'Hong Kong' },
        { name: 'BABY EXPO MILANO', city: 'Milan', country: 'Italy' },
        { name: 'KIND + JUGEND BABY', city: 'Cologne', country: 'Germany' },
        { name: 'BABY & TODDLER SHOW', city: 'London', country: 'United Kingdom' },
      ]);
      // Four shows say "baby": a stock photo of a baby bottle is not evidence for any of them.
      expect(context({ name: 'HONG KONG BABY PRODUCTS FAIR', city: 'Hong Kong', country: 'Hong Kong' }).event.tokens).toEqual([]);
      expect(context({ name: 'KIND + JUGEND BABY', city: 'Cologne', country: 'Germany' }).event.tokens).toEqual(['kind', 'jugend']);
    });

    it('resolves to the gradient when nothing on the page can be tied to the event', async () => {
      const { fetcher, requested } = fakeFetcher({
        'https://balkanica.test/': {
          type: 'text/html',
          body: `<meta property="og:image" content="https://balkanica.test/images/home-2027.jpg">
            <img src="https://balkanica.test/uploads/model-flowers.jpg" width="3072">`,
        },
        'https://balkanica.test/images/home-2027.jpg': { type: 'image/jpeg', body: jpegHeader(3072, 2048) },
        'https://balkanica.test/uploads/model-flowers.jpg': { type: 'image/jpeg', body: jpegHeader(3072, 2048) },
      });
      const event = buildEventProfile({ name: 'WEDDING SOFIA EXPO', city: 'Sofia', country: 'Bulgaria', startDate: '2026-11-01' });
      await expect(resolveEventHeroImage('https://balkanica.test/', { fetcher, event })).resolves.toBeNull();
      // Rejected on the evidence alone — no image was even downloaded.
      expect(requested.filter((url) => /\.jpg$/.test(url))).toEqual([]);
    });
  });
});
