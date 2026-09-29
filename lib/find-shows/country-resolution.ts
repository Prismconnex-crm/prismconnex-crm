/**
 * Country, ISO code and region for every Find Shows event.
 *
 * The seed spells a location as "City (Country)" free text. ~200 records have
 * no location at all (empty city, "?" venue), and used to fall through to
 * country "Unknown" filed under Europe. This module:
 *
 *  - canonicalises a parsed seed country ("UAE - United Arab Emirates",
 *    "Burma)", "USA") to one display name, ISO code and region, so every
 *    country sits in exactly one region dropdown;
 *  - infers the country for a location-less record from its name,
 *    description, website and organizer, strongest evidence first;
 *  - leaves the record "Unknown" (region null — no continent) when nothing
 *    reliable points at one country.
 */
import { getCountryIsoCode, normalizeCountryKey } from './country-flags';
import type { FindShowsRegion } from '@/types/find-shows';

export type FindShowRegionName = Exclude<FindShowsRegion, 'All Regions'>;

export const UNKNOWN_COUNTRY = 'Unknown';

type CountryInfo = { name: string; region: FindShowRegionName };

const AM: FindShowRegionName = 'Americas';
const EU: FindShowRegionName = 'Europe';
const AME: FindShowRegionName = 'Africa & Middle East';
const AP: FindShowRegionName = 'Asia-Pacific';

/**
 * ISO code → canonical display name and region. The single source of truth
 * for which continent dropdown a country appears in.
 *
 * Grouping follows the trade-show convention the dropdowns were built on:
 * the Caucasus, Belarus, Russia and Ukraine sit in Europe; Turkey and Iran with
 * the Middle East; Central Asia in Asia-Pacific; Indian Ocean islands off
 * Africa (Mauritius, Madagascar, Seychelles) in Africa.
 */
export const COUNTRIES_BY_ISO: Record<string, CountryInfo> = {
  // Americas
  AR: { name: 'Argentina', region: AM },
  BO: { name: 'Bolivia', region: AM },
  BR: { name: 'Brazil', region: AM },
  BS: { name: 'Bahamas', region: AM },
  CA: { name: 'Canada', region: AM },
  CL: { name: 'Chile', region: AM },
  CO: { name: 'Colombia', region: AM },
  CR: { name: 'Costa Rica', region: AM },
  CU: { name: 'Cuba', region: AM },
  DO: { name: 'Dominican Republic', region: AM },
  EC: { name: 'Ecuador', region: AM },
  GT: { name: 'Guatemala', region: AM },
  JM: { name: 'Jamaica', region: AM },
  MX: { name: 'Mexico', region: AM },
  PA: { name: 'Panama', region: AM },
  PE: { name: 'Peru', region: AM },
  PR: { name: 'Puerto Rico', region: AM },
  PY: { name: 'Paraguay', region: AM },
  SV: { name: 'El Salvador', region: AM },
  US: { name: 'United States', region: AM },
  UY: { name: 'Uruguay', region: AM },
  VE: { name: 'Venezuela', region: AM },

  // Europe
  AL: { name: 'Albania', region: EU },
  AM: { name: 'Armenia', region: EU },
  AT: { name: 'Austria', region: EU },
  AZ: { name: 'Azerbaijan', region: EU },
  BE: { name: 'Belgium', region: EU },
  BG: { name: 'Bulgaria', region: EU },
  BY: { name: 'Belarus', region: EU },
  CH: { name: 'Switzerland', region: EU },
  CZ: { name: 'Czech Republic', region: EU },
  DE: { name: 'Germany', region: EU },
  DK: { name: 'Denmark', region: EU },
  EE: { name: 'Estonia', region: EU },
  ES: { name: 'Spain', region: EU },
  FI: { name: 'Finland', region: EU },
  FR: { name: 'France', region: EU },
  GB: { name: 'United Kingdom', region: EU },
  GE: { name: 'Georgia', region: EU },
  GR: { name: 'Greece', region: EU },
  HR: { name: 'Croatia', region: EU },
  HU: { name: 'Hungary', region: EU },
  IE: { name: 'Ireland', region: EU },
  IS: { name: 'Iceland', region: EU },
  IT: { name: 'Italy', region: EU },
  LT: { name: 'Lithuania', region: EU },
  LU: { name: 'Luxembourg', region: EU },
  LV: { name: 'Latvia', region: EU },
  MC: { name: 'Monaco', region: EU },
  MD: { name: 'Moldova', region: EU },
  ME: { name: 'Montenegro', region: EU },
  MT: { name: 'Malta', region: EU },
  NL: { name: 'Netherlands', region: EU },
  NO: { name: 'Norway', region: EU },
  PL: { name: 'Poland', region: EU },
  PT: { name: 'Portugal', region: EU },
  RO: { name: 'Romania', region: EU },
  RS: { name: 'Serbia', region: EU },
  RU: { name: 'Russia', region: EU },
  SE: { name: 'Sweden', region: EU },
  SI: { name: 'Slovenia', region: EU },
  SK: { name: 'Slovakia', region: EU },
  UA: { name: 'Ukraine', region: EU },
  XK: { name: 'Kosovo', region: EU },

  // Africa & Middle East
  AE: { name: 'United Arab Emirates', region: AME },
  AO: { name: 'Angola', region: AME },
  BF: { name: 'Burkina Faso', region: AME },
  BH: { name: 'Bahrain', region: AME },
  BJ: { name: 'Benin', region: AME },
  BW: { name: 'Botswana', region: AME },
  CD: { name: 'DR Congo', region: AME },
  CI: { name: 'Ivory Coast', region: AME },
  CM: { name: 'Cameroon', region: AME },
  DZ: { name: 'Algeria', region: AME },
  EG: { name: 'Egypt', region: AME },
  ET: { name: 'Ethiopia', region: AME },
  GH: { name: 'Ghana', region: AME },
  IL: { name: 'Israel', region: AME },
  IQ: { name: 'Iraq', region: AME },
  IR: { name: 'Iran', region: AME },
  JO: { name: 'Jordan', region: AME },
  KE: { name: 'Kenya', region: AME },
  KW: { name: 'Kuwait', region: AME },
  LB: { name: 'Lebanon', region: AME },
  LY: { name: 'Libya', region: AME },
  MA: { name: 'Morocco', region: AME },
  MG: { name: 'Madagascar', region: AME },
  ML: { name: 'Mali', region: AME },
  MU: { name: 'Mauritius', region: AME },
  MZ: { name: 'Mozambique', region: AME },
  NA: { name: 'Namibia', region: AME },
  NG: { name: 'Nigeria', region: AME },
  OM: { name: 'Oman', region: AME },
  QA: { name: 'Qatar', region: AME },
  RW: { name: 'Rwanda', region: AME },
  SA: { name: 'Saudi Arabia', region: AME },
  SC: { name: 'Seychelles', region: AME },
  SN: { name: 'Senegal', region: AME },
  SS: { name: 'South Sudan', region: AME },
  SY: { name: 'Syria', region: AME },
  TG: { name: 'Togo', region: AME },
  TN: { name: 'Tunisia', region: AME },
  TR: { name: 'Turkey', region: AME },
  TZ: { name: 'Tanzania', region: AME },
  UG: { name: 'Uganda', region: AME },
  ZA: { name: 'South Africa', region: AME },
  ZM: { name: 'Zambia', region: AME },
  ZW: { name: 'Zimbabwe', region: AME },

  // Asia-Pacific
  AU: { name: 'Australia', region: AP },
  BD: { name: 'Bangladesh', region: AP },
  BT: { name: 'Bhutan', region: AP },
  CN: { name: 'China', region: AP },
  FJ: { name: 'Fiji', region: AP },
  HK: { name: 'Hong Kong', region: AP },
  ID: { name: 'Indonesia', region: AP },
  IN: { name: 'India', region: AP },
  JP: { name: 'Japan', region: AP },
  KG: { name: 'Kyrgyzstan', region: AP },
  KH: { name: 'Cambodia', region: AP },
  KR: { name: 'South Korea', region: AP },
  KZ: { name: 'Kazakhstan', region: AP },
  LK: { name: 'Sri Lanka', region: AP },
  MM: { name: 'Myanmar', region: AP },
  MN: { name: 'Mongolia', region: AP },
  MO: { name: 'Macao', region: AP },
  MV: { name: 'Maldives', region: AP },
  MY: { name: 'Malaysia', region: AP },
  NP: { name: 'Nepal', region: AP },
  NZ: { name: 'New Zealand', region: AP },
  PG: { name: 'Papua New Guinea', region: AP },
  PH: { name: 'Philippines', region: AP },
  PK: { name: 'Pakistan', region: AP },
  SG: { name: 'Singapore', region: AP },
  TH: { name: 'Thailand', region: AP },
  TJ: { name: 'Tajikistan', region: AP },
  TM: { name: 'Turkmenistan', region: AP },
  TW: { name: 'Taiwan', region: AP },
  UZ: { name: 'Uzbekistan', region: AP },
  VN: { name: 'Vietnam', region: AP },
};

