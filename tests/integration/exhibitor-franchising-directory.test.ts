/**
 * Regression tests for the Franchising Expo's combined Melbourne 2027 exhibitor directory
 * (https://www.franchisingexpo.com.au/expos/melbourne-2027/exhibitors), which lists two co-located catalog shows —
 * FRANCHISING & BUSINESS OPPORTUNITIES EXPO and START YOUR OWN BUSINESS EXPO — and badges the latter's exhibitors
 * with the SYOB Expo logo (<img src="/assets/img/SYOB-square-320.jpg" class="company-video-icon">).
 *
 * Before the fix, that badge — matching the name class "company" — was taken as the card's name element. With no
 * text in it, a badged card with no teaser was named by its whole text ("Levella Promotions Promotional Items Stand
 * E27"), a badged card with a teaser was dropped (its text is too long for a name), a badged card with no logo got
 * the badge as its logo, and both shows were given all of the list.
 *
 * TILES is a verbatim excerpt of the live page (20 of its 56 cards), fetched 2026-11-24.
 */
import { describe, expect, it } from 'vitest';
import { discoverExhibitors } from '@/lib/find-shows/exhibitor-discovery';
import { extractDirectoryPage, showInitials, splitByShowBadge } from '@/lib/find-shows/exhibitor-adapters/organizer-directory';
import type { EditionTarget } from '@/lib/find-shows/exhibitors';
import type { Fetched, Fetcher } from '@/lib/find-shows/floor-plan-discovery';

