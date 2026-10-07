import { describe, expect, it } from 'vitest';
import airportData from '../../data/airports.json';
import { nearestAirports, type AirportRecord } from '../../lib/find-shows/airports';
import {
  buildOverpassQuery,
  buildSectionsFromOsm,
  classifyRail,
  distanceMeters,
  formatDistance,
  osmAddress,
  parseStars,
  type OsmElement,
} from '../../lib/find-shows/osm-travel';
import {
  isAddressMatch,
  isVenueMatch,
  VENUE_NAME_MATCH,
  venueAddressQuery,
  venueNameScore,
  venueQueryVariants,
} from '../../lib/find-shows/venue-geocode';
import { mapDirectionsUrl, mergeVenueGuide } from '../../lib/find-shows/venue-travel';
import { VENUE_TRAVEL_GUIDES } from '../../lib/find-shows/venue-travel-data';
import type { TravelInfo } from '../../types/venue-travel';

const VENUE = { lat: 48.8287, lng: 2.289 };
// ~111 m per 0.001° of latitude.
const north = (meters: number) => VENUE.lat + meters / 111_320;

let nextId = 1;
const node = (metersNorth: number, tags: Record<string, string>): OsmElement => ({
  type: 'node',
  id: nextId++,
  lat: north(metersNorth),
  lon: VENUE.lng,
  tags,
});

describe('distances and tags', () => {
  it('measures and labels straight-line distance', () => {
    expect(Math.abs(distanceMeters(VENUE, { lat: north(1000), lng: VENUE.lng }) - 1000)).toBeLessThan(5);
    expect(formatDistance(234)).toBe('230 m straight-line');
    expect(formatDistance(3456)).toBe('3.5 km straight-line');
    expect(formatDistance(23_456)).toBe('23 km straight-line');
  });

  it('reads only whole 3-5 star ratings', () => {
    expect(parseStars('4')).toBe(4);
    expect(parseStars('5.0')).toBe(5);
    expect(parseStars('4S')).toBe(4);
    expect(parseStars('3.5')).toBeUndefined();
    expect(parseStars('2')).toBeUndefined();
    expect(parseStars(undefined)).toBeUndefined();
  });

  it('builds an address only when a street is tagged', () => {
    expect(osmAddress({ 'addr:housenumber': '8', 'addr:street': 'Rue X', 'addr:postcode': '75015', 'addr:city': 'Paris' })).toBe(
      '8 Rue X, 75015 Paris'
    );
    expect(osmAddress({ 'addr:city': 'Paris' })).toBeNull();
  });

  it('classifies rail stations by mode', () => {
    expect(classifyRail({ railway: 'tram_stop' })).toBe('tram');
    expect(classifyRail({ railway: 'station', station: 'subway' })).toBe('subway');
    expect(classifyRail({ public_transport: 'station', light_rail: 'yes' })).toBe('light-rail');
    expect(classifyRail({ railway: 'station' })).toBe('train');
    // A bus-only public_transport=station is not rail.
    expect(classifyRail({ public_transport: 'station', bus: 'yes' })).toBeNull();
    expect(classifyRail({ highway: 'bus_stop' })).toBeNull();
  });

  it('queries every category around the venue in one request', () => {
    const query = buildOverpassQuery(VENUE);
    for (const part of ['bus_stop', 'bus_station', 'tram_stop', 'public_transport', 'taxi', 'tourism"="hotel']) {
      expect(query).toContain(part);
    }
    expect(query).toContain('48.828700,2.289000');
  });
});