/** Region for a country name or ISO code; null for "Unknown" or anything unmapped. */
export function getRegionForCountry(country: string): FindShowRegionName | null {
  const iso = getCountryIsoCode(country);
  return iso ? COUNTRIES_BY_ISO[iso]?.region ?? null : null;
}

export type ResolvedCountry = {
  country: string;
  countryCode: string | null;
  region: FindShowRegionName | null;
};

export const UNKNOWN_LOCATION: ResolvedCountry = {
  country: UNKNOWN_COUNTRY,
  countryCode: null,
  region: null,
};

function fromIso(iso: string): ResolvedCountry {
  const info = COUNTRIES_BY_ISO[iso];
  return info ? { country: info.name, countryCode: iso, region: info.region } : UNKNOWN_LOCATION;
}

/** A parsed seed country string ("UAE - United Arab Emirates") → canonical country. */
export function resolveSeedCountry(rawCountry: string): ResolvedCountry {
  const iso = getCountryIsoCode(rawCountry);
  return iso ? fromIso(iso) : UNKNOWN_LOCATION;
}

// --- Inference for location-less records -----------------------------------

/**
 * Place words → ISO code: country names and local spellings, plus the cities,
 * states and regions that actually occur in the seed's location-less records.
 * Matched on whole words against accent-stripped, lower-cased text.
 * Deliberately absent: "us" (the pronoun), "america" (continent), bare
 * "georgia"/"jordan"/"turkey" (too many other meanings in prose — they still
 * match through the canonical names in names only).
 */
const PLACE_WORDS: Record<string, string> = {
  // countries, aliases, local spellings
  usa: 'US', 'u s a': 'US', 'united states': 'US',
  uk: 'GB', 'united kingdom': 'GB', britain: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB',
  uae: 'AE', 'united arab emirates': 'AE', dubai: 'AE', 'abu dhabi': 'AE',
  ksa: 'SA', 'saudi arabia': 'SA', saudi: 'SA', riyadh: 'SA', jeddah: 'SA',
  korea: 'KR', 'south korea': 'KR', seoul: 'KR',
  suisse: 'CH', schweiz: 'CH', swiss: 'CH', switzerland: 'CH',
  deutschland: 'DE', deutsche: 'DE', deutscher: 'DE', maroc: 'MA', turkiye: 'TR', tunisie: 'TN',
  // cities / states / regions seen in location-less records
  atlanta: 'US', 'las vegas': 'US', nashville: 'US', boston: 'US', 'san antonio': 'US',
  'san francisco': 'US', 'new york': 'US', orlando: 'US', chicago: 'US', alaska: 'US', texas: 'US',
  ottawa: 'CA', quebec: 'CA', toronto: 'CA', montreal: 'CA', vancouver: 'CA',
  paris: 'FR', lyon: 'FR', finistere: 'FR', gironde: 'FR', aquitaine: 'FR', 'cote d azur': 'FR',
  'seine saint denis': 'FR', cannes: 'FR',
  dusseldorf: 'DE', niederrhein: 'DE', munich: 'DE', berlin: 'DE', frankfurt: 'DE', cologne: 'DE',
  vienna: 'AT', helsinki: 'FI', krakow: 'PL', minikowo: 'PL', modena: 'IT', milan: 'IT',
  mersin: 'TR', istanbul: 'TR', jakarta: 'ID', dakar: 'SN', indore: 'IN', mumbai: 'IN',
  'new delhi': 'IN', colombo: 'LK', dongguan: 'CN', shanghai: 'CN', beijing: 'CN', guangzhou: 'CN',
  'far east region of russia': 'RU',
};

