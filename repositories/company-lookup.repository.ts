import { prisma } from "@/lib/db/prisma";

/**
 * Domain -> company queries against the Supabase Postgres database, reached
 * through Prisma (`lib/db/prisma.ts`). There is no `@supabase/supabase-js` in
 * this project — `lib/supabase/gotrue.ts` wraps the Auth REST API only, and
 * every table read goes through Prisma.
 *
 * Three sources, tried in order by the service: the workspace "Company" table,
 * then the shared "DiscoveryCompany" dataset, then "CompanyContact" (People).
 *
 * ⚠️ Tenancy note. "Company" is workspace-scoped, and this lookup runs
 * unauthenticated on the sign-up page, so `findInCompanies` reads across every
 * workspace — there is no session yet to scope it to one. That is acceptable
 * today because the table holds 500 seeded Fortune-list companies in the single
 * demo workspace, and it is the only source that covers domains like
 * google.com. Once real customers own rows here, this query will disclose their
 * company names to anonymous callers and should be restricted — see the note in
 * services/company-lookup.service.ts.
 *
 * Raw SQL because the predicates are expressions — lower(domain) and the domain
 * part of an email — which Prisma's query builder cannot express, and which
 * must match the migrations' index expressions exactly to be indexable.
 */

type CompanyRow = {
    id: string;
    name: string;
    domain: string | null;
};

export class CompanyLookupRepository {
    /**
     * Exact domain match in the workspace "Company" table — the curated CRM
     * records, and the primary source for sign-up detection.
     *
     * Preferred over the discovery dataset because these rows are hand-checked
     * and carry clean names ("Google", not a seeded name with a numeric
     * suffix), and because they cover well-known domains the discovery import
     * happens to miss.
     *
     * Tie-broken on "createdAt" for the same reason the others are: the domain
     * column has no unique constraint, so without an ORDER BY the same email
     * could resolve to a different company between two requests.
     */
    static async findInCompanies(domain: string): Promise<CompanyRow | null> {
        const rows = await prisma.$queryRaw<CompanyRow[]>`
            SELECT id, name, domain
            FROM "Company"
            WHERE lower(domain) = ${domain}
            ORDER BY "createdAt" ASC
            LIMIT 1
        `;
        return rows[0] ?? null;
    }

    /**
     * Exact domain match in the discovery dataset.
     *
     * Ordered by "rowCursor" because the dataset contains duplicate domains;
     * without an ORDER BY the same email could resolve to a different company
     * between two requests. Ascending picks the earliest-loaded row, which is
     * the more established record.
     */
    static async findByDomain(domain: string): Promise<CompanyRow | null> {
        const rows = await prisma.$queryRaw<CompanyRow[]>`
            SELECT id, name, domain
            FROM "DiscoveryCompany"
            WHERE lower(domain) = ${domain}
            ORDER BY "rowCursor" ASC
            LIMIT 1
        `;
        return rows[0] ?? null;
    }

    /**
     * Fallback through the People records: a known contact's email domain
     * identifies their employer, and CompanyContact.companyId points at
     * DiscoveryCompany.id.
     *
     * The join is by id rather than domain, so this still resolves a company
     * whose own `domain` column is null — which is why it is worth running
     * after findByDomain has missed.
     */
    static async findByContactEmailDomain(domain: string): Promise<CompanyRow | null> {
        const rows = await prisma.$queryRaw<CompanyRow[]>`
            SELECT company.id, company.name, company.domain
            FROM "CompanyContact" AS contact
            JOIN "DiscoveryCompany" AS company ON company.id = contact."companyId"
            WHERE lower(split_part(contact.email, '@', 2)) = ${domain}
            ORDER BY contact."createdAt" ASC
            LIMIT 1
        `;
        return rows[0] ?? null;
    }
}