const TILES = `<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/aussie-photo-booths-supplies">
<div class="company-tile-inner">
<img src="/assets/img/placeholder-logo-trans.gif"/>
<div class="company-info-wrapper">
<img src="/assets/img/SYOB-square-320.jpg" class="company-video-icon"/>
<p class="company-list-title">Aussie Photo Booths &amp; Supplies</p>
<p class="company-list-stand">Stand E15</p>
<p class="company-list-teaser company-list-teaser-core"></p>
</div>
<p class="company-list-teaser-full company-list-teaser-core"></p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/battery-zone">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/battery-zone/_logoSquare/Battery-Zone-website.jpg"/>
<div class="company-info-wrapper">
<p class="company-list-title">Battery Zone</p>
<p class="company-list-industries">Automotive, Maintenance Services, Retail</p>
<p class="company-list-stand">Stand A18</p>
<p class="company-list-teaser company-list-teaser-core">If having the flexibility and freedom of being your own boss combined with all of the keys to business success taken care of sounds like a good plan, then becoming a Battery Zone franchisee could be a wonderful opportunity for you.
The type of person best suited to becoming a Battery Zone franchi...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">If having the flexibility and freedom of being your own boss combined with all of the keys to business success taken care of sounds like a good plan, then becoming a Battery Zone franchisee could be a wonderful opportunity for you.
The type of person best suited to becoming a Battery Zone franchi...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/black-optix-tint">
<div class="company-tile-inner">
<img src="/assets/img/placeholder-logo-trans.gif"/>
<div class="company-info-wrapper">
<p class="company-list-title">Black Optix Tint</p>
<p class="company-list-industries">Automotive</p>
<p class="company-list-stand">Stand A16</p>
<p class="company-list-teaser company-list-teaser-core">Black Optix Tint® is the fastest-growing window tinting and auto styling franchise, giving entrepreneurs a modern business opportunity in automotive tinting, paint protection film, ceramic coating, and commercial and residential window tinting. Backed by decades of experience and the global strength...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">Black Optix Tint® is the fastest-growing window tinting and auto styling franchise, giving entrepreneurs a modern business opportunity in automotive tinting, paint protection film, ceramic coating, and commercial and residential window tinting. Backed by decades of experience and the global strength...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/cfo">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/cfo/_logoSquare/CFO-on-Call-website.png"/>
<div class="company-info-wrapper">
<p class="company-list-title">CFO on Call</p>
<p class="company-list-industries">Business Services, Consultancy Services, Financial Services</p>
<p class="company-list-stand">Stand C36</p>
<p class="company-list-teaser company-list-teaser-core">The CFO On Call franchise offers a unique opportunity for CFOs and financial professionals to operate their own businesses, providing expert financial and accounting advisory services to small and medium-sized enterprises (SMEs). Over the last 30 years, we have accumulated a wealth of intellectual p...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">The CFO On Call franchise offers a unique opportunity for CFOs and financial professionals to operate their own businesses, providing expert financial and accounting advisory services to small and medium-sized enterprises (SMEs). Over the last 30 years, we have accumulated a wealth of intellectual p...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/cl-capital-finance">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/cl-capital-finance/_logoSquare/FullLogo.jpg"/>
<div class="company-info-wrapper">
<p class="company-list-title">CL Capital Finance</p>
<p class="company-list-industries">Banking, Business Broker, Business Services, Consultancy Services, Financial Services, Investment, Insurance, Shop &amp; Office Fitouts</p>
<p class="company-list-stand">Stand C46</p>
<p class="company-list-teaser company-list-teaser-core"></p>
</div>
<p class="company-list-teaser-full company-list-teaser-core"></p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/dominos-pizza">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/dominos-pizza/_logoSquare/Tile_For_Light_Border_RGB.png"/>
<div class="company-info-wrapper">
<p class="company-list-title">Domino&#039;s Pizza</p>
<p class="company-list-industries">Food &amp; Beverages</p>
<p class="company-list-stand">Stand B11</p>
<p class="company-list-teaser company-list-teaser-core">Domino&#039;s Pizza Enterprises Ltd (Domino&#039;s) is the largest pizza chain in Australia in terms of both network store numbers and network sales. It is also the largest franchisee for the Domino&#039;s Pizza brand in the world.
Domino&#039;s Pizza Enterprises now extends across 12 markets, with more than 3,800 s...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">Domino&#039;s Pizza Enterprises Ltd (Domino&#039;s) is the largest pizza chain in Australia in terms of both network store numbers and network sales. It is also the largest franchisee for the Domino&#039;s Pizza brand in the world.
Domino&#039;s Pizza Enterprises now extends across 12 markets, with more than 3,800 s...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/durks-cafe-eatery">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/durks-cafe-eatery/_logoSquare/470002220_607539948694709_577575079531016342_n-1.jpg"/>
<div class="company-info-wrapper">
<p class="company-list-title">Durk&#039;s Cafe + Eatery</p>
<p class="company-list-industries">Food &amp; Beverages</p>
<p class="company-list-stand">Stand B36</p>
<p class="company-list-teaser company-list-teaser-core">Durk’s Cafe + Eatery is a modern, vibrant café concept designed for today’s coffee and food lovers. We combine artisan coffee, fresh seasonal menus and genuine hospitality to create an experience customers return for time and again. Our stylish, welcoming spaces cater to breakfast, lunch, takeaway a...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">Durk’s Cafe + Eatery is a modern, vibrant café concept designed for today’s coffee and food lovers. We combine artisan coffee, fresh seasonal menus and genuine hospitality to create an experience customers return for time and again. Our stylish, welcoming spaces cater to breakfast, lunch, takeaway a...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/evergent-hq">
<div class="company-tile-inner">
<img src="/assets/img/placeholder-logo-trans.gif"/>
<div class="company-info-wrapper">
<p class="company-list-title">Evergent HQ</p>
<p class="company-list-industries">Financial Services</p>
<p class="company-list-stand">Stand B32</p>
<p class="company-list-teaser company-list-teaser-core"></p>
</div>
<p class="company-list-teaser-full company-list-teaser-core"></p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/exit-factor">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/exit-factor/_logoSquare/ExitFactor_Logo_1.png"/>
<div class="company-info-wrapper">
<p class="company-list-title">Exit Factor</p>
<p class="company-list-industries">Business Broker, Financial Services</p>
<p class="company-list-stand">Stand B8</p>
<p class="company-list-teaser company-list-teaser-core">Founded by Jessica Fialkovich, one of the top experts in the business consulting industry, Exit Factor knows that our business is only as strong as our business consulting team. We combine our decades of experience in the business consulting world with United Franchise Group’s nearly 40 years of fra...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">Founded by Jessica Fialkovich, one of the top experts in the business consulting industry, Exit Factor knows that our business is only as strong as our business consulting team. We combine our decades of experience in the business consulting world with United Franchise Group’s nearly 40 years of fra...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/franchise-ready">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/franchise-ready/_logoSquare/4.jpg"/>
<div class="company-info-wrapper">
<p class="company-list-title">Franchise Ready</p>
<p class="company-list-industries">Business Services, Consultancy Services</p>
<p class="company-list-stand">Stand B40</p>
<p class="company-list-teaser company-list-teaser-core">Franchise Ready: Unlocking the Potential of Your Business through Franchising
At Franchise Ready, we specialise in assisting business owners in scaling and expanding their ventures into highly valuable assets through the power of franchising. With our team of experts, we provide unwavering suppor...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">Franchise Ready: Unlocking the Potential of Your Business through Franchising
At Franchise Ready, we specialise in assisting business owners in scaling and expanding their ventures into highly valuable assets through the power of franchising. With our team of experts, we provide unwavering suppor...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/frandata">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/frandata/_logoSquare/Small-2020-5-star.JPG"/>
<div class="company-info-wrapper">
<p class="company-list-title">FRANdata</p>
<p class="company-list-industries">Business Services, Consultancy Services</p>
<p class="company-list-stand">Stand A35</p>
<p class="company-list-teaser company-list-teaser-core">FRANdata has an established track record of rating franchise systems.
We have built a set of standards to enable a consistent evaluation of Australian franchise systems. The foundation of these standards is the definition and measurement of what good performance looks like across seven standards. ...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">FRANdata has an established track record of rating franchise systems.
We have built a set of standards to enable a consistent evaluation of Australian franchise systems. The foundation of these standards is the definition and measurement of what good performance looks like across seven standards. ...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/kumon">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/kumon/_logoSquare/Logo-500x500-01.png"/>
<div class="company-info-wrapper">
<p class="company-list-title">Kumon</p>
<p class="company-list-industries">Children Products &amp; Services, Education &amp; Training</p>
<p class="company-list-stand">Stand A12</p>
<p class="company-list-teaser company-list-teaser-core">A Kumon franchise is a unique opportunity to make a positive difference for children in your community, while building a rewarding and profitable small business. Through Kumon franchise ownership, you will instruct students through the Kumon Mathematics and English programmes, create individualised ...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">A Kumon franchise is a unique opportunity to make a positive difference for children in your community, while building a rewarding and profitable small business. Through Kumon franchise ownership, you will instruct students through the Kumon Mathematics and English programmes, create individualised ...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/lawpath">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/lawpath/_logoSquare/Vertical-Blue.png"/>
<div class="company-info-wrapper">
<img src="/assets/img/SYOB-square-320.jpg" class="company-video-icon"/>
<p class="company-list-title">Lawpath</p>
<p class="company-list-industries">Accountancy, Business Services, Legal Services</p>
<p class="company-list-stand">Stand E28</p>
<p class="company-list-teaser company-list-teaser-core">Lawpath is the all-in-one platform for starting a business in Australia.
We bring your legal, tax, registry and compliance into one simple hub, with expert support whenever you need it, so you can stop stressing about the hard stuff and get on with building something great.
We exist to help mo...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">Lawpath is the all-in-one platform for starting a business in Australia.
We bring your legal, tax, registry and compliance into one simple hub, with expert support whenever you need it, so you can stop stressing about the hard stuff and get on with building something great.
We exist to help mo...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/levella-promotions">
<div class="company-tile-inner">
<img src="/assets/img/placeholder-logo-trans.gif"/>
<div class="company-info-wrapper">
<img src="/assets/img/SYOB-square-320.jpg" class="company-video-icon"/>
<p class="company-list-title">Levella Promotions</p>
<p class="company-list-industries">Promotional Items</p>
<p class="company-list-stand">Stand E27</p>
<p class="company-list-teaser company-list-teaser-core"></p>
</div>
<p class="company-list-teaser-full company-list-teaser-core"></p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/mathnasium">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/mathnasium/_logoSquare/Math-Logo-2.jpeg"/>
<div class="company-info-wrapper">
<p class="company-list-title">Mathnasium</p>
<p class="company-list-industries">Children Products &amp; Services, Education &amp; Training</p>
<p class="company-list-stand">Stand B5</p>
<p class="company-list-teaser company-list-teaser-core">Mathnasium is a leading international maths learning centre dedicated to helping students build confidence and strong foundational maths skills. Using the proven Mathnasium Method™, the program provides personalised learning plans tailored to each student’s needs, helping them truly understand maths...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">Mathnasium is a leading international maths learning centre dedicated to helping students build confidence and strong foundational maths skills. Using the proven Mathnasium Method™, the program provides personalised learning plans tailored to each student’s needs, helping them truly understand maths...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/myob">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/myob/_logoSquare/MYOB-websit.png"/>
<div class="company-info-wrapper">
<img src="/assets/img/SYOB-square-320.jpg" class="company-video-icon"/>
<p class="company-list-title">MYOB</p>
<p class="company-list-stand">Stand E31</p>
<p class="company-list-teaser company-list-teaser-core">The all-in-one mobile app for sole operators, freelancers, and the self-employed.
Solo is the assistant in your pocket. An all-in-one app that lets you managing admin, banking and payments in one place.
Come find us at the expo or keep a look out for comms on how to get a free 12-month subscri...</p>
</div>
<p class="company-list-teaser-full company-list-teaser-core">The all-in-one mobile app for sole operators, freelancers, and the self-employed.
Solo is the assistant in your pocket. An all-in-one app that lets you managing admin, banking and payments in one place.
Come find us at the expo or keep a look out for comms on how to get a free 12-month subscri...</p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/national-self-employment-association">
<div class="company-tile-inner">
<img src="/assets/img/placeholder-logo-trans.gif"/>
<div class="company-info-wrapper">
<img src="/assets/img/SYOB-square-320.jpg" class="company-video-icon"/>
<p class="company-list-title">National Self-Employment Association</p>
<p class="company-list-industries">Education &amp; Training</p>
<p class="company-list-stand">Stand E30</p>
<p class="company-list-teaser company-list-teaser-core"></p>
</div>
<p class="company-list-teaser-full company-list-teaser-core"></p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/operator-systems">
<div class="company-tile-inner">
<img src="/assets/img/placeholder-logo-trans.gif"/>
<div class="company-info-wrapper">
<img src="/assets/img/SYOB-square-320.jpg" class="company-video-icon"/>
<p class="company-list-title">Operator Systems</p>
<p class="company-list-industries">Business Software</p>
<p class="company-list-stand">Stand D10</p>
<p class="company-list-teaser company-list-teaser-core"></p>
</div>
<p class="company-list-teaser-full company-list-teaser-core"></p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/pivot-2-thrive">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/pivot-2-thrive/_logoSquare/Pivot2Thrive-Logo-1-04.png"/>
<div class="company-info-wrapper">
<img src="/assets/img/SYOB-square-320.jpg" class="company-video-icon"/>
<p class="company-list-title">Pivot 2 Thrive - Start Your Own AI Agency </p>
<p class="company-list-industries">Business Software, Marketing</p>
<p class="company-list-stand">Stand E18</p>
<p class="company-list-teaser company-list-teaser-core"></p>
</div>
<p class="company-list-teaser-full company-list-teaser-core"></p>
</div>
</a>  </div>
</div>
<div class="row">
<div class="col-md-12 company-tile">
<a href="https://www.franchisingexpo.com.au/directory/yes-today-media">
<div class="company-tile-inner">
<img src="/uploads/cloud-uploads/yes-today-media/_logoSquare/YTM_BlackBackground_Rectangle_Logo.png"/>
<div class="company-info-wrapper">
<img src="/assets/img/SYOB-square-320.jpg" class="company-video-icon"/>
<p class="company-list-title">Yes Today Media</p>
<p class="company-list-industries">Business Services, Education &amp; Training, Marketing, Photography, Websites</p>
<p class="company-list-stand">Stand E29</p>
<p class="company-list-teaser company-list-teaser-core"></p>
</div>
<p class="company-list-teaser-full company-list-teaser-core"></p>
</div>
</a>  </div>
</div>`;

