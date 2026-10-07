import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * One exhibitor, plus the DiscoveryCompany row that is the same organisation.
 *
 * Backs the BETT exhibitor profile on the Companies page. The exhibitor record
 * carries everything the show's own directory published (named contact, job
 * title, LinkedIn, stand, phone); the company row adds the firmographics the
 * directory never had (founded, employee range). Either half may be missing,
 * and the UI says "Not available" rather than inventing a value.
 *
 * Matching is domain-first and name-second, deliberately in that order: two
 * companies can share a trading name, but a registered domain is unique. The
 * name fallback is lower-cased and stripped of punctuation and the usual
 * suffixes, because a directory writes "ClassVR Ltd." where the dataset holds
 * "ClassVR".
 *
 * Not tenant-scoped, matching /api/exhibitors and /api/companies — both read
 * shared reference data rather than workspace data.
 */

/** Bare host, lower-case, no scheme/www/trailing slash — the shape DiscoveryCompany.domain is stored in. */
function domainOf(url: string | null): string | null {
  if (!url) return null;
  const bare = url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
  return bare || null;
}

/** Company suffixes a directory appends but the dataset usually omits. */
const NAME_SUFFIXES =
  /\b(ltd|limited|llc|inc|incorporated|corp|corporation|plc|gmbh|bv|nv|ab|as|sa|srl|spa|pty|pte|co|company|group|holdings|international)\b/g;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(NAME_SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

type CompanyMatch = {
  id: string;
  name: string;
  founded: string | null;
  employeeRange: string | null;
  headquarters: string | null;
  region: string | null;
  category: string | null;
  description: string | null;
  domain: string | null;
  tags: string | null;
};

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const exhibitor = await prisma.eventExhibitor.findUnique({
      where: { id: params.id },
    });

    if (!exhibitor) {
      return NextResponse.json({ error: "Exhibitor not found" }, { status: 404 });
    }

    const domain = domainOf(exhibitor.websiteUrl);
    let company: CompanyMatch | null = null;

    if (domain) {
      const byDomain = await prisma.$queryRawUnsafe<CompanyMatch[]>(
        `SELECT id, name, founded, "employeeRange", headquarters, region, category,
                description, domain, tags
         FROM "DiscoveryCompany"
         WHERE lower(domain) = $1
         LIMIT 1`,
        domain
      );
      company = byDomain[0] ?? null;
    }

    if (!company) {
      // Name fallback. The comparison is normalised on both sides, so it runs
      // over candidates the indexed prefix narrowed down rather than the whole
      // table — a normalised expression could not use an index.
      const normalized = normalizeName(exhibitor.companyName);
      const prefix = exhibitor.companyName.trim().toLowerCase().slice(0, 4);
      if (normalized && prefix) {
        const upperBound =
          prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
        const candidates = await prisma.$queryRawUnsafe<CompanyMatch[]>(
          `SELECT id, name, founded, "employeeRange", headquarters, region, category,
                  description, domain, tags
           FROM "DiscoveryCompany"
           WHERE lower(name) ~>=~ $1 AND lower(name) ~<~ $2
           LIMIT 200`,
          prefix,
          upperBound
        );
        company = candidates.find((row) => normalizeName(row.name) === normalized) ?? null;
      }
    }

    return NextResponse.json({
      exhibitor: {
        id: exhibitor.id,
        eventSlug: exhibitor.eventSlug,
        name: exhibitor.companyName,
        logoUrl: exhibitor.logoUrl,
        stand: exhibitor.standNumber,
        website: exhibitor.websiteUrl,
        country: exhibitor.country,
        phone: exhibitor.phone,
        email: exhibitor.email,
        firstName: exhibitor.firstName,
        lastName: exhibitor.lastName,
        designation: exhibitor.designation,
        personLinkedInUrl: exhibitor.personLinkedInUrl,
        companyLinkedInUrl: exhibitor.companyLinkedInUrl,
        profileUrl: exhibitor.sourceDetailUrl,
        directoryUrl: exhibitor.sourceDirectoryUrl,
        description: exhibitor.description,
      },
      company,
      matchedBy: company ? (domain && company.domain?.toLowerCase() === domain ? "domain" : "name") : null,
    });
  } catch (error) {
    console.error("Failed to fetch exhibitor profile:", error);
    return NextResponse.json({ error: "Failed to fetch exhibitor profile" }, { status: 500 });
  }
}