/**
 * Demonyms → ISO code. Weaker than a place name: in a description they
 * usually describe a market or a sector ("solutions for the American market",
 * "the Polish biotechnology sector"), not where the show is held, so the
 * description tier ignores them. They still count in the event name and the
 * organizer ("American Dairy Goat Association"), and as continent hints.
 */
const DEMONYM_WORDS: Record<string, string> = {
  american: 'US', canadian: 'CA', mexican: 'MX', brazilian: 'BR', cuban: 'CU', colombian: 'CO',
  french: 'FR', francaise: 'FR', francaises: 'FR', italian: 'IT', italiana: 'IT', italiano: 'IT',
  german: 'DE', polish: 'PL', norwegian: 'NO', romanian: 'RO', greek: 'GR', spanish: 'ES',
  dutch: 'NL', british: 'GB', turkish: 'TR', russian: 'RU', czech: 'CZ',
  indian: 'IN', chinese: 'CN', japanese: 'JP', vietnamese: 'VN', pakistani: 'PK',
  indonesian: 'ID', australian: 'AU', moroccan: 'MA', nigerian: 'NG', kenyan: 'KE',
};

/** Demonyms that are part of a wider, non-country phrase ("Latin American"). */
const NON_COUNTRY_PHRASES = /\b(latin|north|south|central|pan|meso)\s+american\b/g;

/**
 * Country-code TLDs that name a country. Generic-use ccTLDs (.co, .ai, .io,
 * .me, .tv, .fm, .cc) are left out: they say nothing about where a show is.
 */
const WEBSITE_TLDS = new Set([
  'at', 'au', 'be', 'br', 'ca', 'ch', 'cn', 'cz', 'de', 'dk', 'es', 'fi', 'fr', 'gr', 'hu', 'in',
  'it', 'jp', 'kr', 'kz', 'ma', 'mx', 'nl', 'no', 'pk', 'pl', 'pt', 'ro', 'ru', 'se', 'sk', 'tn',
  'tr', 'ua', 'uk', 'vn', 'za',
]);

/**
 * Events whose country cannot be read off the record but is well established
 * (a show held in the same city every year), and events the rules would
 * misfile — a rotating international conference whose domain or organizer
 * points at the organizer's home country, not the venue. Keyed by event name.
 * `null` pins the event to Unknown.
 */
const EVENT_COUNTRY_OVERRIDES: Record<string, { iso: string | null; reason: string }> = {
  'MIP TV': { iso: 'FR', reason: 'MIPTV is held annually at the Palais des Festivals, Cannes' },
  'VISION EXPO EAST': { iso: 'US', reason: 'Vision Expo East is held annually in the eastern United States' },
  'HI DESIGN MEA': { iso: 'AE', reason: 'Hi Design MEA (Middle East & Africa) is held in Dubai' },
  'MIDDLE EAST RAIL': { iso: 'AE', reason: 'Middle East Rail is held annually in Dubai' },
  'MOBILITY LIVE ME': { iso: 'AE', reason: 'Mobility Live ME is held in Dubai (Terrapinn Middle East FZ LLC)' },
  'DISPLAY WEEK - SID': { iso: 'US', reason: 'SID Display Week is held annually in the United States' },
  'DAC (DESIGN AUTOMATION CONFERENCE)': { iso: 'US', reason: 'DAC is held annually in San Francisco' },
  'CATERSOURCE + THE SPECIAL EVENT.': { iso: 'US', reason: 'Catersource + The Special Event is a US show' },
  'BORDER SECURITY EXPO': { iso: 'US', reason: 'US border-community show (Eagle Eye Expositions, Phoenix)' },
  'STREAMING MEDIA': { iso: 'US', reason: 'Streaming Media conference is held in the United States' },
  'RE+ STORAGE': { iso: 'US', reason: 'RE+ events are held in the United States' },
  'PGA FALL EXPO': { iso: 'US', reason: 'PGA Fall Expo is held in Las Vegas' },
  'DESTINATION EAST': { iso: 'US', reason: 'Northstar hosted-buyer event for the US East' },
  'PHOTONICS NORTH': { iso: 'CA', reason: 'Photonics North is Canada’s photonics conference (Conférium, Québec)' },
  'CHRISTMAS EXPO': { iso: 'US', reason: 'US holiday-decorating trade show (Pro Show Inc)' },
  'HOSPITALITY DESIGN SUMMIT': { iso: 'US', reason: 'Emerald HD Summit is held in the United States' },
  'BOUTIQUE DESIGN MATCH': { iso: 'US', reason: 'Emerald Boutique Design event held in the United States' },
  'BD SUMMER FORUM': { iso: 'US', reason: 'Emerald Boutique Design Forum held in the United States' },
  'CAMPUS SAFETY CONFERENCE': { iso: 'US', reason: 'US campus-safety conference (Emerald Expositions)' },
  'RDH UNDER ONE ROOF': { iso: 'US', reason: 'US dental-hygiene conference (Endeavor Business Media)' },
  'WOW - WORLD OF WIPES': { iso: 'US', reason: 'INDA’s World of Wipes is held in the United States' },
  'TRACTION SUMMIT': { iso: 'US', reason: 'Smithers Traction Summit is held in the United States' },
  'ATD INTERNATIONAL CONFERENCE & EXPOSITION': { iso: 'US', reason: 'ATD’s annual conference moves between US cities' },
  'ATCA AVIATION LEADERSHIP FORUM': { iso: 'US', reason: 'US air-traffic-control association forum (Washington area)' },
  'DRINKS AMERICA': { iso: 'US', reason: 'Vinexposium’s Drinks America is held in New York' },
  EXPOPARTES: { iso: 'CO', reason: 'Organized by Asopartes, the Colombian auto-parts association, in Bogotá' },
  NEUROCONVENTION: { iso: 'GB', reason: 'Neuro Convention is held at the NEC Birmingham (ROAR ME Ltd, UK)' },
  MIM: { iso: 'US', reason: 'MPIF’s MIM conference is held in the United States each year' },
  'ATMOSPHERE AMERICA SUMMIT': { iso: 'US', reason: 'ATMO America summit is held in the United States' },
  // Rotating international conferences: keep Unknown.
  ESCAPE: { iso: null, reason: 'Rotating European symposium; the .co.uk domain is the organizer’s, not the venue’s' },
  MARELEC: { iso: null, reason: 'Rotating international conference; the .co.uk domain is the organizer’s' },
  'WORLD OF COFFEE - EUROPE': { iso: null, reason: 'Moves between European cities each year; organizer being UK-based says nothing about the venue' },
  'MEDICAL WELLNESS CONGRESS': { iso: null, reason: 'Only the organizer name mentions Germany; no venue evidence' },
  'IPC -INTERNATIONAL SCIENTIFIC CONFERENCE ON PROBIOTICS, PREBIOTICS, GUT MICROBIOTA AND HEALTH': {
    iso: null,
    reason: 'International conference; only the organizer (CZECH-IN) hints at a country',
  },
};

