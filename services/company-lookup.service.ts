import { CompanyLookupRepository } from "@/repositories/company-lookup.repository";
import type { CompanyLookupResult, CompanyMatchDTO } from "@/models/company-lookup";

/**
 * Resolves an email domain to a company name for the sign-up form.
 *
 * No audit logging, unlike the tenant services: there is no workspace or user
 * to attribute a read to yet, and nothing is written.
 */
export class CompanyLookupService {
    /**
     * "Company" first, the discovery dataset second, People third.
     *
     * The workspace "Company" table leads because it is the curated CRM record
     * of a company — clean names, and it covers domains the bulk discovery
     * import missed. "DiscoveryCompany" follows for reach (383k rows against
     * 500). The contact route is last because it infers an employer from one
     * person's mailbox, which is weaker evidence than a domain column.
     *
     * Each step runs only when the previous one found nothing, so the common
     * case is a single indexed query.
     *
     * ⚠️ The "Company" step is deliberately not workspace-scoped — sign-up is
     * unauthenticated, so there is no workspace to scope to. Revisit when real
     * tenants own rows: either restrict this step to a public/global workspace,
     * or drop it and rely on DiscoveryCompany. See the repository header.
     *
     * Returns `{ company: null }` when nothing matches. That is an ordinary
     * outcome, not an error — the sign-up form leaves the field blank and says
     * nothing.
     */
    static async findByEmailDomain(domain: string): Promise<CompanyLookupResult> {
        const workspaceCompany = await CompanyLookupRepository.findInCompanies(domain);
        if (workspaceCompany) {
            return { company: toMatch(workspaceCompany, domain, "company") };
        }

        const direct = await CompanyLookupRepository.findByDomain(domain);
        if (direct) {
            return { company: toMatch(direct, domain, "discovery") };
        }

        const viaContact = await CompanyLookupRepository.findByContactEmailDomain(domain);
        if (viaContact) {
            return { company: toMatch(viaContact, domain, "people") };
        }

        return { company: null };
    }
}

function toMatch(
    row: { id: string; name: string; domain: string | null },
    domain: string,
    source: CompanyMatchDTO["source"]
): CompanyMatchDTO {
    return {
        id: row.id,
        name: cleanCompanyName(row.name),
        domain: row.domain ?? domain,
        source,
    };
}

/**
 * Strips the trailing numeric suffix the seeded rows carry
 * ("Sharma Build Enterprises 1817039"), matching formatCompany() in
 * app/api/companies/route.ts so the sign-up form shows the same name the
 * Companies page does.
 */
function cleanCompanyName(name: string): string {
    return name.replace(/\s+\d+$/, "").trim();
}
