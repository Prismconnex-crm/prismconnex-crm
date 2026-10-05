/**
 * Nearest airports to a venue, from data/airports.json (OurAirports, public
 * domain; built by scripts/build-airports.mjs). Only large/medium airports with
 * an IATA code and scheduled passenger service are in that file, so every
 * candidate is somewhere a visitor can fly into. Pure — the list is a parameter.
 */
import { distanceMeters, formatDistance } from './osm-travel';
import type { AirportOption, Coordinates } from '@/types/venue-travel';

export type AirportRecord = {
  iata: string;
  name: string;
  city: string | null;
  country: string;
  lat: number;
  lng: number;
  size: 'large' | 'medium';
  /** OurAirports ident, for the source link. */
  ref: string;
};

/** Airports further than this from the venue are not offered. */
export const AIRPORT_RADIUS_METERS = 200_000;
const MAX_AIRPORTS = 3;

/**
 * Up to 3 airports, nearest first: the nearest large (hub) airports, plus any
 * medium airport that is closer than the nearest hub (a city airport such as
 * London City). A medium airport further out than a hub is left out.
 */
export function nearestAirports(airports: readonly AirportRecord[], venue: Coordinates): AirportOption[] {
  const inRange = airports
    .map((airport) => ({ airport, meters: distanceMeters(venue, { lat: airport.lat, lng: airport.lng }) }))
    .filter((entry) => entry.meters <= AIRPORT_RADIUS_METERS)
    .sort((a, b) => a.meters - b.meters);
  const nearestLarge = inRange.find((entry) => entry.airport.size === 'large');
  const picked = inRange
    .filter((entry) => entry.airport.size === 'large' || !nearestLarge || entry.meters < nearestLarge.meters)
    .slice(0, MAX_AIRPORTS);

  return picked.map(({ airport, meters }) => ({
    place: {
      name: airport.name,
      // The airport's own locality, not the event's: Narita is in Narita, not Tokyo.
      mapHint: [airport.city, airport.country].filter(Boolean).join(', '),
      coordinates: { lat: airport.lat, lng: airport.lng },
    },
    code: airport.iata,
    ...(airport.city ? { city: airport.city } : {}),
    distance: formatDistance(meters),
    sources: [{ label: 'OurAirports', url: `https://ourairports.com/airports/${encodeURIComponent(airport.ref)}/` }],
  }));
}