/**
 * Location of one specific edition, checked against the organizer's own
 * site or announcement for that edition. For shows that move every year,
 * where a name-level override would be wrong the following year.
 *
 * Why this table exists: eventseye's month calendar, which the seed is scraped
 * from, prints only "?" in the location cell when the city is not fixed yet.
 * Keyed by event name; an entry applies only while the record's dates fall in
 * `edition`, so when the seed rolls to the next edition the event goes back
 * through the normal tiers (and to Unknown) until that edition is verified.
 *
 * eventseye's own "? (Country)" for a future edition is NOT enough on its own:
 * it repeats the previous edition's country (Setcor 2027 listed as Portugal,
 * held in Rome; PAvCon 2027 listed as Malaga, not yet decided).
 *
 * `confidence` is `high` when the organizer publishes the city for that
 * edition, `medium` when it publishes only the country, or the location
 * follows from an official co-location or a date-less organizer statement.
 */
export type VerifiedEdition = {
  edition: number;
  iso: string;
  /** Host city when the organizer has announced it. */
  city?: string;
  confidence: Extract<CountryConfidence, 'high' | 'medium'>;
  evidence: string;
  sourceUrl: string;
};

export const VERIFIED_EDITIONS: Readonly<Record<string, VerifiedEdition>> = {
  // Americas
  'LATAMPAPER': {
    edition: 2027,
    iso: 'MX',
    city: 'Mexico City',
    confidence: 'high',
    evidence:
      'Official site: "LATAM PAPER MÉXICO 2027 — 9-10 JUN, Mexico City", Hilton Mexico City Reforma',
    sourceUrl: 'https://www.latampaper.com',
  },
  'REFRI AMERICAS': {
    edition: 2027,
    iso: 'CR',
    city: 'San José',
    confidence: 'high',
    evidence:
      'Official site: Refriaméricas 2027, July 28-29 2027, Costa Rica Convention Center, San José',
    sourceUrl: 'https://www.refriamericas.com/en',
  },
  'CAPA AIRLINE LEADER SUMMIT - AMERICAS': {
    edition: 2027,
    iso: 'CA',
    city: 'Edmonton',
    confidence: 'high',
    evidence:
      'CAPA events page: "To be held in Edmonton, Canada on 10-11 June 2027" (2026 was Charleston, SC)',
    sourceUrl: 'https://centreforaviation.com/events',
  },
  'LATIN AMERICAN HIGH SECURITY PRINTING CONFERENCE': {
    edition: 2027,
    iso: 'CA',
    city: 'Ottawa',
    confidence: 'high',
    evidence:
      'Official site: "High Security Printing Americas 2027", 7-9 June 2027, Ottawa, Canada (2026 was Bogotá)',
    sourceUrl: 'https://hsp-latinamerica.com',
  },
  'FIRE RETARDANTS IN PLASTICS NORTH AMERICA': {
    edition: 2027,
    iso: 'US',
    confidence: 'medium',
    evidence:
      'AMI upcoming-events listing: "The 15th edition of Fire Retardants in Plastics will take place in the USA" (no city yet; 2026 was Cleveland, OH)',
    sourceUrl: 'https://www.amiplastics.com/events/listing?type=Conference&time=upcoming',
  },
  'BANKSPACES': {
    edition: 2027,
    iso: 'US',
    city: 'Fort Lauderdale',
    confidence: 'high',
    evidence:
      'Official site: "May 23-25, 2027 | Fort Lauderdale, FL"',
    sourceUrl: 'https://bankspaces.com',
  },
  // Europe
  'NUTRACEUTICALS EUROPE': {
    edition: 2027,
    iso: 'ES',
    city: 'Madrid',
    confidence: 'high',
    evidence:
      'Official announcement: next edition 17-18 February 2027, Hall 1, IFEMA Madrid',
    sourceUrl: 'https://www.nutraceuticalseurope.com',
  },
  'ENVIROTECH + WORLD CEMENT': {
    edition: 2027,
    iso: 'ES',
    city: 'Madrid',
    confidence: 'high',
    evidence:
      'World Cement / Palladian event page "EnviroTech Madrid 2027": 7-10 March 2027, Eurostars Madrid Tower',
    sourceUrl: 'https://www.worldcoal.com/events/envirotech-madrid-2027/',
  },
  'FASTMARKETS FOREST PRODUCTS EUROPE CONFERENCE': {
    edition: 2027,
    iso: 'NL',
    city: 'Amsterdam',
    confidence: 'high',
    evidence:
      'Official page: "returns to Amsterdam, Netherlands, on March 1-3, 2027"',
    sourceUrl: 'https://www.fastmarkets.com/events/fastmarkets-forest-products-europe-conference/',
  },
  'CAPA AIRLINE LEADER SUMMIT - AIRLINES IN TRANSITION': {
    edition: 2027,
    iso: 'SK',
    city: 'Bratislava',
    confidence: 'high',
    evidence:
      'CAPA events page: Airlines in Transition 2027, 8-9 Apr 2027, Bratislava, Slovakia',
    sourceUrl: 'https://centreforaviation.com/events',
  },
  'EUROPEAN FOOD MANUFACTURING SUMMIT': {
    edition: 2027,
    iso: 'DE',
    city: 'Düsseldorf',
    confidence: 'high',
    evidence:
      'Official site: 20-21 May 2027, Crowne Plaza Düsseldorf-Neuss, Düsseldorf, Germany',
    sourceUrl: 'https://foodmaneurope.com',
  },
  'LARGE SCALE SOLAR EUROPE': {
    edition: 2027,
    iso: 'IT',
    city: 'Milan',
    confidence: 'high',
    evidence:
      'Official site: Large Scale Solar Europe is now SolarPLUS Europe, April 2027, Milan, Italy',
    sourceUrl: 'https://lss.solarenergyevents.com',
  },
  'FESPA': {
    edition: 2027,
    iso: 'DE',
    city: 'Munich',
    confidence: 'high',
    evidence:
      'FESPA news: "FESPA Global Print Expo set to return to Munich for 2027 events" (6-9 April 2027, Messe München)',
    sourceUrl: 'https://www.fespa.com/en/news-media/fespa-global-print-expo-set-to-return-to-munich-for-2027-events/',
  },
  'PERSONALISATION EXPERIENCE': {
    edition: 2027,
    iso: 'DE',
    city: 'Munich',
    confidence: 'medium',
    evidence:
      'Co-located with FESPA Global Print Expo 2027 in Munich (official site refers to "FESPA 2027" opening times)',
    sourceUrl: 'https://www.personalisationexperience.com',
  },
  'SEANERGY': {
    edition: 2027,
    iso: 'FR',
    city: 'Montpellier',
    confidence: 'high',
    evidence:
      'Official site: Seanergy 2027, 10-11 March 2027, Montpellier',
    sourceUrl: 'https://www.seanergy-forum.com',
  },
  'VETFORUM EUROPE': {
    edition: 2027,
    iso: 'ES',
    city: 'Sitges',
    confidence: 'high',
    evidence:
      'Official page: "Hotel Eurostars, Sitges, Spain | 4-5 May, 2027"',
    sourceUrl: 'https://vets.openroomevents.com/vetforum-europe',
  },
  'EHP CONGRESS': {
    edition: 2027,
    iso: 'FR',
    city: 'Marseille',
    confidence: 'high',
    evidence:
      'Euroheat & Power: 45th congress, 8-10 June 2027, Marseille, France',
    sourceUrl: 'https://www.euroheat.org/events/euroheat-and-power-congress-2027',
  },
  'ESCAPE': {
    edition: 2027,
    iso: 'NO',
    city: 'Trondheim',
    confidence: 'high',
    evidence:
      'Official site: ESCAPE37, 7-10 June 2027, Trondheim, Norway, hosted by NTNU',
    sourceUrl: 'https://www.escape37.com',
  },
  'EUROMED - DESALINATION CONGRESS': {
    edition: 2027,
    iso: 'GB',
    city: 'Liverpool',
    confidence: 'high',
    evidence:
      'European Desalination Society: 4-7 May 2027, Lex Liverpool Convention Centre',
    sourceUrl: 'https://congress.edsoc.com',
  },
  'HLPC': {
    edition: 2027,
    iso: 'AT',
    city: 'Innsbruck',
    confidence: 'high',
    evidence:
      'Official site: HPLC 2027 (56th symposium), June 20-24 2027, Congress Innsbruck, Austria (2026 was Indianapolis)',
    sourceUrl: 'https://www.hplc2027.com',
  },
  'IPC -INTERNATIONAL SCIENTIFIC CONFERENCE ON PROBIOTICS, PREBIOTICS, GUT MICROBIOTA AND HEALTH': {
    edition: 2027,
    iso: 'PL',
    city: 'Kraków',
    confidence: 'high',
    evidence:
      'Official site: "22-24 June, 2027 | Kraków, Poland"',
    sourceUrl: 'https://probiotic-conference.net',
  },
  'IRS - INTERNATIONAL RAILWAY SUMMIT': {
    edition: 2027,
    iso: 'DE',
    city: 'Berlin',
    confidence: 'high',
    evidence:
      'Data Edge Media: 15th International Railway Summit, 5-7 October 2027, Berlin, Germany',
    sourceUrl: 'https://dataedgemedia.com/international-railway-summit/',
  },
  'WORLD OF COFFEE - EUROPE': {
    edition: 2027,
    iso: 'PT',
    city: 'Lisbon',
    confidence: 'high',
    evidence:
      'SCA: World of Coffee Lisbon 2027, June 17-19 2027, Lisbon Exhibition and Congress Centre (FIL)',
    sourceUrl: 'https://europe.worldofcoffee.org',
  },
  'UFI EUROPEAN CONFERENCE': {
    edition: 2027,
    iso: 'IT',
    city: 'Rimini',
    confidence: 'high',
    evidence:
      'UFI event page: UFI European Conference 2027, 2-4 June 2027, Rimini Expo Centre (2026 was Izmir)',
    sourceUrl: 'https://www.ufi.org/events/ufi-european-conference-2027/',
  },
  'WORLD RETAIL CONGRESS': {
    edition: 2027,
    iso: 'IT',
    city: 'Milan',
    confidence: 'high',
    evidence:
      'Official site: "10th - 12th May 2027, Marriott | Milan"',
    sourceUrl: 'https://www.worldretailcongress.com',
  },
  'DRY COATINGS DAYS': {
    edition: 2026,
    iso: 'FR',
    city: 'Limoges',
    confidence: 'high',
    evidence:
      'A3TS events: RAVIE 2026 (dry-applied coatings days), 4-5 November 2026, ENSIL-ENSCI, Limoges',
    sourceUrl: 'https://en.a3ts.org/evenements',
  },
  'GREEN AERO DAYS': {
    edition: 2026,
    iso: 'FR',
    city: 'Pau',
    confidence: 'medium',
    evidence:
      'Official site (now General Aviation Days): the 2026 edition is in Pau; eventseye gives Nov. 2026 at Aéroport Pau-Pyrénées',
    sourceUrl: 'https://general-aviation-days.com',
  },
  // Setcor joint conferences — 2027 editions in Rome (2026 was Lisbon; eventseye still says Portugal)
  '3BS MATERIALS TECH': {
    edition: 2027,
    iso: 'IT',
    city: 'Rome',
    confidence: 'high',
    evidence:
      'Setcor: 3Bs MaterialsTech 2027, "Rome, Italy, in May 2027" (joint conferences 12-14 May 2027)',
    sourceUrl: 'https://www.setcor.org/',
  },
  'COMPOSITES': {
    edition: 2027,
    iso: 'IT',
    city: 'Rome',
    confidence: 'high',
    evidence:
      'Setcor: Composites 2027, 12-14 May 2027, Rome, Italy',
    sourceUrl: 'https://www.setcor.org/',
  },
  'POLYMERS': {
    edition: 2027,
    iso: 'IT',
    city: 'Rome',
    confidence: 'high',
    evidence:
      'Setcor home page: Polymers 2027 among the 2027 conferences, May 12-14, Rome, Italy',
    sourceUrl: 'https://www.setcor.org/',
  },
  'PLASMA TECH': {
    edition: 2027,
    iso: 'IT',
    city: 'Rome',
    confidence: 'high',
    evidence:
      'Setcor home page: Plasma Tech 2027 among the 2027 conferences, May 12-14, Rome, Italy',
    sourceUrl: 'https://www.setcor.org/',
  },
  'SICT': {
    edition: 2027,
    iso: 'IT',
    city: 'Rome',
    confidence: 'high',
    evidence:
      'Setcor home page: SICT 2027 among the 2027 conferences, May 12-14, Rome, Italy',
    sourceUrl: 'https://www.setcor.org/',
  },
  'TRIBOLOGY': {
    edition: 2027,
    iso: 'IT',
    city: 'Rome',
    confidence: 'high',
    evidence:
      'Setcor: Tribology 2027 (6th edition) in Rome, Italy; joint conferences 12-14 May 2027',
    sourceUrl: 'https://www.setcor.org/',
  },
  // Filed under Europe, held elsewhere
  'EVS': {
    edition: 2027,
    iso: 'JP',
    city: 'Yokohama',
    confidence: 'high',
    evidence:
      'Official site: EVS40, June 13-16 2027, Pacifico Yokohama, Japan (2026 was Long Beach, CA)',
    sourceUrl: 'https://multipathway.jp/evs40_evtec2027/',
  },
  'TZMI CONGRESS': {
    edition: 2026,
    iso: 'SG',
    city: 'Singapore',
    confidence: 'high',
    evidence:
      'TZMI events page: "TZMI Congress 2026 Singapore"; eventseye: Nov. 17-20 2026, Grand Hyatt Singapore',
    sourceUrl: 'https://www.tzmi.com/events/',
  },
  // Checked and deliberately absent — the organizer has not published this
  // edition's location: GAD AMERICAS; SINGLE-SERVE CAPSULES, POLYMERS IN CABLES
  // and FLEXIBLE PACKAGING INNOVATION AND RECYCLING NORTH AMERICA (eventseye's
  // "? (USA)" only); and the events still under Europe → Unknown.
  // WORLD RECYCLING CONVENTION is absent on purpose: the seed already lists the
  // 2027 edition as "05/05/2027, Milan (Italy)"; the location-less "June 2027 (?)"
  // record is the same eventseye page, so resolving it would list Milan twice.
  // RECYCLING FLEXIBLE PACKAGING EUROPE is absent on purpose: AMI merged it into
  // Flexible Packaging Innovation and Recycling Europe (Vienna), which the seed
  // already lists as its own record — resolving it would show that show twice.
};

