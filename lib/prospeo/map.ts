/**
 * Prospeo search result → CRM contact fields. Pure.
 *
 * Email and mobile are kept only when Prospeo says they were revealed AND the
 * value is not masked ("j.*****@acme.com", "+44 7**-****"). Search results never
 * reveal them, so in Phase 1 they are always null — with their status kept, so
 * the UI can say "not revealed" (VERIFIED) apart from "none" (UNAVAILABLE).
 */
import type { ProspeoCompany, ProspeoSearchResult } from "@/lib/prospeo/client";

export type ProspeoContact = {
  externalId: string;
  linkedinKey: string | null;
  fullName: string;
  personLinkedInUrl: string | null;
  companyName: string | null;
  companyLinkedInUrl: string | null;
  companyDomain: string | null;
  jobTitle: string | null;
  email: string | null;
  emailStatus: string | null;
  mobile: string | null;
  mobileStatus: string | null;
  country: string | null;
  city: string | null;
  seniority: string | null;
  industry: string | null;
  companySize: number | null;
};

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
};

/** A revealed, unmasked value — or null. */
const revealed = (isRevealed: boolean | undefined, value: string | null | undefined): string | null => {
  const v = clean(value);
  return isRevealed && v && !v.includes("*") ? v : null;
};

/** LinkedIn /in/<slug>, lower-case and decoded, so URL variants of one profile compare equal. */
export function linkedInProfileKey(url: string | null | undefined): string | null {
  if (!url) return null;
  let decoded = url.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep raw
  }
  return decoded.toLowerCase().match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? null;
}

/** LinkedIn /company/<slug>, lower-case. */
export function linkedInCompanyKey(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.trim().toLowerCase().match(/linkedin\.com\/company\/([^/?#]+)/)?.[1] ?? null;
}

/** Bare root domain from a website or domain field. */
export function rootDomain(value: string | null | undefined): string | null {
  const bare = value
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
  return bare || null;
}

export function companyDomainOf(company: ProspeoCompany | null | undefined): string | null {
  return rootDomain(company?.domain) ?? rootDomain(company?.website);
}

/** Null when the result has no usable id or name — such rows are never imported. */
export function mapProspeoResult(result: ProspeoSearchResult): ProspeoContact | null {
  const { person, company } = result;
  const externalId = clean(person?.person_id);
  const fullName =
    clean(person?.full_name) ?? clean([person?.first_name, person?.last_name].filter(Boolean).join(" "));
  if (!externalId || !fullName) return null;

  const currentJob = person.job_history?.find((job) => job.current) ?? null;
  return {
    externalId,
    linkedinKey: linkedInProfileKey(person.linkedin_url),
    fullName,
    personLinkedInUrl: clean(person.linkedin_url),
    companyName: clean(company?.name),
    companyLinkedInUrl: clean(company?.linkedin_url),
    companyDomain: companyDomainOf(company),
    jobTitle: clean(person.current_job_title) ?? clean(currentJob?.title),
    email: revealed(person.email?.revealed, person.email?.email),
    emailStatus: clean(person.email?.status),
    mobile: revealed(person.mobile?.revealed, person.mobile?.mobile_international ?? person.mobile?.mobile),
    mobileStatus: clean(person.mobile?.status),
    country: clean(person.location?.country),
    city: clean(person.location?.city),
    seniority: clean(currentJob?.seniority),
    industry: clean(company?.industry),
    companySize: typeof company?.employee_count === "number" ? company.employee_count : null,
  };
}
