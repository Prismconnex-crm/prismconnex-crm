/**
 * EventExhibitor → DiscoveryCompany, for every event's exhibitor list.
 *
 * The rules for one row, kept pure so tests/integration/exhibitor-company-import.test.ts
 * runs offline; scripts/exhibitors/import-to-companies.ts does the reading and writing.
 * Generalises scripts/import-bett-exhibitors-to-companies.mjs, which did this for BETT alone.
 *
 * Each row:
 *  - category "trade show events" (an existing Companies category, so the filter already offers it);
 *  - headquarters = the exhibitor's country in the Country picker's spelling, region from the
 *    Find Shows country table — a country the directory did not publish stays empty;
 *  - tags name the show and stand, plus "exhibitor:<id>" so a click opens this exact
 *    exhibitor's profile (formatCompany keeps that tag out of the visible chips);
 *  - nothing is invented: no founded year, size, revenue or score the directory never gave.
 */
import { getRegionForCountry } from '@/lib/find-shows/country-resolution';
import { EXHIBITOR_ID_TAG_PREFIX, TRADE_SHOW_EXHIBITOR_TAG } from '@/lib/exhibitors/bett';

export const TRADE_SHOW_CATEGORY = 'trade show events';

/** Stored spellings that the Country picker (COMPANY_COUNTRIES) writes differently. */
const PICKER_SPELLING: Record<string, string> = {
  Türkiye: 'Turkey',
  Czechia: 'Czechia (Czech Republic)',
  Korea: 'South Korea',
  Netherlandss: 'Netherlands',
};

export type ExhibitorSource = {
  id: string;
  eventSlug: string;
  companyName: string;
  websiteUrl: string | null;
  country: string | null;
  standNumber: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
};

export type ShowInfo = {
  /** e.g. "100+ TECHNOBUILD 2026" */
  label: string;
  city: string | null;
  /** e.g. "September 2026" */
  monthYear: string | null;
};

export type CompanyInsert = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  domain: string | null;
  website: string | null;
  headquarters: string | null;
  region: string | null;
  tags: string;
  email: string | null;
  phone: string | null;
  highlights: string;
  insights: string;
};

/** "https://www.acme.com/en/" → "acme.com/en" — the shape the BETT import stored. */
export function domainFromWebsite(url: string | null): string | null {
  if (!url) return null;
  return url.trim().replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '') || null;
}

export function companyCountry(country: string | null): { headquarters: string | null; region: string | null } {
  const raw = country?.trim();
  if (!raw) return { headquarters: null, region: null };
  return { headquarters: PICKER_SPELLING[raw] ?? raw, region: getRegionForCountry(raw) };
}

/** Tags must not carry commas — the column is a comma-separated list. */
const clean = (s: string) => s.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

export function buildCompanyRow(ex: ExhibitorSource, show: ShowInfo, id: string): CompanyInsert {
  const { headquarters, region } = companyCountry(ex.country);
  const stand = ex.standNumber?.trim() || null;
  const label = clean(show.label);
  const where = [show.city, show.monthYear].filter(Boolean).join(', ');
  return {
    id,
    name: ex.companyName.trim(),
    category: TRADE_SHOW_CATEGORY,
    description: ex.description?.trim() || null,
    domain: domainFromWebsite(ex.websiteUrl),
    website: ex.websiteUrl?.trim() || null,
    headquarters,
    region,
    tags: [TRADE_SHOW_EXHIBITOR_TAG, `${label} Exhibitor`, stand ? `Stand ${clean(stand)}` : null, `${EXHIBITOR_ID_TAG_PREFIX}${ex.id}`]
      .filter(Boolean)
      .join(', '),
    email: ex.email?.trim() || null,
    phone: ex.phone?.trim() || null,
    highlights: stand ? `${label} stand ${clean(stand)}` : `${label} exhibitor`,
    // Comma-separated on purpose: shown as chips ("Exhibiting at …", city, month), like the BETT rows.
    insights: where ? `Exhibiting at ${label}, ${where}` : `Exhibiting at ${label}`,
  };
}
