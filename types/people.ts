/**
 * Shared types for the People AI Explorer (left filter rail + chat + results).
 *
 * `PeopleFilters` is the single source of truth for both the rail and the
 * assistant: it is what the URL serialises, what the chat receives as
 * `activeFilters`, and what a chat reply's "Apply filters" writes back. That one
 * direction of truth is what makes the two panels bidirectional without a sync
 * effect.
 *
 * Every list-valued key is `string[]` rather than a narrow union array, matching
 * `EventFilters` in `types/events.ts`, so generic chip and facet code can index
 * `filters[key]`. Closed vocabularies are enforced when parsing URL params.
 */

export const SENIORITIES = [
  'C-Level',
  'VP',
  'Director',
  'Manager',
  'Senior',
  'Individual Contributor',
  'Entry',
] as const;
export type Seniority = (typeof SENIORITIES)[number];

export const DEPARTMENTS = [
  'Marketing',
  'Sales',
  'Engineering',
  'Product',
  'Operations',
  'Finance',
  'HR',
  'Procurement',
  'Legal',
  'IT',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const HEADCOUNT_BANDS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+',
] as const;
export type HeadcountBand = (typeof HEADCOUNT_BANDS)[number];

export const VERIFICATION_STATUSES = ['verified', 'needs_verification', 'invalid'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const DATA_SOURCES = ['user_import', 'licensed_dataset', 'enrichment'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const BUYING_INTENTS = ['high', 'medium', 'low', 'none'] as const;
export type BuyingIntent = (typeof BUYING_INTENTS)[number];

/** Confidence ships as chips, not a slider (spec decision 6). */
export const CONFIDENCE_THRESHOLDS = [50, 70, 90] as const;
export type ConfidenceThreshold = (typeof CONFIDENCE_THRESHOLDS)[number];

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  seniority: Seniority;
  department: Department;
  company: string;
  companyDomain: string;
  companyHeadcount: HeadcountBand;
  industry: string;
  country: string;
  location: string;
  workEmail: string;
  phone: string | null;
  linkedinUrl: string | null;
  verification: VerificationStatus;
  /** 0-100. */
  confidence: number;
  /** 0-100. */
  platformScore: number;
  source: DataSource;
  keywords: string[];
  buyingIntent: BuyingIntent;
  /** ISO date, when this record was last refreshed. */
  fetchedAt: string;
  /** ISO date of the contact's last observed activity. */
  lastActiveAt: string;
};

export type PeopleFilters = {
  titles: string[];
  seniorities: string[];
  departments: string[];
  companies: string[];
  locations: string[];
  countries: string[];
  headcounts: string[];
  industries: string[];
  keywords: string[];
  buyingIntents: string[];
  sources: string[];
  /** Single-select — "All" is represented by null. */
  verification: VerificationStatus | null;
  /** Single-select floor; null means no confidence constraint. */
  minConfidence: ConfidenceThreshold | null;
  /** Id of the person to rank similarity against. */
  lookalikeSeedId: string | null;
  /** The rail's free-text box. */
  search: string;
};

export type PeopleFilterListKey =
  | 'titles'
  | 'seniorities'
  | 'departments'
  | 'companies'
  | 'locations'
  | 'countries'
  | 'headcounts'
  | 'industries'
  | 'keywords'
  | 'buyingIntents'
  | 'sources';

export const PEOPLE_FILTER_LIST_KEYS: PeopleFilterListKey[] = [
  'titles',
  'seniorities',
  'departments',
  'companies',
  'locations',
  'countries',
  'headcounts',
  'industries',
  'keywords',
  'buyingIntents',
  'sources',
];

export function emptyPeopleFilters(): PeopleFilters {
  return {
    titles: [],
    seniorities: [],
    departments: [],
    companies: [],
    locations: [],
    countries: [],
    headcounts: [],
    industries: [],
    keywords: [],
    buyingIntents: [],
    sources: [],
    verification: null,
    minConfidence: null,
    lookalikeSeedId: null,
    search: '',
  };
}

export function hasAnyPeopleFilter(filters: PeopleFilters): boolean {
  return (
    PEOPLE_FILTER_LIST_KEYS.some((key) => filters[key].length > 0) ||
    filters.verification !== null ||
    filters.minConfidence !== null ||
    filters.lookalikeSeedId !== null ||
    filters.search.trim().length > 0
  );
}

/** Header badge + data-source strip numbers. Never hardcoded in a component. */
export type PeopleStats = {
  total: number;
  avgConfidence: number;
  lastFetchedAt: string;
  sources: DataSource[];
};
