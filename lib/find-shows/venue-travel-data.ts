/**
 * Verified travel guides, one per venue. Every value below is taken from the
 * cited page (the venue's own visitor pages first, then the operator's or
 * hotel's official site); nothing is estimated. A field the sources do not
 * state is left out, and the panel shows only what is here.
 *
 * To add a venue: add a guide whose `match` names the catalog's venue string,
 * city and ISO country code, with a source on every item. The catalog's events
 * at that venue pick it up automatically.
 */
import type { TravelSource, VenueTravelGuide } from '@/types/venue-travel';

const MCEC_PLAN_YOUR_VISIT: TravelSource = {
  label: 'MCEC — Plan your visit',
  url: 'https://www.mcec.com.au/plan-your-visit',
};
const MCEC_ACCOMMODATION: TravelSource = {
  label: 'MCEC — Accommodation',
  url: 'https://www.mcec.com.au/plan-your-visit/accommodation',
};

const EXCEL_PUBLIC_TRANSPORT: TravelSource = {
  label: 'ExCeL London — Public transport',
  url: 'https://www.excel.london/visitor/getting-here/public-transport',
};
const EXCEL_GETTING_TO_VENUE: TravelSource = {
  label: 'ExCeL London — Getting to the venue (FAQ)',
  url: 'https://www.excel.london/faqs/getting-to-excel',
};
const EXCEL_INTERNATIONAL: TravelSource = {
  label: 'ExCeL London — International travel',
  url: 'https://www.excel.london/visitor/getting-here/international-travel',
};
const EXCEL_HOTELS_FAQ: TravelSource = {
  label: 'ExCeL London — Hotels FAQ',
  url: 'https://www.excel.london/faqs/hotels-faq',
};