describe('buildSectionsFromOsm', () => {
  const elements: OsmElement[] = [
    node(100, { highway: 'bus_stop', name: 'Porte de Versailles', route_ref: '39;80' }),
    node(120, { highway: 'bus_stop', name: 'Porte de Versailles' }),
    node(300, { highway: 'bus_stop' }),
    node(900, { highway: 'bus_stop', name: 'Too far' }),
    node(200, { railway: 'tram_stop', name: 'Porte de Versailles', route_ref: 'T2;T3a' }),
    node(250, { railway: 'station', station: 'subway', name: 'Porte de Versailles', network: 'Métro de Paris', line: '12' }),
    node(260, { public_transport: 'station', subway: 'yes', name: 'Porte de Versailles' }),
    node(700, { railway: 'station', station: 'subway', name: 'Convention' }),
    node(800, { railway: 'station', station: 'subway', name: 'Vaugirard' }),
    node(150, { amenity: 'taxi', name: 'Station de taxis' }),
    ...[5, 5, 5, 5].map((stars, index) => node(500 + index * 100, { tourism: 'hotel', name: `Palace ${index}`, stars: String(stars) })),
    node(400, { tourism: 'hotel', name: 'Hotel Four', stars: '4', 'addr:street': 'Rue Y', 'addr:housenumber': '2' }),
    node(450, { tourism: 'hotel', name: 'Hotel Unrated' }),
    node(5_000, { tourism: 'hotel', name: 'Out of range', stars: '3' }),
  ];
  const sections = buildSectionsFromOsm(elements, { venue: VENUE, mapHint: 'Paris, France' });

  it('lists named bus stops within walking range, once each, with their routes', () => {
    expect(sections.buses.map((stop) => stop.place.name)).toEqual(['Porte de Versailles']);
    expect(sections.buses[0].routes).toEqual(['39', '80']);
    expect(sections.buses[0].distance).toBe('100 m straight-line');
  });

  it('lists rail by mode, at most two per mode, one per station name', () => {
    const summary = sections.publicTransport.map((stop) => `${stop.mode}:${stop.place.name}`);
    expect(summary).toEqual(['tram:Porte de Versailles', 'subway:Porte de Versailles', 'subway:Convention']);
    expect(sections.publicTransport[1]).toMatchObject({ network: 'Métro de Paris', routes: ['12'] });
  });

  it('lists taxi ranks near the venue', () => {
    expect(sections.taxi?.points[0]).toBe('Taxi rank: Station de taxis — 150 m straight-line from the venue.');
  });

  it('groups hotels by stars, at most 3 per group, nearest first, within range', () => {
    expect(sections.hotels.filter((hotel) => hotel.stars === 5).map((hotel) => hotel.place.name)).toEqual([
      'Palace 0',
      'Palace 1',
      'Palace 2',
    ]);
    const four = sections.hotels.find((hotel) => hotel.stars === 4);
    expect(four?.place).toMatchObject({ name: 'Hotel Four', address: '2 Rue Y' });
    const unrated = sections.hotels.find((hotel) => !hotel.stars);
    expect(unrated?.place).toMatchObject({ name: 'Hotel Unrated', mapHint: 'Paris, France' });
    expect(sections.hotels.some((hotel) => hotel.place.name === 'Out of range')).toBe(false);
  });


});

describe('nearestAirports', () => {
  const record = (iata: string, metersNorth: number, size: 'large' | 'medium'): AirportRecord => ({
    iata,
    name: `${iata} Airport`,
    city: 'Somewhere',
    country: 'FR',
    lat: north(metersNorth),
    lng: VENUE.lng,
    size,
    ref: `LF${iata}`,
  });

  it('offers the nearest hubs plus a closer city airport, nearest first, within range', () => {
    const picked = nearestAirports(
      [
        record('HB1', 40_000, 'large'),
        record('HB2', 60_000, 'large'),
        record('CTY', 8_000, 'medium'),
        record('MED', 50_000, 'medium'),
        record('FAR', 250_000, 'large'),
      ],
      VENUE
    );
    expect(picked.map((airport) => airport.code)).toEqual(['CTY', 'HB1', 'HB2']);
    expect(picked[0]).toMatchObject({ city: 'Somewhere', distance: '8.0 km straight-line' });
    expect(picked[0].place).toMatchObject({ mapHint: 'Somewhere, FR' });
    expect(picked[0].sources[0].url).toBe('https://ourairports.com/airports/LFCTY/');
  });

  it('returns nothing rather than a far-away airport', () => {
    expect(nearestAirports([record('FAR', 250_000, 'large')], VENUE)).toEqual([]);
  });

  it('finds the real airports for real venues from the bundled data', () => {
    const data = airportData as AirportRecord[];
    const codes = (at: { lat: number; lng: number }) => nearestAirports(data, at).map((airport) => airport.code);
    expect(codes({ lat: -37.8257, lng: 144.9539 })).toContain('MEL'); // MCEC (Essendon, closer, is listed first)
    expect(codes({ lat: 51.5081, lng: 0.0297 })).toContain('LCY'); // ExCeL
    expect(codes({ lat: 51.5081, lng: 0.0297 })).toContain('LHR');
    expect(codes({ lat: 4.6305, lng: -74.0887 })[0]).toBe('BOG'); // Corferias
    // No seaplane bases or heliports in the data at all.
    expect(data.some((airport) => airport.iata === 'NYS')).toBe(false);
  });
});

