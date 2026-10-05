/**
 * Travel information for an event venue ("How to Reach" tab).
 *
 * Every fact is optional except the name of the thing it describes, and every
 * item carries the source it was taken from: a field is filled only when that
 * source states it (or, for distances, when both ends have real coordinates),
 * never estimated. A section with no items renders as "Information unavailable
 * for this location." rather than being padded out.
 */

/** Where a fact comes from — the venue's or operator's page, or the map record. */
export type TravelSource = {
  label: string;
  url: string;
};

export type Coordinates = { lat: number; lng: number };

/**
 * A place a map link can open. "View" searches `name` plus `address` (or,
 * without one, `mapHint`); directions use `coordinates` when known, so the
 * route starts and ends at that exact point.
 */
export type TravelPlace = {
  name: string;
  /** Street address as a source states it. Displayed. */
  address?: string;
  /**
   * Locality appended to the map search only ("South Wharf VIC, Australia") so
   * a name resolves in the right city. Never displayed — search context, not a
   * claimed address.
   */
  mapHint?: string;
  coordinates?: Coordinates;
};

export type AirportOption = {
  place: TravelPlace;
  /** IATA code, e.g. "MEL". */
  code?: string;
  /** City the airport lists itself in, when the source states it. */
  city?: string;
  /** Distance to the venue: as a source states it, or straight-line from coordinates. */
  distance?: string;
  /** How to get from the airport to the venue, as the source states it. */
  travelInfo?: string;
  sources: TravelSource[];
};

export type TransitMode = 'bus' | 'train' | 'metro' | 'subway' | 'tram' | 'light-rail' | 'ferry' | 'cable-car' | 'other';

export type TransitStop = {
  mode: TransitMode;
  place: TravelPlace;
  /** Line or route names/numbers serving this stop, e.g. ["96", "109", "12"]. */
  routes?: string[];
  /** Line/network label when it is not obvious from the mode, e.g. "Elizabeth line". */
  network?: string;
  /** Straight-line distance from the venue, from coordinates. */
  distance?: string;
  /** Walking distance/time to the venue, only as a source states it. */
  walking?: string;
  /** Anything else the source says that helps (which entrance, where from). */
  note?: string;
  sources: TravelSource[];
};

export type TaxiInfo = {
  /** Drop-off / pick-up / rank details, one practical point per entry. */
  points: string[];
  sources: TravelSource[];
};

export type HotelStarRating = 3 | 4 | 5;

export type HotelOption = {
  place: TravelPlace;
  /** Only when the hotel, venue or map record states it; otherwise listed unrated. */
  stars?: HotelStarRating;
  /** As a source states it, or straight-line from coordinates. */
  distance?: string;
  /** e.g. "Directly connected to MCEC" — as the source states it. */
  note?: string;
  sources: TravelSource[];
};

/**
 * What distances and nearby searches are measured from:
 *  - `venue` — the venue itself was found on the map;
 *  - `venue-address` — the venue's street address was found instead;
 *  - `city-centre` — only the city was found: airports are still shown, but
 *    nearby bus/rail/taxi/hotel searches are not run (they would not be near
 *    the venue);
 *  - `none` — no location to search from (venue not announced, lookup failed).
 */
export type TravelReference = 'venue' | 'venue-address' | 'city-centre' | 'none';

/** The sections the How to Reach tab renders, for any event. */
export type TravelInfo = {
  venue: TravelPlace;
  reference: TravelReference;
  airports: AirportOption[];
  buses: TransitStop[];
  /** Rail, metro, tram, light rail, ferry… — only modes found near the venue. */
  publicTransport: TransitStop[];
  taxi?: TaxiInfo;
  hotels: HotelOption[];
  /** Short plain-language notes shown above the sections (why something is missing). */
  notices: string[];
  /** A lookup failed for a temporary reason (service busy); asking again may fill the gaps. */
  retryable?: boolean;
  /** Data licences to credit, e.g. OpenStreetMap. */
  attribution: TravelSource[];
};

/**
 * Official, hand-verified facts for one venue (its own visitor pages). Merged
 * over the map data for events at that venue: its sections win where it has
 * any, and its hotels are listed first.
 */
export type VenueTravelGuide = {
  /** Stable id for the venue, e.g. "au-melbourne-mcec". */
  id: string;
  /** The venue as directions start from it. */
  venue: TravelPlace;
  /**
   * Which catalog events this guide applies to: same ISO country code, same
   * city, and a venue name matching one of `venueNames` (case/accent/punctuation
   * insensitive). Matching on all three keeps two same-named venues apart.
   */
  match: {
    countryCode: string;
    city: string;
    venueNames: string[];
  };
  airports: AirportOption[];
  buses: TransitStop[];
  publicTransport: TransitStop[];
  taxi?: TaxiInfo;
  hotels: HotelOption[];
  /** When the guide's facts were last checked against its sources (ISO date). */
  verifiedOn: string;
};
