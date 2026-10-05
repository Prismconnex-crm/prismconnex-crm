/**
 * Turns OpenStreetMap elements around a venue into How to Reach sections.
 * Pure — no network — so the selection rules are unit-tested; the fetching and
 * caching live in travel-resolver.ts.
 *
 * Only what the map record states is used: names, IATA codes, route refs,
 * networks, star ratings and addresses come from OSM tags, and an element
 * without a name is skipped. Distances are straight-line from the venue's
 * coordinates, and labelled as such.
 */
import type {
  Coordinates,
  HotelOption,
  HotelStarRating,
  TaxiInfo,
  TransitMode,
  TransitStop,
  TravelPlace,
  TravelSource,
} from '@/types/venue-travel';

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Search radii (metres) around the venue. Airports come from data/airports.json instead. */
export const OSM_RADII = {
  busStop: 600,
  busStation: 2_500,
  rail: 1_500,
  taxi: 600,
  hotel: 3_000,
} as const;

/** One Overpass request for everything the tab needs around `at`. */
export function buildOverpassQuery(at: Coordinates) {
  const p = `${at.lat.toFixed(6)},${at.lng.toFixed(6)}`;
  return [
    '[out:json][timeout:40];',
    // `out tags center`, not `out tags`: plain `out tags` drops a node's coordinates.
    `nwr(around:${OSM_RADII.busStop},${p})["highway"="bus_stop"];out tags center 200;`,
    `nwr(around:${OSM_RADII.busStation},${p})["amenity"="bus_station"];out tags center 50;`,
    `nwr(around:${OSM_RADII.rail},${p})["railway"~"^(station|halt|tram_stop)$"];out tags center 200;`,
    `nwr(around:${OSM_RADII.rail},${p})["public_transport"="station"];out tags center 200;`,
    `nwr(around:${OSM_RADII.taxi},${p})["amenity"="taxi"];out tags center 20;`,
    `nwr(around:${OSM_RADII.hotel},${p})["tourism"="hotel"];out tags center 400;`,
  ].join('');
}

export const OSM_ATTRIBUTION: TravelSource = {
  label: '© OpenStreetMap contributors (ODbL)',
  url: 'https://www.openstreetmap.org/copyright',
};

function coordinatesOf(element: OsmElement): Coordinates | null {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
}

/** Great-circle distance in metres. */
export function distanceMeters(a: Coordinates, b: Coordinates) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m straight-line`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km straight-line`;
}

/** OSM `stars`: "4", "4.0", "4S" (superior) → 4. Half stars and others → unrated. */
export function parseStars(value: string | undefined): HotelStarRating | undefined {
  const match = value?.trim().match(/^([345])(?:\.0)?\s*S?$/i);
  return match ? (Number(match[1]) as HotelStarRating) : undefined;
}

/** "12 Main Street, 3006 Southbank" from addr:* tags; null unless a street is tagged. */
export function osmAddress(tags: Record<string, string>) {
  const street = tags['addr:street'];
  if (!street) return null;
  const line1 = [tags['addr:housenumber'], street].filter(Boolean).join(' ');
  const line2 = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ');
}

function splitRefs(value: string | undefined) {
  return value
    ? Array.from(new Set(value.split(/[;,]/).map((ref) => ref.trim()).filter(Boolean))).slice(0, 12)
    : undefined;
}

/** Rail-type station/stop → mode; null for anything that is not one (bus stations, platforms). */
export function classifyRail(tags: Record<string, string>): TransitMode | null {
  if (tags.railway === 'tram_stop' || tags.station === 'tram' || (tags.tram === 'yes' && tags.railway !== 'station')) {
    return 'tram';
  }
  const isStation = tags.railway === 'station' || tags.railway === 'halt' || tags.public_transport === 'station';
  if (!isStation) return null;
  // A public_transport=station that is only a bus station belongs to "By Bus".
  if (tags.bus === 'yes' && !tags.railway && tags.train !== 'yes' && tags.subway !== 'yes') return null;
  if (tags.station === 'subway' || tags.subway === 'yes') return 'subway';
  if (tags.station === 'light_rail' || tags.light_rail === 'yes') return 'light-rail';
  if (tags.station === 'monorail') return 'other';
  if (tags.railway === 'station' || tags.railway === 'halt' || tags.train === 'yes') return 'train';
  return null;
}