describe('venue geocoding guards', () => {
  it('tries the full name, then simpler spellings', () => {
    expect(venueQueryVariants('Tokyo International Exhibition Center (Tokyo Big Sight)')).toEqual([
      'Tokyo International Exhibition Center (Tokyo Big Sight)',
      'Tokyo International Exhibition Center',
      'Tokyo Big Sight',
    ]);
    expect(venueQueryVariants('Corferias - Centro de Convenciones')).toContain('Corferias');
    expect(venueQueryVariants('Melbourne Exhibition & Convention Centre')).toContain(
      'Melbourne Exhibition and Convention Centre'
    );
  });

  it('matches a venue name to the map spelling regardless of word order', () => {
    expect(venueNameScore('Melbourne Exhibition & Convention Centre', 'Melbourne Convention and Exhibition Centre')).toBe(1);
    expect(venueNameScore('Jacob K. Javits Convention Center', 'Javits Center')).toBeGreaterThanOrEqual(VENUE_NAME_MATCH);
    // Sharing only generic words is not a match.
    expect(venueNameScore('Convention Centre', 'Sydney Convention Centre')).toBe(0);
    expect(venueNameScore('ICC Sydney', 'Melbourne Convention and Exhibition Centre')).toBeLessThan(VENUE_NAME_MATCH);
  });

  it('turns a scraped venue address into a street query', () => {
    expect(
      venueAddressQuery(
        'Melbourne Exhibition & Convention Centre, 2 Clarendon Street, Southbank, Melbourne, Victoria, Australia, 3205',
        'Melbourne Exhibition & Convention Centre'
      )
    ).toBe('2 Clarendon Street, Southbank, Melbourne, Victoria, Australia, 3205');
    expect(venueAddressQuery('Paris, France', 'X')).toBeNull();
    expect(venueAddressQuery(null, 'X')).toBeNull();
  });

  const result = (category: string, type: string, rank = 30) => ({
    lat: '0',
    lon: '0',
    display_name: 'x',
    category,
    type,
    place_rank: rank,
  });

  it('rejects bus stops, hotels and areas that only share the venue’s words', () => {
    expect(isVenueMatch(result('amenity', 'exhibition_centre'), 'Paris Expo')).toBe(true);
    expect(isVenueMatch(result('highway', 'bus_stop'), 'Tokyo Big Sight')).toBe(false);
    expect(isVenueMatch(result('tourism', 'hotel'), 'Dubai World Trade Centre')).toBe(false);
    expect(isVenueMatch(result('tourism', 'hotel'), 'JW Marriott Hotel, Bogota')).toBe(true);
    expect(isVenueMatch(result('place', 'city', 16), 'Anything')).toBe(false);
    expect(isAddressMatch(result('highway', 'residential', 26))).toBe(true);
    expect(isAddressMatch(result('place', 'city', 16))).toBe(false);
  });
});

describe('official venue data over map data', () => {
  const mapInfo: TravelInfo = {
    venue: { name: 'Melbourne Exhibition & Convention Centre', coordinates: { lat: -37.8255, lng: 144.953 } },
    reference: 'venue',
    airports: [{ place: { name: 'Essendon Fields Airport' }, code: 'MEB', sources: [{ label: 'OSM', url: 'https://osm/1' }] }],
    buses: [],
    publicTransport: [],
    hotels: [
      { place: { name: 'Pan Pacific Melbourne' }, stars: 5, sources: [{ label: 'OSM', url: 'https://osm/2' }] },
      { place: { name: 'Crown Towers' }, stars: 5, sources: [{ label: 'OSM', url: 'https://osm/3' }] },
      { place: { name: 'A 3-star' }, stars: 3, sources: [{ label: 'OSM', url: 'https://osm/4' }] },
    ],
    notices: [],
    attribution: [],
  };
  const mcec = VENUE_TRAVEL_GUIDES.find((guide) => guide.id === 'au-melbourne-mcec')!;
  const merged = mergeVenueGuide(mapInfo, mcec);

  it('uses the venue’s own sections where it has them, and keeps map coordinates', () => {
    expect(merged.airports.map((airport) => airport.code)).toEqual(['MEL']);
    expect(merged.venue.coordinates).toEqual(mapInfo.venue.coordinates);
    expect(merged.venue.address).toBe(mcec.venue.address);
  });

  it('lists the venue’s hotels first, drops map duplicates, and fills other groups from the map', () => {
    const five = merged.hotels.filter((hotel) => hotel.stars === 5).map((hotel) => hotel.place.name);
    expect(five).toEqual(['Pan Pacific Melbourne', 'Crown Towers']);
    expect(merged.hotels.filter((hotel) => hotel.place.name === 'Pan Pacific Melbourne')).toHaveLength(1);
    expect(merged.hotels.find((hotel) => hotel.stars === 3)?.place.name).toBe('A 3-star');
  });

  it('treats differently spelled records of the same hotel as one, citing both', () => {
    const excel = VENUE_TRAVEL_GUIDES.find((guide) => guide.id === 'gb-london-excel')!;
    const withMapTwin = mergeVenueGuide(
      {
        ...mapInfo,
        hotels: [
          {
            place: { name: 'DoubleTree by Hilton Hotel London Excel', coordinates: { lat: 51.5, lng: 0.02 } },
            stars: 4,
            distance: '600 m straight-line',
            sources: [{ label: 'OpenStreetMap', url: 'https://osm/9' }],
          },
        ],
      },
      excel
    );
    const doubletree = withMapTwin.hotels.filter((hotel) => /doubletree/i.test(hotel.place.name));
    expect(doubletree).toHaveLength(1);
    expect(doubletree[0]).toMatchObject({ stars: 4, distance: '600 m straight-line' });
    expect(doubletree[0].place.name).toBe('DoubleTree by Hilton London Excel');
    expect(doubletree[0].sources.map((source) => source.url)).toContain('https://osm/9');
  });

  it('leaves map data untouched when there is no guide', () => {
    expect(mergeVenueGuide(mapInfo, null)).toBe(mapInfo);
  });

  it('routes directions from the venue’s exact point when coordinates are known', () => {
    const url = new URL(mapDirectionsUrl(merged.venue, { name: 'Crown Towers', coordinates: { lat: -37.82, lng: 144.96 } }));
    expect(url.searchParams.get('origin')).toBe('-37.8255,144.953');
    expect(url.searchParams.get('destination')).toBe('-37.82,144.96');
  });
});