const LIST_URL = 'https://www.franchisingexpo.com.au/expos/melbourne-2027/exhibitors';
const PAGE = `<html><head><title>Franchising Expo - Sydney, Melbourne, Brisbane, Perth</title></head><body>
<nav class="navbar"><a href="/expos/melbourne-2027">Melbourne</a><a href="/start-your-own-business">Start Your Own Business Expo</a></nav>
<div class="container"><p>7th - 8th August 2027 Melbourne</p><h1>Exhibitors</h1>
${TILES}
</div></body></html>`;

const FRANCHISING: EditionTarget = {
  name: 'FRANCHISING & BUSINESS OPPORTUNITIES EXPO - MELBOURNE',
  startDate: '2027-08-07',
  city: 'Melbourne',
  venue: 'Melbourne Exhibition & Convention Centre',
  website: 'http://www.franchisingexpo.com.au',
  coLocated: [{ name: 'START YOUR OWN BUSINESS EXPO - MELBOURNE', website: 'http://www.franchisingexpo.com.au/start-your-own-business' }],
};
const SYOB: EditionTarget = {
  ...FRANCHISING,
  name: 'START YOUR OWN BUSINESS EXPO - MELBOURNE',
  website: 'http://www.franchisingexpo.com.au/start-your-own-business',
  coLocated: [{ name: FRANCHISING.name, website: 'http://www.franchisingexpo.com.au' }],
};