/** Four-digit year of a seed date string ("June 2027 (?)", "Jun 09-10, 2027"). */
export function editionYear(dates: string | null | undefined): number | null {
  const year = dates?.match(/\b(20\d{2})\b/)?.[1];
  return year ? Number(year) : null;
}

function foldText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(NON_COUNTRY_PHRASES, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Every canonical country name, folded, → ISO. */
const COUNTRY_NAME_WORDS: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRIES_BY_ISO).map(([iso, info]) => [normalizeCountryKey(info.name), iso])
);

/** Names that are also common English words; never matched in prose. */
const PROSE_AMBIGUOUS = new Set(['georgia', 'jordan', 'turkey', 'chad', 'guinea', 'niger']);

const PLACE_VOCAB: Record<string, string> = { ...COUNTRY_NAME_WORDS, ...PLACE_WORDS };
const PLACE_AND_DEMONYM_VOCAB: Record<string, string> = { ...PLACE_VOCAB, ...DEMONYM_WORDS };
const byLengthDesc = (vocab: Record<string, string>) => Object.keys(vocab).sort((a, b) => b.length - a.length);
const PLACE_PHRASES = byLengthDesc(PLACE_VOCAB);
const PLACE_AND_DEMONYM_PHRASES = byLengthDesc(PLACE_AND_DEMONYM_VOCAB);

