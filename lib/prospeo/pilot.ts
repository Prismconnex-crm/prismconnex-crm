/**
 * Which exhibitors may use Prospeo, and how each is matched. Phase 1 is IRIS
 * Education only — adding an exhibitor later is one entry here (or replacing
 * this lookup with a rule once the pilot is signed off).
 *
 * Matching is by the exhibitor's own website domain, never by name: several
 * unrelated exhibitors are called "IRIS …" (IRIS Tech, IRIS Inspection Machines,
 * Iris Solar). The search filters on the domain, and every result is checked
 * again — its company domain or company LinkedIn page must be the exhibitor's —
 * before it can be shown or imported.
 */
import { companyDomainOf, linkedInCompanyKey } from "@/lib/prospeo/map";
import type { ProspeoSearchResult } from "@/lib/prospeo/client";

export type ProspeoTarget = {
  exhibitorId: string;
  companyName: string;
  /** Root domain, as Prospeo's company.websites filter wants it. */
  domain: string;
  /** LinkedIn /company/<slug>, a second accepted identity for a result's company. */
  companyLinkedInSlug: string | null;
};

const PILOT_TARGETS: ProspeoTarget[] = [
  {
    // BETT 2027 · IRIS Education · https://www.iris.co.uk
    exhibitorId: "8cb2c9ff-53d5-4867-b666-f414a440218d",
    companyName: "IRIS Education",
    domain: "iris.co.uk",
    companyLinkedInSlug: "iriseducation",
  },
];

export function prospeoTargetFor(exhibitorId: string): ProspeoTarget | null {
  return PILOT_TARGETS.find((target) => target.exhibitorId === exhibitorId) ?? null;
}

/** Search Person filters for a target: its exact website domain. */
export function searchFiltersFor(target: ProspeoTarget): Record<string, unknown> {
  return { company: { websites: { include: [target.domain], exclude: [] } } };
}

/** Whether a result's current company is the target company (domain or LinkedIn page). */
export function resultBelongsTo(result: ProspeoSearchResult, target: ProspeoTarget): boolean {
  const company = result.company;
  if (!company) return false;
  if (companyDomainOf(company) === target.domain) return true;
  const slug = linkedInCompanyKey(company.linkedin_url);
  return !!slug && !!target.companyLinkedInSlug && slug === target.companyLinkedInSlug;
}
