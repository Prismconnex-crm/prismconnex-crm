/**
 * Pure helpers for finding an event venue on the map (Nominatim). The network
 * calls and caching live in travel-resolver.ts; these decide what to search
 * for and which results to trust.
 */

/** A Nominatim `format=jsonv2` search result (the fields used here). */
export type NominatimResult = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category: string;
  type: string;
  /** 30 = a building/POI, 26 = a street; below that it is an area (town, city…). */
  place_rank: number;
};

/**
 * Search strings for a catalog venue name, most specific first:
 *   "Tokyo International Exhibition Center (Tokyo Big Sight)" → the full name,
 *   without the bracket, the bracketed alias; "Corferias - Centro de
 *   Convenciones" → also "Corferias"; "&" → "and".
 */
export function venueQueryVariants(venue: string): string[] {
  const out = [venue.trim()];
  const withoutBrackets = venue.replace(/\s*\([^)]*\)/g, '').trim();
  out.push(withoutBrackets);
  const bracketed = venue.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (bracketed) out.push(bracketed);
  const beforeDash = withoutBrackets.split(/\s+[-–]\s+|\s*\/\s*/)[0]?.trim();
  if (beforeDash) out.push(beforeDash);
  out.push(withoutBrackets.replace(/\s*&\s*/g, ' and '));
  return Array.from(new Set(out.filter((value) => value.length >= 3)));
}

/**
 * The street part of a scraped venue address, without the venue's own name
 * and trailing country: "MCEC, 2 Clarendon Street, Southbank, Melbourne,
 * Victoria, Australia, 3205" → "2 Clarendon Street, Southbank, Melbourne,
 * Victoria, Australia, 3205". Null when nothing street-like is left.
 */
export function venueAddressQuery(fullAddress: string | null | undefined, venue: string) {
  if (!fullAddress) return null;
  const parts = fullAddress.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length && normalize(parts[0]) === normalize(venue)) parts.shift();
  const query = parts.join(', ');
  return /\d/.test(query) && parts.length >= 2 ? query : null;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const HOTEL_WORDS = /\b(hotel|resort|inn|suites?|marriott|hilton|hyatt|sheraton|westin|novotel|intercontinental|radisson|kempinski|shangri|sofitel|pullman|ritz|four seasons|mandarin)\b/i;

/**
 * Whether a result found by searching the venue's NAME is the venue: a
 * building/POI (not a street, district or city), and not a bus stop, station
 * or hotel that merely shares words with it ("Tokyo Big Sight" bus stop,
 * "Ibis World Trade Centre") — unless the venue itself is a hotel.
 */
export function isVenueMatch(result: NominatimResult, venue: string) {
  if (result.place_rank < 26) return false;
  if (['highway', 'railway', 'public_transport', 'aeroway', 'boundary', 'place'].includes(result.category)) return false;
  if (result.category === 'tourism' && ['hotel', 'hostel', 'guest_house', 'apartment', 'motel'].includes(result.type)) {
    return HOTEL_WORDS.test(venue);
  }
  return true;
}

const NAME_STOPWORDS = new Set(['the', 'of', 'and', 'de', 'la', 'le', 'del', 'di', 'da', 'das', 'der', 'des', 'du', 'el', 'y', 'et', 'und']);

function nameTokens(value: string) {
  return new Set(
    normalize(value.replace(/&/g, ' and '))
      .replace(/\bcenter\b/g, 'centre')
      .split(' ')
      .filter((token) => token.length > 1 && !NAME_STOPWORDS.has(token))
  );
}

/**
 * How well a map feature's name matches a catalog venue name, 0-1, ignoring
 * word order, "&"/"and" and centre/center: "Melbourne Exhibition & Convention
 * Centre" vs "Melbourne Convention and Exhibition Centre" → 1. Word overlap
 * (Jaccard), or 1 when one name's words (at least two) all appear in the other.
 */
export function venueNameScore(catalogName: string, mapName: string) {
  const a = nameTokens(catalogName);
  const b = nameTokens(mapName);
  if (!a.size || !b.size) return 0;
  const sharedTokens = Array.from(a).filter((token) => b.has(token));
  // "Convention Centre" alone must not match every convention centre.
  if (!sharedTokens.some((token) => !GENERIC_VENUE_WORDS.has(token))) return 0;
  const shared = sharedTokens.length;
  if (shared >= 2 && (shared === a.size || shared === b.size)) return 1;
  return shared / (a.size + b.size - shared);
}

const GENERIC_VENUE_WORDS = new Set([
  'centre', 'convention', 'conference', 'congress', 'exhibition', 'exhibitions', 'expo', 'fair', 'fairground',
  'fairgrounds', 'hall', 'halls', 'international', 'trade', 'event', 'events', 'venue', 'arena', 'park', 'palace',
  'palais', 'messe', 'feria', 'recinto', 'ferial', 'centro', 'convenciones', 'exposiciones', 'parc', 'expositions',
]);

/** Minimum venueNameScore to accept a map feature as the venue. */
export const VENUE_NAME_MATCH = 0.75;

/** Whether a result found by searching the venue's street ADDRESS is street-level or better. */
export function isAddressMatch(result: NominatimResult) {
  return result.place_rank >= 26;
}