const BADGED = ['Aussie Photo Booths & Supplies', 'Lawpath', 'Levella Promotions', 'MYOB', 'National Self-Employment Association', 'Operator Systems', 'Pivot 2 Thrive - Start Your Own AI Agency', 'Yes Today Media'];
const UNBADGED = ['Battery Zone', 'Black Optix Tint', 'CFO on Call', 'CL Capital Finance', "Domino's Pizza", "Durk's Cafe + Eatery", 'Evergent HQ', 'Exit Factor', 'Franchise Ready', 'FRANdata', 'Kumon', 'Mathnasium'];
const sorted = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b));

const page = () => extractDirectoryPage(PAGE, LIST_URL, 'franchisingexpo.com.au')!;

describe('Franchising Expo combined directory: names', () => {
  it('reads every card by its company-list-title, the badge never standing in for the name', () => {
    const { cards } = page();
    expect(sorted(cards.map((card) => card.name))).toEqual(sorted([...BADGED, ...UNBADGED]));
    // The six names stored before the fix had their industries and stand glued on.
    for (const garbled of [/Promotional Items/, /Education & Training/, /Business Software/, /Stand [A-Z]\d/, /Websites/, /Marketing/]) {
      expect(cards.filter((card) => garbled.test(card.name))).toEqual([]);
    }
  });

  it('keeps badged cards that have a teaser (MYOB and Lawpath were dropped before)', () => {
    const names = page().cards.map((card) => card.name);
    expect(names).toContain('MYOB');
    expect(names).toContain('Lawpath');
  });

  it('keeps each card’s stand, profile URL and own logo — never the shared badge or placeholder', () => {
    const byName = new Map(page().cards.map((card) => [card.name, card]));
    expect(byName.get('Levella Promotions')).toMatchObject({ booths: ['E27'], logoUrl: null, profileUrl: 'https://www.franchisingexpo.com.au/directory/levella-promotions' });
    expect(byName.get('Aussie Photo Booths & Supplies')).toMatchObject({ booths: ['E15'], logoUrl: null });
    expect(byName.get('Yes Today Media')?.logoUrl).toMatch(/YTM_BlackBackground_Rectangle_Logo\.png$/);
    expect(byName.get('Battery Zone')).toMatchObject({ booths: ['A18'], logoUrl: expect.stringMatching(/Battery-Zone-website\.jpg$/) });
    expect(page().cards.filter((card) => /SYOB-square|placeholder/.test(card.logoUrl ?? ''))).toEqual([]);
  });
});