/**
 * Distinct ISO codes of every place word in `text`, in order of first
 * appearance. Longest phrases win, so "south korea" is not also "korea".
 * `demonyms: false` matches place names only ("Paris", "Poland"), not
 * "French"/"Polish".
 */
function findPlaces(
  text: string,
  { prose, demonyms = true }: { prose: boolean; demonyms?: boolean }
): string[] {
  let folded = ` ${foldText(text)} `;
  const found: { iso: string; at: number }[] = [];
  const vocab = demonyms ? PLACE_AND_DEMONYM_VOCAB : PLACE_VOCAB;
  const phrases = demonyms ? PLACE_AND_DEMONYM_PHRASES : PLACE_PHRASES;

  for (const phrase of phrases) {
    if (prose && PROSE_AMBIGUOUS.has(phrase)) continue;
    const needle = ` ${phrase} `;
    let at = folded.indexOf(needle);
    while (at !== -1) {
      found.push({ iso: vocab[phrase], at });
      // Blank the match so a shorter phrase inside it cannot match again.
      folded = folded.slice(0, at) + ' '.repeat(needle.length - 1) + folded.slice(at + needle.length - 1);
      at = folded.indexOf(needle);
    }
  }

  return Array.from(new Set(found.sort((a, b) => a.at - b.at).map((hit) => hit.iso)));
}

