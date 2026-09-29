import type { FindShowCategoryName } from '@/lib/find-shows/categories';

export type FindShowsRegion =
  | 'All Regions'
  | 'Americas'
  | 'Europe'
  | 'Africa & Middle East'
  | 'Asia-Pacific';

/** The taxonomy lives in lib/find-shows/categories.ts; this adds the reset option. */
export type FindShowsCategory = 'All Categories' | FindShowCategoryName;

export type FindShowFilterOption<T extends string = string> = {
  label: string;
  value: T;
  /** Number of events matching this option, when the source can supply it. */
  count?: number;
};

export type FindShowAsset = {
  bannerUrl: string | null;
  logoUrl: string | null;
  eventseyeUrl: string | null;
};

export type FindShowDetail = FindShowAsset & {
  description: string | null;
  fullVenueAddress: string | null;
  visitorCount: number | null;
  exhibitorCount: number | null;
  website: string | null;
  lastUpdated: string | null;
};

export type FindShowFilters = {
  query: string;
  region: FindShowsRegion;
  country: string;
  category: FindShowsCategory;
  startMonth: string;
  endMonth: string;
};

export type FindShowSeedRecord = {
  name: string;
  dates: string;
  city: string;
  venue: string;
  organizer: string;
  /** Legacy combined buckets; the catalog re-derives real categories from name + description. */
  categories: string[];
  frequency: string;
  website: string;
  email: string;
  eventseyeUrl?: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  /** Editorial blurb from the eventseye calendar listing. */
  description?: string;
  /** "August 2026" — drives the Month-Year filter. */
  monthYear?: string;
  /** e.g. "6 days", when the listing states it. */
  duration?: string;
};

export type FindShowEvent = {
  slug: string;
  name: string;
  dates: string;
  city: string;
  /** Canonical country name, or "Unknown" when no evidence places the event. */
  country: string;
  /** ISO 3166-1 alpha-2 (XK for Kosovo); null for "Unknown". */
  countryCode: string | null;
  /** Continent. An "Unknown"-country event still has one, from region-level evidence. */
  region: Exclude<FindShowsRegion, 'All Regions'>;
  venue: string;
  organizer: string;
  frequency: string;
  website: string;
  email: string;
  /** Legacy combined buckets stored in the seed; provenance only, never filtered or searched. */
  rawCategories: string[];
  /** Every category the event belongs to, primary first (lib/find-shows/categories.ts). */
  categories: Exclude<FindShowsCategory, 'All Categories'>[];
  primaryCategory: Exclude<FindShowsCategory, 'All Categories'>;
  startDate: string;
  endDate: string;
  startMonth: string;
  endMonth: string;
  displayDate: string;
  searchText: string;
  seedAsset: FindShowAsset;
  /** Editorial blurb shown in the event Overview tab. */
  description: string;
  /** Unsplit seed city string ("London (UK - United Kingdom)") — the key into
   *  data/city-coordinates.json. */
  seedCity: string;
  /** "August 2026" — drives the Month-Year filter. */
  monthYear: string;
  duration: string;
};