export const VENUE_TRAVEL_GUIDES: readonly VenueTravelGuide[] = [
  {
    id: 'au-melbourne-mcec',
    // Trade shows use the Exhibition Centre, whose entrance is on Clarendon St (MCEC contact page).
    venue: {
      name: 'Melbourne Convention and Exhibition Centre',
      address: '2 Clarendon St, South Wharf VIC 3006, Australia',
    },
    match: {
      countryCode: 'AU',
      city: 'Melbourne',
      venueNames: ['Melbourne Exhibition & Convention Centre', 'Melbourne Convention and Exhibition Centre', 'MCEC'],
    },
    airports: [
      {
        place: { name: 'Melbourne Airport', mapHint: 'Victoria, Australia' },
        code: 'MEL',
        travelInfo:
          'MCEC is located 20 minutes from Melbourne Airport. Take a taxi or rideshare from your terminal to the Convention Centre Place entrance, or the SkyBus to Southern Cross Station, then the tram or a 10-minute walk to the Clarendon Street entrance.',
        sources: [
          { label: 'MCEC — Meet in Melbourne', url: 'https://www.mcec.com.au/meet-in-melbourne' },
          MCEC_PLAN_YOUR_VISIT,
        ],
      },
    ],
    buses: [
      {
        mode: 'bus',
        place: { name: 'Eighteen Pence Lane/Lorimer Street', mapHint: 'South Wharf VIC, Australia' },
        routes: ['237'],
        walking: 'A short 10-minute walk to the Convention Centre Place entrance',
        note: 'Route 237 runs from Southern Cross Station.',
        sources: [MCEC_PLAN_YOUR_VISIT],
      },
    ],
    publicTransport: [
      {
        mode: 'tram',
        place: { name: 'Stop 124A Casino/MCEC/Clarendon Street', mapHint: 'South Wharf VIC, Australia' },
        routes: ['96', '109', '12'],
        note: 'Outside the Clarendon Street entrance.',
        sources: [MCEC_PLAN_YOUR_VISIT],
      },
      {
        mode: 'tram',
        place: { name: 'Stop 1 Spencer St/Flinders St', mapHint: 'Melbourne VIC, Australia' },
        routes: ['70', '75', 'City Circle'],
        walking: 'Down Clarendon Street, generally a 5-minute walk',
        sources: [MCEC_PLAN_YOUR_VISIT],
      },
      {
        mode: 'train',
        place: { name: 'Southern Cross Station', mapHint: 'Melbourne VIC, Australia' },
        walking: 'About a 10-minute walk, or tram 96, 109 or 12 to stop 124A',
        note: 'The closest train station to MCEC.',
        sources: [MCEC_PLAN_YOUR_VISIT],
      },
    ],
    taxi: {
      points: [
        'Taxi rank and rideshare drop-off/pick-up point just outside the Convention Centre Place entrance.',
        'From the airport, taxis and rideshare can drop you at the Convention Centre Place entrance.',
      ],
      sources: [MCEC_PLAN_YOUR_VISIT],
    },
    hotels: [
      {
        place: { name: 'Pan Pacific Melbourne', address: '2 Convention Centre Place, South Wharf VIC 3006, Australia' },
        stars: 5,
        note: 'Directly connected to MCEC by a covered walkway (Melbourne Convention Centre, Level 1).',
        sources: [
          MCEC_ACCOMMODATION,
          { label: 'Pan Pacific Melbourne (official site)', url: 'https://www.panpacific.com/en/hotels-and-resorts/pp-melbourne.html' },
        ],
      },
      {
        place: { name: 'Novotel Melbourne South Wharf', address: '7 Convention Centre Place, South Wharf VIC 3006, Australia' },
        stars: 4,
        note: 'Directly connected to MCEC by a covered walkway (Melbourne Exhibition Centre, Ground).',
        sources: [
          MCEC_ACCOMMODATION,
          { label: 'Novotel Melbourne South Wharf (Accor)', url: 'https://all.accor.com/hotel/B064/index.en.shtml' },
        ],
      },
    ],
    verifiedOn: '2026-09-29',
  },
  {
    id: 'gb-london-excel',
    venue: { name: 'ExCeL London', address: 'Warehouse K, One Western Gateway, London E16 1XL, United Kingdom' },
    match: { countryCode: 'GB', city: 'London', venueNames: ['ExCeL', 'ExCeL London', 'Excel London'] },
    airports: [
      {
        place: { name: 'London City Airport', mapHint: 'London, United Kingdom' },
        code: 'LCY',
        travelInfo: 'The closest airport to ExCeL — a 15-minute walk, or a short journey by DLR, bus or taxi.',
        sources: [EXCEL_INTERNATIONAL],
      },
      {
        place: { name: 'Heathrow Airport', mapHint: 'London, United Kingdom' },
        code: 'LHR',
        travelInfo: 'Connects directly to ExCeL on the Elizabeth line in about 43 minutes.',
        sources: [EXCEL_GETTING_TO_VENUE],
      },
    ],
    // ExCeL's pages mention nearby bus stops but name no routes or stops.
    buses: [],
    publicTransport: [
      {
        mode: 'train',
        network: 'Elizabeth line',
        place: { name: 'Custom House station', mapHint: 'London, United Kingdom' },
        note: 'For the West entrance. Central London in about 15 minutes, Canary Wharf in 3.',
        sources: [EXCEL_PUBLIC_TRANSPORT],
      },
      {
        mode: 'light-rail',
        network: 'DLR',
        place: { name: 'Prince Regent DLR station', mapHint: 'London, United Kingdom' },
        note: 'For the East entrance and ICC London.',
        sources: [EXCEL_PUBLIC_TRANSPORT],
      },
      {
        mode: 'subway',
        network: 'London Underground',
        place: { name: 'Canning Town station', mapHint: 'London, United Kingdom' },
        walking: 'About a 20-minute walk',
        note: 'Or change to the DLR towards Beckton for Custom House or Prince Regent.',
        sources: [EXCEL_GETTING_TO_VENUE],
      },
    ],
    taxi: {
      points: [
        'Drop-off/pick-up point on Western Gateway at the west end of the venue, with accessible access to the West entrance.',
        'Taxi rank at the west of the venue, by the post box.',
      ],
      sources: [EXCEL_GETTING_TO_VENUE],
    },
    // ExCeL lists these as hotels very close to the venue; neither it nor the
    // brands publish a star rating, so none is shown.
    hotels: [
      {
        place: { name: 'Aloft London Excel', address: 'One Eastern Gateway, Royal Victoria Dock, London E16 1FR, United Kingdom' },
        note: 'Listed by ExCeL London as a hotel very close to the venue.',
        sources: [
          EXCEL_HOTELS_FAQ,
          { label: 'Aloft London Excel (Marriott)', url: 'https://www.marriott.com/en-us/hotels/lonal-aloft-london-excel/overview/' },
        ],
      },
      {
        place: { name: 'DoubleTree by Hilton London Excel', address: '2 Festoon Way, Royal Victoria Dock, London E16 1RH, United Kingdom' },
        note: 'Listed by ExCeL London as a hotel very close to the venue.',
        sources: [
          EXCEL_HOTELS_FAQ,
          { label: 'DoubleTree by Hilton London ExCeL (Hilton)', url: 'https://www.hilton.com/en/hotels/lonexdi-doubletree-london-excel/' },
        ],
      },
    ],
    verifiedOn: '2026-09-29',
  },
];