function websiteTld(website: string): string | null {
  const host = website.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0].toLowerCase();
  const tld = host.split('.').pop() ?? '';
  return WEBSITE_TLDS.has(tld) ? tld : null;
}

/** Which field decided the country; `none` when it stays Unknown. */
export type CountrySource =
  | 'seed-location'
  | 'verified-edition'
  | 'override'
  | 'venue'
  | 'event-name'
  | 'description'
  | 'website-url'
  | 'website-domain'
  | 'organizer'
  | 'none';

/**
 * How far the source can be trusted: `high` names the venue's country
 * directly (the seed's "City (Country)", a curated fixed venue, the venue
 * text); `medium` names a place tied to the event (its name, a place in the
 * description or the URL); `low` is circumstantial (a ccTLD or the organizer's
 * nationality); `none` is Unknown.
 */
export type CountryConfidence = 'high' | 'medium' | 'low' | 'none';

export const SOURCE_CONFIDENCE: Record<CountrySource, CountryConfidence> = {
  'seed-location': 'high',
  // Per entry (high or medium); see VERIFIED_EDITIONS.
  'verified-edition': 'medium',
  override: 'high',
  venue: 'high',
  'event-name': 'medium',
  description: 'medium',
  'website-url': 'medium',
  'website-domain': 'low',
  organizer: 'low',
  none: 'none',
};

export type CountryInference = ResolvedCountry & {
  /** Which field decided it, or why nothing could. */
  evidence: string;
  source: CountrySource;
  confidence: CountryConfidence;
  /** Host city, only when a verified edition names one. */
  city?: string;
};

function inferred(iso: string, source: CountrySource, evidence: string): CountryInference {
  return { ...fromIso(iso), evidence, source, confidence: SOURCE_CONFIDENCE[source] };
}

type InferenceInput = {
  name: string;
  /** Seed date text; selects the edition a VERIFIED_EDITIONS entry covers. */
  dates?: string | null;
  description?: string | null;
  organizer?: string | null;
  website?: string | null;
  venue?: string | null;
};

function single(isos: string[]) {
  return isos.length === 1 ? isos[0] : null;
}

/**
 * Best country for a record with no parsed location. Evidence, strongest
 * first — the first tier that points at exactly one country wins:
 *   1. a verified location for this edition, then a curated override (known
 *      fixed venue, or a veto);
 *   2. the venue, when there is one;
 *   3. the event name — its last " - " segment first ("STUDY IN INDIA EXPO -
 *      SRI LANKA - COLOMBO" is in Colombo), then the whole name;
 *   4. place names in the description (not demonyms — see DEMONYM_WORDS);
 *   5. place words in the website URL (city subdomains/paths), then its ccTLD;
 *   6. the organizer name.
 * A tier naming two different countries is ambiguous and falls through.
 */
