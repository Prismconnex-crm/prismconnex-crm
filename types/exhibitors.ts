export type Exhibitor = {
  /** Unique ID derived from name + event slug */
  id: string;
  /** Display name of the exhibitor company */
  name: string;
  /** URL to company logo (nullable — UI uses fallback) */
  logoUrl: string | null;
  /** Booth / stand number at the event */
  stand: string | null;
  /** Exhibitor's own website URL */
  website: string | null;
  /** Short description or tagline */
  description: string | null;
  /** Link to the exhibitor's profile on the event website */
  profileUrl: string | null;
  /** Country of the exhibitor (if available) */
  country: string | null;
};

export type ExhibitorCacheEntry = {
  /** Event slug this data belongs to */
  eventSlug: string;
  /** ISO timestamp of when the data was fetched */
  lastFetched: string;
  /** Data source indicator */
  source: 'scraped' | 'manual';
  /** The actual exhibitor records */
  exhibitors: Exhibitor[];
};

export type ExhibitorCacheStore = Record<string, ExhibitorCacheEntry>;
