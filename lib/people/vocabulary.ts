import {
  DEPARTMENTS,
  HEADCOUNT_BANDS,
  SENIORITIES,
  type Department,
  type HeadcountBand,
  type Seniority,
  type VerificationStatus,
} from '@/types/people';

/**
 * How a human's words map onto the closed vocabularies. Used by the query
 * parser and by URL param validation, so "unverified" in a sentence and
 * `?verification=needs_verification` in a link land on the same value.
 */

export function normalizePeopleText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Enough English plural handling for job titles and department words. */
export function singularize(word: string): string {
  const lower = word.toLowerCase();
  // "sales", "operations" and friends are already singular as department names.
  if (/(?:ss|sis|us|sales|analytics|operations)$/.test(lower)) return lower;
  if (lower.endsWith('ies') && lower.length > 4) return `${lower.slice(0, -3)}y`;
  if (/(?:ches|shes|ses|xes|zes)$/.test(lower)) return lower.slice(0, -2);
  if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

const VERIFICATION_ALIASES: Record<string, VerificationStatus> = {
  verified: 'verified',
  valid: 'verified',
  confirmed: 'verified',
  'needs verification': 'needs_verification',
  needs_verification: 'needs_verification',
  unverified: 'needs_verification',
  unconfirmed: 'needs_verification',
  pending: 'needs_verification',
  invalid: 'invalid',
  bounced: 'invalid',
  bad: 'invalid',
  dead: 'invalid',
};

const SENIORITY_ALIASES: Record<string, Seniority> = {
  'c-level': 'C-Level',
  clevel: 'C-Level',
  'c level': 'C-Level',
  chief: 'C-Level',
  ceo: 'C-Level',
  cto: 'C-Level',
  cfo: 'C-Level',
  cmo: 'C-Level',
  founder: 'C-Level',
  executive: 'C-Level',
  vp: 'VP',
  'vice president': 'VP',
  svp: 'VP',
  evp: 'VP',
  director: 'Director',
  head: 'Director',
  lead: 'Director',
  manager: 'Manager',
  senior: 'Senior',
  'individual contributor': 'Individual Contributor',
  ic: 'Individual Contributor',
  entry: 'Entry',
  junior: 'Entry',
  intern: 'Entry',
};

const DEPARTMENT_ALIASES: Record<string, Department> = {
  marketing: 'Marketing',
  growth: 'Marketing',
  brand: 'Marketing',
  demand: 'Marketing',
  sales: 'Sales',
  revenue: 'Sales',
  'business development': 'Sales',
  bizdev: 'Sales',
  engineering: 'Engineering',
  dev: 'Engineering',
  developer: 'Engineering',
  technical: 'Engineering',
  product: 'Product',
  operations: 'Operations',
  ops: 'Operations',
  finance: 'Finance',
  accounting: 'Finance',
  hr: 'HR',
  'human resources': 'HR',
  'people ops': 'HR',
  people: 'HR',
  recruiting: 'HR',
  talent: 'HR',
  procurement: 'Procurement',
  purchasing: 'Procurement',
  sourcing: 'Procurement',
  legal: 'Legal',
  compliance: 'Legal',
  it: 'IT',
  'information technology': 'IT',
  infosec: 'IT',
};

const HEADCOUNT_ALIASES: Record<string, HeadcountBand> = {
  startup: '11-50',
  'small business': '11-50',
  smb: '51-200',
  midmarket: '201-500',
  'mid market': '201-500',
  'mid-market': '201-500',
  'large company': '1001-5000',
  enterprise: '5000+',
};

function lookup<T>(table: Record<string, T>, term: string): T | null {
  const normalized = normalizePeopleText(term);
  if (normalized in table) return table[normalized];
  const singular = singularize(normalized);
  return singular in table ? table[singular] : null;
}

export function resolveVerification(term: string): VerificationStatus | null {
  return lookup(VERIFICATION_ALIASES, term);
}

export function resolveSeniority(term: string): Seniority | null {
  const direct = SENIORITIES.find(
    (value) => normalizePeopleText(value) === normalizePeopleText(term)
  );
  if (direct) return direct;
  return lookup(SENIORITY_ALIASES, term);
}

export function resolveDepartment(term: string): Department | null {
  const direct = DEPARTMENTS.find(
    (value) => normalizePeopleText(value) === normalizePeopleText(term)
  );
  if (direct) return direct;
  return lookup(DEPARTMENT_ALIASES, term);
}

export function resolveHeadcountBand(term: string): HeadcountBand | null {
  const normalized = normalizePeopleText(term);
  const direct = HEADCOUNT_BANDS.find((band) => band.toLowerCase() === normalized);
  if (direct) return direct;
  return lookup(HEADCOUNT_ALIASES, term);
}

/** Human-facing labels for the enum values, used by chips and badges. */
export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: 'Verified',
  needs_verification: 'Needs verification',
  invalid: 'Invalid',
};

export const SOURCE_LABELS: Record<string, string> = {
  user_import: 'User import',
  licensed_dataset: 'Licensed dataset',
  enrichment: 'Enrichment',
};

export const INTENT_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};
