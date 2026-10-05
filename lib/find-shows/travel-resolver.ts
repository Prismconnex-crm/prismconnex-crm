/**
 * How to Reach, for any catalog event:
 *
 *   event → venue (+ scraped street address) → coordinates (Nominatim)
 *         → nearest airports (data/airports.json, no network)
 *         → one Overpass search around them → bus, rail, taxi, hotels
 *         → merged with any hand-verified guide for that venue.
 *
 * Resolved lazily, when the tab is opened (GET /api/find-shows/travel), and
 * cached twice so a venue shared by many events is looked up once:
 *   - geocode, keyed by normalized venue + address + city + country;
 *   - nearby search, keyed by the coordinates (5 decimals, ~1 m).
 * Failed lookups throw inside the cache wrappers, so they are not cached.
 *
 * OpenStreetMap usage policies: one Nominatim request per second, an
 * identifying User-Agent, results cached — all honoured here.
 */
import { unstable_cache } from 'next/cache';
import airportData from '../../data/airports.json';
import cityCoordinates from '../../data/city-coordinates.json';
import { nearestAirports, type AirportRecord } from './airports';
import { buildOverpassQuery, buildSectionsFromOsm, distanceMeters, OSM_ATTRIBUTION, type OsmElement } from './osm-travel';
import {
  isAddressMatch,
  isVenueMatch,
  VENUE_NAME_MATCH,
  venueAddressQuery,
  venueNameScore,
  venueQueryVariants,
  type NominatimResult,
} from './venue-geocode';
import { getVenueTravelGuide, mergeVenueGuide, normalizeName } from './venue-travel';
import type { Coordinates, TravelInfo, TravelReference } from '@/types/venue-travel';
import type { FindShowEvent } from '@/types/find-shows';

const USER_AGENT = 'Prismconnex-CRM/1.0 (Find Shows how-to-reach; +https://www.openstreetmap.org/copyright)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
/**
 * Public Overpass instances, tried in order. The main instance often answers
 * 504 under load, so VK's instance (listed on the OSM wiki) is tried first.
 */
