export type FindShowsRegion =
  | 'All Regions'
  | 'Americas'
  | 'Europe'
  | 'Africa & Middle East'
  | 'Asia-Pacific';

export type FindShowsCategory =
  | 'All Categories'
  | 'Manufacturing & Engineering'
  | 'Plastics & Rubber'
  | 'Medical & Healthcare'
  | 'Food & Beverage'
  | 'Technology & Electronics'
  | 'Construction & Building'
  | 'Energy & Environment'
  | 'Automotive'
  | 'Packaging'
  | 'Textiles & Fashion'
  | 'Agriculture'
  | 'Security & Safety'
  | 'General';

export type FindShowFilterOption<T extends string = string> = {
  label: string;
  value: T;
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
  categories: string[];
  frequency: string;
  website: string;
  email: string;
  eventseyeUrl?: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
};

export type FindShowEvent = {
  slug: string;
  name: string;
  dates: string;
  city: string;
  country: string;
  region: Exclude<FindShowsRegion, 'All Regions'>;
  venue: string;
  organizer: string;
  frequency: string;
  website: string;
  email: string;
  rawCategories: string[];
  categories: Exclude<FindShowsCategory, 'All Categories'>[];
  primaryCategory: Exclude<FindShowsCategory, 'All Categories'>;
  startDate: string;
  endDate: string;
  startMonth: string;
  endMonth: string;
  displayDate: string;
  searchText: string;
  seedAsset: FindShowAsset;
};