export function inferEventCountry(record: InferenceInput): CountryInference {
  const key = record.name.trim().toUpperCase();
  const edition = VERIFIED_EDITIONS[key];
  if (edition && editionYear(record.dates) === edition.edition) {
    return {
      ...fromIso(edition.iso),
      ...(edition.city ? { city: edition.city } : {}),
      source: 'verified-edition',
      confidence: edition.confidence,
      evidence: `verified ${edition.edition} edition: ${edition.evidence} (${edition.sourceUrl})`,
    };
  }

  const override = EVENT_COUNTRY_OVERRIDES[key];
  if (override) {
    return override.iso
      ? inferred(override.iso, 'override', `known venue: ${override.reason}`)
      : unknownInContinent(record, override.reason, 'override');
  }

  const venue = record.venue?.trim();
  if (venue && venue !== '?') {
    const iso = single(findPlaces(venue, { prose: true }));
    if (iso) return inferred(iso, 'venue', 'venue');
  }

  const segments = record.name.split(/\s+-\s+/);
  for (let index = segments.length - 1; index >= 1; index -= 1) {
    const iso = single(findPlaces(segments[index], { prose: false }));
    if (iso) return inferred(iso, 'event-name', `event name ("${segments[index].trim()}")`);
  }
  const fromName = single(findPlaces(record.name, { prose: false }));
  if (fromName) return inferred(fromName, 'event-name', 'event name');

  const fromDescription = single(findPlaces(record.description ?? '', { prose: true, demonyms: false }));
  if (fromDescription) return inferred(fromDescription, 'description', 'description');

  const website = record.website ?? '';
  const fromUrl = single(findPlaces(website.replace(/^[a-z]+:\/\//i, ''), { prose: true }));
  if (fromUrl) return inferred(fromUrl, 'website-url', 'website URL');
  const tld = websiteTld(website);
  const fromTld = tld === 'uk' ? 'GB' : tld?.toUpperCase();
  if (fromTld && COUNTRIES_BY_ISO[fromTld]) {
    return inferred(fromTld, 'website-domain', `website domain (.${tld})`);
  }

  const fromOrganizer = single(findPlaces(record.organizer ?? '', { prose: true }));
  if (fromOrganizer) return inferred(fromOrganizer, 'organizer', 'organizer');

  return unknownInContinent(record, describeMissingEvidence(record));
}

/** Why a record stays Unknown — for the cleanup report. */
function describeMissingEvidence(record: InferenceInput) {
  const text = `${record.name} ${record.description ?? ''}`.toLowerCase();
  const regionWord = text.match(/\b(europe|european|asia|asian|africa|african|americas|north america|latin america|middle east|mena|balkan|mediterranean|global|world|international)\b/)?.[1];
  const detail = regionWord ? `only a region-level or global scope ("${regionWord}")` : 'no place name';
  return `No city, venue or country on the record; ${detail} in name/description, and the website/organizer give no single country`;
}

// --- Continent for events that stay Unknown ---------------------------------

/**
 * Region-level words → continent. An event with no provable country still
 * belongs to a continent, so it is listed as that continent's "Unknown"
 * entry (Europe → Unknown) rather than outside the continent structure.
 */
const CONTINENT_WORDS: Record<string, FindShowRegionName> = {
  europe: EU, european: EU, eu: EU, balkan: EU, balkans: EU, nordic: EU, nordics: EU,
  scandinavia: EU, scandinavian: EU, baltic: EU, baltics: EU, 'central europe': EU,
  asia: AP, asian: AP, apac: AP, 'asia pacific': AP, pacific: AP, 'far east': AP, asean: AP, oceania: AP,
  africa: AME, african: AME, 'middle east': AME, mena: AME, mea: AME, gcc: AME, gulf: AME,
  arab: AME, arabian: AME,
  america: AM, americas: AM, american: AM, 'north america': AM, 'latin america': AM, latam: AM,
  'south america': AM, 'central america': AM, caribbean: AM,
};

/** Distinct continents named by region words in `text`. */
function findContinents(text: string): FindShowRegionName[] {
  // Not foldText: that strips "Latin American", which is exactly a region word here.
  const words = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const folded = ` ${words.trim()} `;
  const found = new Set<FindShowRegionName>();
  for (const [phrase, region] of Object.entries(CONTINENT_WORDS)) {
    if (folded.includes(` ${phrase} `)) found.add(region);
  }
  return Array.from(found);
}

/**
 * Continent for an event whose country is not proven. Strongest first; the
 * first tier naming exactly one continent wins:
 *   1. region words in the event name ("HI DESIGN ASIA" → Asia-Pacific), its
 *      last " - " segment first;
 *   2. region words in the description;
 *   3. country hints too weak to name the country — the organizer's or the
 *      website domain's country, or several countries in the text — when they
 *      all sit on one continent (a .co.uk domain still means Europe);
 *   4. Europe, where every unlocated event sat before this cleanup, so no
 *      event ever falls outside the continent structure.
 */
export function inferUnknownContinent(record: InferenceInput): { region: FindShowRegionName; evidence: string } {
  const segments = record.name.split(/\s+-\s+/);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const regions = findContinents(segments[index]);
    if (regions.length === 1) return { region: regions[0], evidence: 'region named in the event name' };
  }
  const nameRegions = findContinents(record.name);
  if (nameRegions.length === 1) return { region: nameRegions[0], evidence: 'region named in the event name' };

  const descriptionRegions = findContinents(record.description ?? '');
  if (descriptionRegions.length === 1) {
    return { region: descriptionRegions[0], evidence: 'region named in the description' };
  }

  const website = record.website ?? '';
  const tld = websiteTld(website);
  const hints = [
    ...findPlaces(record.name, { prose: false }),
    ...findPlaces(`${record.venue ?? ''} ${record.description ?? ''} ${record.organizer ?? ''}`, { prose: true }),
    ...findPlaces(website.replace(/^[a-z]+:\/\//i, ''), { prose: true }),
    ...(tld ? [tld === 'uk' ? 'GB' : tld.toUpperCase()] : []),
  ];
  const hintRegions = Array.from(new Set(hints.map((iso) => COUNTRIES_BY_ISO[iso]?.region).filter(Boolean)));
  if (hintRegions.length === 1) {
    return { region: hintRegions[0] as FindShowRegionName, evidence: 'country hints (organizer/website/text) all on one continent' };
  }

  return { region: EU, evidence: 'no regional evidence; kept in Europe, the previous home of unlocated events' };
}

function unknownInContinent(
  record: InferenceInput,
  reason: string,
  source: CountrySource = 'none'
): CountryInference {
  const continent = inferUnknownContinent(record);
  return {
    country: UNKNOWN_COUNTRY,
    countryCode: null,
    region: continent.region,
    evidence: `${reason}. Continent: ${continent.region} (${continent.evidence})`,
    source,
    confidence: 'none',
  };
}