const OVERPASS_URLS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
/** HTTP statuses that mean "busy, try again", not "bad query". */
const OVERPASS_BUSY = new Set([429, 502, 503, 504]);
const AIRPORTS = airportData as AirportRecord[];
const OURAIRPORTS_ATTRIBUTION = { label: 'Airports: OurAirports (public domain)', url: 'https://ourairports.com/data/' };
const DAY = 60 * 60 * 24;
/** A venue found by name must lie within this distance of its city's known centre. */
const MAX_VENUE_TO_CITY_METERS = 80_000;
/** Radius around the city centre searched for a venue by its map name. */
const VENUE_SEARCH_RADIUS_METERS = 40_000;
const NOMINATIM_ATTRIBUTION = {
  label: 'Location search: Nominatim / OpenStreetMap',
  url: 'https://nominatim.org/',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Nominatim: at most one request per second across this server process ---
let nominatimQueue: Promise<unknown> = Promise.resolve();

function nominatim(params: Record<string, string>): Promise<NominatimResult[]> {
  const run = nominatimQueue.then(async () => {
    const url = `${NOMINATIM_URL}?${new URLSearchParams({ format: 'jsonv2', limit: '5', 'accept-language': 'en', ...params })}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    return (await response.json()) as NominatimResult[];
  });
  nominatimQueue = run.then(
    () => sleep(1100),
    () => sleep(1100)
  );
  return run;
}

const toCoordinates = (result: NominatimResult): Coordinates => ({ lat: Number(result.lat), lng: Number(result.lon) });

type GeocodeInput = {
  venue: string;
  address: string | null;
  city: string;
  country: string;
  countryCode: string | null;
  /** Known city centre [lng, lat] from data/city-coordinates.json, when present. */
  cityCentre: [number, number] | null;
};

type Geocode = { coordinates: Coordinates; reference: Exclude<TravelReference, 'none'> } | null;

async function geocodeUncached(input: GeocodeInput): Promise<Geocode> {
  const countrycodes: Record<string, string> =
    input.countryCode && input.countryCode !== 'XK' ? { countrycodes: input.countryCode.toLowerCase() } : {};
  const centre = input.cityCentre ? { lat: input.cityCentre[1], lng: input.cityCentre[0] } : null;
  const nearCity = (at: Coordinates) => !centre || distanceMeters(centre, at) <= MAX_VENUE_TO_CITY_METERS;
  const locality = [input.city, input.country].filter(Boolean).join(', ');

  if (input.venue) {
    // Venue name, most specific spelling first; at most 4 requests.
    for (const variant of venueQueryVariants(input.venue).slice(0, 4)) {
      const results = await nominatim({ q: `${variant}, ${locality}`, ...countrycodes });
      const hit = results.find((result) => isVenueMatch(result, input.venue) && nearCity(toCoordinates(result)));
      if (hit) return { coordinates: toCoordinates(hit), reference: 'venue' };
    }
  }

  // The map may spell the venue differently ("Convention and Exhibition" vs
  // "Exhibition & Convention"): match exhibition/conference venues near the
  // city by their words, ignoring order.
  if (input.venue && centre) {
    const byName = await findVenueByMapName(input.venue, centre);
    if (byName) return { coordinates: byName, reference: 'venue' };
  }

  const addressQuery = venueAddressQuery(input.address, input.venue);
  if (addressQuery) {
    const results = await nominatim({ q: addressQuery, ...countrycodes });
    const hit = results.find((result) => isAddressMatch(result) && nearCity(toCoordinates(result)));
    if (hit) return { coordinates: toCoordinates(hit), reference: 'venue-address' };
  }

  if (centre) return { coordinates: centre, reference: 'city-centre' };
  if (!input.city) return null;
  const results = await nominatim({ q: locality, ...countrycodes });
  const city = results.find((result) => result.category === 'place' || result.category === 'boundary');
  return city ? { coordinates: toCoordinates(city), reference: 'city-centre' } : null;
}

async function findVenueByMapName(venue: string, centre: Coordinates): Promise<Coordinates | null> {
  const at = `${centre.lat.toFixed(6)},${centre.lng.toFixed(6)}`;
  const elements = await overpass(
    `[out:json][timeout:25];nwr(around:${VENUE_SEARCH_RADIUS_METERS},${at})["name"]["amenity"~"^(exhibition_centre|conference_centre|events_venue)$"];out tags center 500;`
  );
  let best: { at: Coordinates; score: number; meters: number } | null = null;
  for (const element of elements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const names = [tags.name, tags['name:en'], tags.official_name, tags.alt_name, tags.short_name].filter(Boolean) as string[];
    const score = Math.max(...names.map((name) => venueNameScore(venue, name)));
    if (score < VENUE_NAME_MATCH) continue;
    const meters = distanceMeters(centre, { lat, lng });
    if (!best || score > best.score || (score === best.score && meters < best.meters)) {
      best = { at: { lat, lng }, score, meters };
    }
  }
  return best?.at ?? null;
}

const geocodeCached = unstable_cache(
  async (_cacheKey: string, input: GeocodeInput) => geocodeUncached(input),
  ['find-shows-venue-geocode-v3'],
  { revalidate: 90 * DAY }
);

async function overpass(query: string): Promise<OsmElement[]> {
  const body = new URLSearchParams({ data: query });
  let lastError: unknown;
  for (const url of OVERPASS_URLS) {
    // One retry per instance, after a pause, when it only says it is busy.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          cache: 'no-store',
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          lastError = new Error(`Overpass ${response.status} from ${url}`);
          if (OVERPASS_BUSY.has(response.status) && attempt === 0) {
            await sleep(3_000);
            continue;
          }
          break;
        }
        const json = (await response.json()) as { elements?: OsmElement[]; remark?: string };
        // A timed-out query still returns 200, with a remark and partial data.
        if (json.remark && /timed out|error/i.test(json.remark)) {
          lastError = new Error(`Overpass: ${json.remark}`);
          break;
        }
        return json.elements ?? [];
      } catch (error) {
        // Network error or our own timeout: move on to the next instance.
        lastError = error;
        break;
      }
    }
  }
  throw lastError;
}

const overpassCached = unstable_cache(
  async (lat: number, lng: number) => overpass(buildOverpassQuery({ lat, lng })),
  ['find-shows-nearby-osm-v3'],
  { revalidate: 30 * DAY }
);

const inFlight = new Map<string, Promise<TravelInfo>>();

type ResolveInput = Pick<FindShowEvent, 'venue' | 'city' | 'country' | 'countryCode' | 'seedCity'> & {
  fullVenueAddress: string | null;
};

const VENUE_TBA = 'Venue to be announced';

export function resolveTravelInfo(event: ResolveInput): Promise<TravelInfo> {
  const venueKnown = Boolean(event.venue) && event.venue !== VENUE_TBA;
  const country = event.country === 'Unknown' ? '' : event.country;
  const cacheKey = [
    venueKnown ? normalizeName(event.venue) : '',
    normalizeName(event.fullVenueAddress ?? ''),
    normalizeName(event.city),
    normalizeName(country),
  ].join('|');
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const run = resolve(event, { venueKnown, country, cacheKey }).finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, run);
  return run;
}

async function resolve(
  event: ResolveInput,
  { venueKnown, country, cacheKey }: { venueKnown: boolean; country: string; cacheKey: string }
): Promise<TravelInfo> {
  const mapHint = [event.city, country].filter(Boolean).join(', ');
  const base: TravelInfo = {
    venue: {
      name: venueKnown ? event.venue : event.city || 'Venue to be announced',
      ...(venueKnown && event.fullVenueAddress ? { address: event.fullVenueAddress } : {}),
      ...(mapHint ? { mapHint } : {}),
    },
    reference: 'none',
    airports: [],
    buses: [],
    publicTransport: [],
    hotels: [],
    notices: [],
    attribution: [],
  };
  const guide = venueKnown ? getVenueTravelGuide(event) : null;

  if (!event.city && !venueKnown) {
    return mergeVenueGuide({ ...base, notices: ['The venue and city have not been announced yet.'] }, guide);
  }

  const known = (cityCoordinates as unknown as Record<string, number[] | null>)[event.seedCity];
  const cityCentre: [number, number] | null = known?.length === 2 ? [known[0], known[1]] : null;
  let geocode: Geocode;
  try {
    geocode = await geocodeCached(cacheKey, {
      venue: venueKnown ? event.venue : '',
      address: venueKnown ? event.fullVenueAddress : null,
      city: event.city,
      country,
      countryCode: event.countryCode,
      cityCentre,
    });
  } catch {
    return mergeVenueGuide(
      { ...base, notices: ['The location service could not be reached. Please try again shortly.'], retryable: true },
      guide
    );
  }
  if (!geocode) {
    return mergeVenueGuide({ ...base, notices: ['This location could not be found on the map.'] }, guide);
  }

  const venue = { ...base.venue, coordinates: geocode.coordinates };
  const airports = nearestAirports(AIRPORTS, geocode.coordinates);
  const notices: string[] = [];
  if (!venueKnown) notices.push('The venue has not been announced yet, so only airports near the city are shown.');
  else if (geocode.reference === 'venue-address') notices.push("Distances are measured from the venue's street address.");
  else if (geocode.reference === 'city-centre') {
    notices.push(
      `The venue could not be pinned on the map, so only airports are shown, measured from the ${event.city} city centre.`
    );
  }
  const located: TravelInfo = {
    ...base,
    venue,
    reference: geocode.reference,
    airports,
    notices,
    attribution: [OURAIRPORTS_ATTRIBUTION, NOMINATIM_ATTRIBUTION],
  };

  // Bus stops, stations and hotels "near the venue" would be wrong around a
  // city centre, so the nearby search runs only when the venue is pinned.
  if (geocode.reference === 'city-centre') return mergeVenueGuide(located, guide);

  let elements: OsmElement[];
  try {
    elements = await overpassCached(
      Number(geocode.coordinates.lat.toFixed(5)),
      Number(geocode.coordinates.lng.toFixed(5))
    );
  } catch {
    return mergeVenueGuide(
      {
        ...located,
        notices: [
          ...notices,
          'The nearby bus, rail, taxi and hotel search is temporarily unavailable. Please try again shortly.',
        ],
        retryable: true,
      },
      guide
    );
  }

  const sections = buildSectionsFromOsm(elements, { venue: geocode.coordinates, mapHint });
  return mergeVenueGuide(
    {
      ...located,
      ...sections,
      attribution: [OURAIRPORTS_ATTRIBUTION, OSM_ATTRIBUTION, NOMINATIM_ATTRIBUTION],
    },
    guide
  );
}
