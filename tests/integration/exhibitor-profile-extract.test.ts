import { describe, expect, it } from 'vitest';
import { extractCandidates, countChrome, decideProfile, normaliseCountry, domainMatchesName } from '@/scripts/lib/exhibitor-profile-extract.mjs';

const page = (body: string) => `<html><head></head><body>${body}</body></html>`;
const PAGE_URL = 'https://show.example-expo.com/exhibitors/acme-tools/';

/** Decide one page as if its host had many other, unrelated exhibitors. */
function decideAlone(html: string, companyName: string, others = 30) {
  const target = extractCandidates(html, { pageUrl: PAGE_URL, companyName });
  const filler = Array.from({ length: others }, (_, i) =>
    extractCandidates(page(`<a href="https://company${i}.com">company${i}.com</a>`), { pageUrl: PAGE_URL, companyName: `Company ${i}` }),
  );
  return decideProfile(target, countChrome([target, ...filler]), companyName);
}

describe('normaliseCountry', () => {
  it('maps ISO codes, English names and local aliases to the stored form', () => {
    expect(normaliseCountry('DE')).toBe('Germany');
    expect(normaliseCountry('gb')).toBe('United Kingdom');
    expect(normaliseCountry('Deutschland')).toBe('Germany');
    expect(normaliseCountry('USA')).toBe('United States');
    expect(normaliseCountry('Turkey')).toBe('Türkiye');
    expect(normaliseCountry('United Arab Emirates')).toBe('United Arab Emirates');
  });
  it('rejects cities, regions and free text instead of guessing', () => {
    expect(normaliseCountry('London')).toBeNull();
    expect(normaliseCountry('Europe')).toBeNull();
    expect(normaliseCountry('Hall 3, Stand B12')).toBeNull();
    expect(normaliseCountry('')).toBeNull();
  });
});

describe('domainMatchesName', () => {
  it('matches a name word or initials in the domain', () => {
    expect(domainMatchesName('acme-tools.de', 'ACME Tools GmbH')).toBe(true);
    expect(domainMatchesName('ibm.com', 'International Business Machines')).toBe(true);
    expect(domainMatchesName('randomsite.com', 'ACME Tools GmbH')).toBe(false);
  });
});

describe('website', () => {
  it('accepts a link whose text is its own domain (WordPress directories)', () => {
    const html = page(`<p>Contact</p><a href="https://www.accessibilitycloud.com/">www.accessibilitycloud.com</a>`);
    expect(decideAlone(html, 'Accessibility Cloud').website).toBe('https://www.accessibilitycloud.com');
  });
  it('accepts a link labelled as the website even when the domain differs from the name', () => {
    const html = page(`<a href="https://brandx.io" title="Website">Visit website</a>`);
    expect(decideAlone(html, 'Totally Different Name Ltd').website).toBe('https://brandx.io');
  });
  it('rejects an unlabelled link to an unrelated site (a link in the description)', () => {
    const html = page(`<p>We partner with <a href="https://partner-org.org">our partner</a>.</p>`);
    expect(decideAlone(html, 'Acme Tools').website).toBeNull();
  });
  it('rejects social, maps and the directory itself', () => {
    const html = page(`<a href="https://www.linkedin.com/company/acme">LinkedIn</a>
      <a href="https://maps.google.com/?q=acme">Map</a>
      <a href="https://show.example-expo.com/visit">Website</a>`);
    expect(decideAlone(html, 'Acme').website).toBeNull();
  });
  it('drops site chrome: a labelled link that appears on every exhibitor page', () => {
    const chromeLink = `<a href="https://organiser-group.com" title="Website">Organiser website</a>`;
    const pages = Array.from({ length: 30 }, (_, i) =>
      extractCandidates(page(`${chromeLink}<a href="https://firm${i}.com">firm${i}.com</a>`), { pageUrl: PAGE_URL, companyName: `Firm ${i}` }),
    );
    const chrome = countChrome(pages);
    expect(decideProfile(pages[0], chrome).website).toBe('https://firm0.com');
  });
  it('returns nothing when two different strong sites compete', () => {
    const html = page(`<a href="https://acme.com">acme.com</a><a href="https://other-acme.net">other-acme.net</a>`);
    expect(decideAlone(html, 'Acme').website).toBeNull();
  });
});

describe('country', () => {
  it('reads JSON-LD Organization address (Messe Düsseldorf vis pages)', () => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Reverberi Srl',
      url: 'https://www.reverberisrl.com',
      address: { '@type': 'PostalAddress', addressCountry: 'IT' },
    });
    const html = page(`<script type="application/ld+json">${ld}</script>`);
    const d = decideAlone(html, 'Reverberi Srl');
    expect(d.country).toBe('Italy');
    expect(d.website).toBe('https://www.reverberisrl.com');
  });
  it('reads a labelled field', () => {
    expect(decideAlone(page(`<dl><dt>Country</dt><dd>Japan</dd></dl>`), 'Acme').country).toBe('Japan');
    expect(decideAlone(page(`<span>Land:</span> <span>Österreich</span>`), 'Acme').country).toBe('Austria');
  });
  it('reads MapYourShow addressValues, and ignores other "country" JSON on the page', () => {
    const html = page(`<script>var show = {"COUNTRY":"United States"};
      data: function(){ return { exhid: "1", addressValues: {"ZIP":"","CITY":"Ningbo","COUNTRY":"China","STATE":""} } }</script>`);
    expect(decideAlone(html, 'Acme').country).toBe('China');
    const empty = page(`<script>var show = {"COUNTRY":"United States"}; addressValues: {"CITY":"","COUNTRY":""}</script>`);
    expect(decideAlone(empty, 'Acme').country).toBeNull();
  });
  it('ignores the directory organiser JSON-LD for another company', () => {
    const ld = JSON.stringify({ '@type': 'Organization', name: 'Messe Düsseldorf GmbH', address: { addressCountry: 'DE' } });
    expect(decideAlone(page(`<script type="application/ld+json">${ld}</script>`), 'Reverberi Srl').country).toBeNull();
  });
});