describe('Franchising Expo combined directory: which show each card is', () => {
  it('names the shows by their initials, without the city', () => {
    expect(showInitials(SYOB.name, 'Melbourne')).toBe('syob');
    expect(showInitials(FRANCHISING.name, 'Melbourne')).toBe('fbo');
  });

  it('gives Start Your Own Business Expo its badged cards only', () => {
    const { cards, marks } = page();
    const result = splitByShowBadge(SYOB, cards, marks);
    expect(result.split).toEqual({ show: SYOB.name, badged: true });
    expect(sorted(result.cards.map((card) => card.name))).toEqual(sorted(BADGED));
  });

  it('gives the Franchising Expo the cards not badged as the co-located SYOB expo’s', () => {
    const { cards, marks } = page();
    const result = splitByShowBadge(FRANCHISING, cards, marks);
    expect(result.split).toEqual({ show: SYOB.name, badged: false });
    expect(sorted(result.cards.map((card) => card.name))).toEqual(sorted(UNBADGED));
  });

  it('leaves a list whole when its shared images name no co-located show', () => {
    const { cards, marks } = page();
    expect(splitByShowBadge({ ...FRANCHISING, coLocated: [] }, cards, marks)).toEqual({ cards, split: null });
    expect(splitByShowBadge({ ...FRANCHISING, coLocated: [{ name: 'MELBOURNE HOME SHOW', website: 'x' }] }, cards, marks).split).toBeNull();
  });
});

