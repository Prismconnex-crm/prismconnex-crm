import { z } from "zod";

/**
 * Contract for GET /api/companies/by-domain, the sign-up company detection
 * lookup.
 *
 * The route is unauthenticated (the caller is on the sign-up page and has no
 * session yet), so the domain is re-validated here rather than trusted from
 * the query string — the client's check in lib/auth/email-domain.ts is a
 * request-saving optimisation, not a security boundary.
 */

/** Same shape rule as extractEmailDomain: labels separated by dots, one dot minimum. */
const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

export const companyDomainQuerySchema = z.object({
    // 253 is the maximum length of a DNS name; rejecting longer input keeps a
    // pathological query string from reaching the database.
    domain: z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(253)
        .regex(DOMAIN_PATTERN, "Not a valid domain"),
});

export type CompanyDomainQuery = z.infer<typeof companyDomainQuerySchema>;

/**
 * A resolved company. `source` records which table answered, purely for
 * debugging — the sign-up form only reads `name`.
 *
 * "company"   — the workspace Company table (checked first)
 * "discovery" — the shared DiscoveryCompany dataset
 * "people"    — inferred from a CompanyContact's email domain
 */
export type CompanyMatchDTO = {
    id: string;
    name: string;
    domain: string;
    source: "company" | "discovery" | "people";
};

/** `company` is null when nothing matched. A miss is a success, not an error. */
export type CompanyLookupResult = {
    company: CompanyMatchDTO | null;
};
