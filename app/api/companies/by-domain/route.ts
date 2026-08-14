import { NextRequest } from "next/server";
import { validateQuery } from "@/lib/http/validate";
import { companyDomainQuerySchema } from "@/models/company-lookup";
import { CompanyLookupService } from "@/services/company-lookup.service";
import { jsonOk } from "@/lib/http/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/companies/by-domain?domain=fidensgen.com
 *
 * Resolves an email domain to a company name for the sign-up form's Company
 * Name field. Read-only — it never creates a company.
 *
 * Unauthenticated by necessity: the caller is filling in the sign-up form and
 * has no session. It reads only the shared discovery dataset, the same
 * tenancy exception app/api/companies/route.ts documents.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    try {
        const { domain } = validateQuery(companyDomainQuerySchema, {
            domain: searchParams.get("domain") ?? "",
        });

        return jsonOk(await CompanyLookupService.findByEmailDomain(domain));
    } catch (error) {
        // Deliberately not jsonError. This endpoint fires while the user is
        // still typing, so a half-written address is the normal case, not a
        // failure — and requirement 5 is that a non-match never surfaces an
        // error. Both a malformed domain and a database problem degrade to
        // "no company found", which the form treats as "leave the field alone".
        console.error("[by-domain] lookup failed:", error);
        return jsonOk({ company: null });
    }
}
