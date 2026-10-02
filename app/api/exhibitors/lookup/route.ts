import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { bareDomain, normalizeCompanyName } from "@/lib/exhibitors/bett";

export const dynamic = "force-dynamic";

/**
 * Resolve a company to its exhibitor record, so clicking that company anywhere
 * in the CRM can open the exhibitor profile.
 *
 * The Companies table knows a row's name and domain but not which exhibitor it
 * came from — the import copies values, not foreign keys, because
 * DiscoveryCompany is shared reference data with no relation to EventExhibitor.
 * This closes that gap at read time rather than adding a column.
 *
 * Domain first, name second, for the same reason as /api/exhibitors/[id]:
 * trading names collide, registered domains do not.
 *
 * Returns { exhibitorId: null } rather than a 404 when nothing matches — "this
 * company is not an exhibitor" is an ordinary answer, not an error.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = bareDomain(searchParams.get("domain"));
    const name = searchParams.get("name")?.trim() ?? "";

    if (!domain && !name) {
      return NextResponse.json({ error: "domain or name is required" }, { status: 400 });
    }

    if (domain) {
      const byDomain = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "EventExhibitor"
         WHERE lower(replace(replace("websiteUrl", 'https://', ''), 'http://', '')) LIKE $1
         LIMIT 1`,
        `${domain}%`
      );
      if (byDomain[0]) return NextResponse.json({ exhibitorId: byDomain[0].id, matchedBy: "domain" });

      const byWww = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "EventExhibitor"
         WHERE lower(replace(replace("websiteUrl", 'https://www.', ''), 'http://www.', '')) LIKE $1
         LIMIT 1`,
        `${domain}%`
      );
      if (byWww[0]) return NextResponse.json({ exhibitorId: byWww[0].id, matchedBy: "domain" });
    }

    if (name) {
      // Narrow with an indexed-ish prefix, then compare normalised forms in JS —
      // a normalised SQL expression could not use an index, and the exhibitor
      // table is small enough that a short prefix leaves very few candidates.
      const prefix = name.toLowerCase().slice(0, 4);
      const candidates = await prisma.eventExhibitor.findMany({
        where: { companyName: { startsWith: prefix, mode: "insensitive" } },
        select: { id: true, companyName: true },
        take: 200,
      });
      const target = normalizeCompanyName(name);
      const hit = candidates.find((row) => normalizeCompanyName(row.companyName) === target);
      if (hit) return NextResponse.json({ exhibitorId: hit.id, matchedBy: "name" });
    }

    return NextResponse.json({ exhibitorId: null, matchedBy: null });
  } catch (error) {
    console.error("Failed to look up exhibitor:", error);
    return NextResponse.json({ error: "Failed to look up exhibitor" }, { status: 500 });
  }
}