function normalizeKey(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

type Located = { element: OsmElement; tags: Record<string, string>; name: string; at: Coordinates; meters: number };

type BuildOptions = {
  venue: Coordinates;
  /** Locality for map searches of places without a street address, e.g. "Paris, France". */
  mapHint?: string;
};

function sourceFor(element: OsmElement): TravelSource {
  return { label: 'OpenStreetMap', url: `https://www.openstreetmap.org/${element.type}/${element.id}` };
}

function placeFor(item: Located, mapHint?: string, address?: string | null): TravelPlace {
  return { name: item.name, ...(address ? { address } : mapHint ? { mapHint } : {}), coordinates: item.at };
}

/** Nearest first, one entry per normalized name (a station is often several OSM objects). */
function nearestUnique(items: Located[], keyOf: (item: Located) => string = (item) => normalizeKey(item.name)) {
  const seen = new Set<string>();
  return [...items]
    .sort((a, b) => a.meters - b.meters)
    .filter((item) => {
      const key = keyOf(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export type OsmTravelSections = {
  buses: TransitStop[];
  publicTransport: TransitStop[];
  taxi?: TaxiInfo;
  hotels: HotelOption[];
};

export function buildSectionsFromOsm(elements: OsmElement[], options: BuildOptions): OsmTravelSections {
  const located: Located[] = [];
  const seenElements = new Set<string>();
  for (const element of elements) {
    const key = `${element.type}/${element.id}`;
    if (seenElements.has(key)) continue;
    seenElements.add(key);
    const tags = element.tags ?? {};
    const name = (tags['name:en'] || tags.name || '').trim();
    const at = coordinatesOf(element);
    if (!name || !at) continue;
    located.push({ element, tags, name, at, meters: distanceMeters(options.venue, at) });
  }
  const within = (meters: number) => (item: Located) => item.meters <= meters;

  const busStops = nearestUnique(
    located.filter((item) => item.tags.highway === 'bus_stop' && within(OSM_RADII.busStop)(item))
  ).slice(0, 3);
  const busStation = nearestUnique(
    located.filter((item) => item.tags.amenity === 'bus_station' && within(OSM_RADII.busStation)(item))
  ).slice(0, 1);
  const buses: TransitStop[] = [...busStops, ...busStation].map((item) => ({
    mode: 'bus',
    place: placeFor(item, options.mapHint),
    ...(splitRefs(item.tags.route_ref) ? { routes: splitRefs(item.tags.route_ref) } : {}),
    ...(item.tags.amenity === 'bus_station' ? { network: 'Bus station' } : {}),
    distance: formatDistance(item.meters),
    sources: [sourceFor(item.element)],
  }));

  // Rail: up to 2 per mode, 6 in all, one entry per station name and mode.
  const railCandidates = located
    .filter(within(OSM_RADII.rail))
    .map((item) => ({ item, mode: classifyRail(item.tags) }))
    .filter((entry): entry is { item: Located; mode: TransitMode } => entry.mode !== null);
  const perMode = new Map<TransitMode, number>();
  const seenRail = new Set<string>();
  const publicTransport: TransitStop[] = [];
  for (const { item, mode } of railCandidates.sort((a, b) => a.item.meters - b.item.meters)) {
    const key = `${mode}|${normalizeKey(item.name)}`;
    if (seenRail.has(key) || (perMode.get(mode) ?? 0) >= 2 || publicTransport.length >= 6) continue;
    seenRail.add(key);
    perMode.set(mode, (perMode.get(mode) ?? 0) + 1);
    const routes = splitRefs(item.tags.route_ref ?? item.tags.line);
    publicTransport.push({
      mode,
      place: placeFor(item, options.mapHint),
      ...(routes ? { routes } : {}),
      ...(item.tags.network ? { network: item.tags.network } : {}),
      distance: formatDistance(item.meters),
      sources: [sourceFor(item.element)],
    });
  }

  const ranks = nearestUnique(
    located.filter((item) => item.tags.amenity === 'taxi' && within(OSM_RADII.taxi)(item)),
    (item) => `${item.element.type}/${item.element.id}`
  ).slice(0, 3);
  const taxi: TaxiInfo | undefined = ranks.length
    ? {
        points: ranks.map((item) => `Taxi rank: ${item.name} — ${formatDistance(item.meters)} from the venue.`),
        sources: ranks.map((item) => sourceFor(item.element)),
      }
    : undefined;

  // Hotels: up to 3 nearest per star group, plus up to 3 unrated.
  const hotelsNearby = nearestUnique(
    located.filter((item) => item.tags.tourism === 'hotel' && within(OSM_RADII.hotel)(item))
  );
  const hotels: HotelOption[] = [];
  for (const stars of [5, 4, 3, undefined] as const) {
    hotelsNearby
      .filter((item) => parseStars(item.tags.stars) === stars)
      .slice(0, 3)
      .forEach((item) => {
        const address = osmAddress(item.tags);
        hotels.push({
          place: placeFor(item, options.mapHint, address),
          ...(stars ? { stars } : {}),
          distance: formatDistance(item.meters),
          sources: [sourceFor(item.element)],
        });
      });
  }

  return { buses, publicTransport, taxi, hotels };
}
