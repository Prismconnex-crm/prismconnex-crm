import { VENUE_NAME_MATCH, venueNameScore } from './venue-geocode';
import { VENUE_TRAVEL_GUIDES } from './venue-travel-data';
import type { HotelOption, TravelInfo, TravelPlace, VenueTravelGuide } from '@/types/venue-travel';

type EventLocation = {
  venue: string;
  city: string;
  countryCode: string | null;
};

/** Case-, accent- and punctuation-insensitive form ("ExCeL" = "excel", "&" = "and"). */
export function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const guidesByKey = new Map<string, VenueTravelGuide>();
for (const guide of VENUE_TRAVEL_GUIDES) {
  for (const venueName of guide.match.venueNames) {
    guidesByKey.set(
      [guide.match.countryCode.toUpperCase(), normalizeName(guide.match.city), normalizeName(venueName)].join('|'),
      guide
    );
  }
}

/**
 * The hand-verified guide for an event's venue, or null. Matched on country
 * code, city and venue name together, from the event's own catalog location —
 * never on the event name.
 */
export function getVenueTravelGuide(location: EventLocation): VenueTravelGuide | null {
  if (!location.countryCode) return null;
  const key = [location.countryCode.toUpperCase(), normalizeName(location.city), normalizeName(location.venue)].join('|');
  return guidesByKey.get(key) ?? null;
}

/** The text a map search uses to find this specific place. */
export function placeQuery(place: TravelPlace) {
  return [place.name, place.address ?? place.mapHint].filter(Boolean).join(', ');
}

/** Exact point when known, else the place's search text — for directions. */
function routePoint(place: TravelPlace) {
  return place.coordinates ? `${place.coordinates.lat},${place.coordinates.lng}` : placeQuery(place);
}

/** Opens the place itself in Google Maps (Maps URLs API — no key needed). */
export function mapPlaceUrl(place: TravelPlace) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(place))}`;
}

/** Directions between two specific places in Google Maps. */
export function mapDirectionsUrl(origin: TravelPlace, destination: TravelPlace) {
  const params = new URLSearchParams({ api: '1', origin: routePoint(origin), destination: routePoint(destination) });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const HOTELS_PER_GROUP = 3;

/**
 * Official venue facts over map data. A section the guide fills replaces the
 * map's; hotels are the guide's first, then the map's (same name dropped), at
 * most 3 per star group and 3 unrated. The venue keeps the map's coordinates
 * so directions still start from the exact point.
 */
export function mergeVenueGuide(info: TravelInfo, guide: VenueTravelGuide | null): TravelInfo {
  if (!guide) return info;
  // The same hotel can be spelled differently ("DoubleTree by Hilton London
  // Excel" / "…Hilton Hotel London Excel"): keep the guide's entry, fill only
  // what it lacks from the map record, and cite both.
  const mapHotels = [...info.hotels];
  const guideHotels = guide.hotels.map((hotel) => {
    const index = mapHotels.findIndex(
      (candidate) => venueNameScore(hotel.place.name, candidate.place.name) >= VENUE_NAME_MATCH
    );
    if (index === -1) return hotel;
    const [twin] = mapHotels.splice(index, 1);
    return {
      ...hotel,
      stars: hotel.stars ?? twin.stars,
      distance: hotel.distance ?? twin.distance,
      place: { ...hotel.place, coordinates: hotel.place.coordinates ?? twin.place.coordinates },
      sources: [...hotel.sources, ...twin.sources],
    };
  });
  const combined = [...guideHotels, ...mapHotels];
  const hotels: HotelOption[] = [];
  for (const stars of [5, 4, 3, undefined] as const) {
    hotels.push(...combined.filter((hotel) => hotel.stars === stars).slice(0, HOTELS_PER_GROUP));
  }
  return {
    ...info,
    venue: { ...guide.venue, coordinates: info.venue.coordinates ?? guide.venue.coordinates },
    airports: guide.airports.length ? guide.airports : info.airports,
    buses: guide.buses.length ? guide.buses : info.buses,
    publicTransport: guide.publicTransport.length ? guide.publicTransport : info.publicTransport,
    taxi: guide.taxi ?? info.taxi,
    hotels,
  };
}