describe('contacts', () => {
  it('reads a company LinkedIn page, phone and description', () => {
    const html = `<html><head><meta name="description" content="Acme Tools makes precision torque wrenches for aerospace assembly lines."></head><body>
      <a href="https://uk.linkedin.com/company/acme-tools/?trk=x">LinkedIn</a><a href="tel:+44 20 3475 4463">Call</a></body></html>`;
    const d = decideAlone(html, 'Acme Tools');
    expect(d.linkedin).toBe('https://www.linkedin.com/company/acme-tools');
    expect(d.phone).toBe('+44 20 3475 4463');
    expect(d.description).toMatch(/torque wrenches/);
  });
  it('rejects template placeholder phones', () => {
    for (const fake of ['(000) 000-0000', '123-456-7890', '1111111111']) {
      expect(decideAlone(page(`<a href="tel:${fake}">Call</a>`), 'Acme').phone).toBeNull();
    }
  });
  it('ignores personal LinkedIn profiles and non-phone numbers', () => {
    const html = page(`<a href="https://www.linkedin.com/in/jane-doe">Jane</a><span>Tel:</span> <span>4.30-4.40</span>`);
    const d = decideAlone(html, 'Acme');
    expect(d.linkedin).toBeNull();
    expect(d.phone).toBeNull();
  });
  it("drops the organiser's LinkedIn repeated on every exhibitor page, and templated blurbs", () => {
    const pages = Array.from({ length: 25 }, (_, i) =>
      extractCandidates(
        `<html><head><meta name="description" content="Visit Firm${i} at stand B${i} during the show this year in hall 2."></head><body>
         <a href="https://www.linkedin.com/company/the-show">Show</a><a href="https://www.linkedin.com/company/firm${i}">Firm</a></body></html>`,
        { pageUrl: PAGE_URL, companyName: `Firm${i}` },
      ),
    );
    const d = decideProfile(pages[4], countChrome(pages), 'Firm4');
    expect(d.linkedin).toBe('https://www.linkedin.com/company/firm4');
    expect(d.description).toBeNull();
  });
});

describe('own-site fallbacks', () => {
  it("takes a company's apple-touch-icon as its logo when nothing better is marked", () => {
    const html = `<html><head><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"></head><body></body></html>`;
    expect(decideAlone(html, 'Breg').logo).toBe('https://show.example-expo.com/apple-touch-icon.png');
  });
  it('drops a touch icon repeated on every directory page', () => {
    const pages = Array.from({ length: 25 }, (_, i) =>
      extractCandidates(`<html><head><link rel="apple-touch-icon" href="/dir-icon.png"></head><body></body></html>`, { pageUrl: PAGE_URL, companyName: `Firm${i}` }),
    );
    expect(decideProfile(pages[0], countChrome(pages)).logo).toBeNull();
  });
  it('uses the first prose paragraph naming the company when there is no meta description', () => {
    const html = page(`<p>Cookie settings</p><p>Breg is an orthopedic company that develops bracing, cold therapy and post-surgical recovery products for patients.</p>`);
    expect(decideAlone(html, 'Breg').description).toMatch(/^Breg is an orthopedic company/);
    expect(decideAlone(page(`<p>We make many great things for many people in many countries around the world, every day.</p>`), 'Breg').description).toBeNull();
  });
});

describe('logo', () => {
  it('treats a show logo with a per-page cache-buster as one repeated logo', () => {
    const pages = Array.from({ length: 25 }, (_, i) =>
      extractCandidates(page(`<img class="logo" src="/mys_shared/SHOW/SHOW_logo.png?breakcache=${i}x${i}">`), { pageUrl: PAGE_URL, companyName: `Firm${i}` }),
    );
    expect(decideProfile(pages[0], countChrome(pages)).logo).toBeNull();
  });
  it('prefers an image named after the company, and drops the show logo repeated on every page', () => {
    const showLogo = `<img class="site-logo" src="/img/show-logo.png">`;
    const pages = Array.from({ length: 25 }, (_, i) =>
      extractCandidates(page(`${showLogo}<img alt="Firm${i} logo" src="/uploads/firm${i}.png">`), { pageUrl: PAGE_URL, companyName: `Firm${i}` }),
    );
    expect(decideProfile(pages[3], countChrome(pages)).logo).toBe('https://show.example-expo.com/uploads/firm3.png');
  });
});