describe('Franchising Expo combined directory end to end', () => {
  const HOME = '<html><body><nav><a href="/expos/melbourne-2027/exhibitors">Exhibitors</a></nav><p>7th - 8th August 2027</p></body></html>';
  const routes: Record<string, string> = {
    'http://www.franchisingexpo.com.au': HOME,
    'http://www.franchisingexpo.com.au/start-your-own-business': HOME,
    [LIST_URL]: PAGE,
    'http://www.franchisingexpo.com.au/expos/melbourne-2027/exhibitors': PAGE,
  };
  const fetcher: Fetcher = async (url) => {
    const found = routes[url];
    const finalUrl = url === 'http://www.franchisingexpo.com.au/expos/melbourne-2027/exhibitors' ? LIST_URL : url;
    return { url: finalUrl, status: found === undefined ? 404 : 200, contentType: 'text/html', headers: {}, body: Buffer.from(found ?? ''), truncated: false } as Fetched;
  };
  const run = (target: EditionTarget) => discoverExhibitors(target, { fetcher, now: () => new Date('2026-11-24T08:00:00Z'), retryDelayMs: 0 });

  it('stores each event its own share of the combined list', async () => {
    const [franchising, syob] = await Promise.all([run(FRANCHISING), run(SYOB)]);
    expect(franchising.status).toBe('VERIFIED_LIST');
    expect(syob.status).toBe('VERIFIED_LIST');
    expect(sorted(franchising.exhibitors.map((card) => card.name))).toEqual(sorted(UNBADGED));
    expect(sorted(syob.exhibitors.map((card) => card.name))).toEqual(sorted(BADGED));
    // A stated total counts both shows: it is never passed on as one show's.
    expect(syob.total ?? null).toBeNull();
  });
});
