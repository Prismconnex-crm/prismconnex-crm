import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 96;

type SortKey = "name" | "stand" | "country";

function parseSort(value: string | null): SortKey {
  return value === "stand" || value === "country" ? value : "name";
}

function orderFor(sort: SortKey): Prisma.EventExhibitorOrderByWithRelationInput[] {
  // Postgres sorts NULLs last on ASC, so exhibitors without a stand/country
  // fall to the end without needing an explicit nulls clause.
  if (sort === "stand") return [{ standNumber: "asc" }, { companyName: "asc" }];
  if (sort === "country") return [{ country: "asc" }, { companyName: "asc" }];
  return [{ companyName: "asc" }];
}

// Exhibitors for one event, read from EventExhibitor. Populated by
// scripts/import-bett-exhibitors.mjs (directory listing: name, logo, stand) and
// enriched by scripts/import-bett-exhibitors-pdf.mjs (official website, country,
// phone, LinkedIn, named contact). Contact columns stay null unless a source
// legitimately publishes them — nothing here is inferred.
//
// Link precedence for the UI: website -> profileUrl (this exhibitor's directory
// page) -> directoryUrl (the event's directory root).
//
// Query params: eventSlug (required), plus optional q / sort / page / pageSize.
// Passing `page` switches the route into paginated mode; without it the whole
// event is returned as before, so the older list UIs keep working untouched.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("eventSlug")?.trim();

    if (!eventSlug) {
      return NextResponse.json({ error: "eventSlug is required" }, { status: 400 });
    }

    const q = searchParams.get("q")?.trim() ?? "";
    const sort = parseSort(searchParams.get("sort"));

    const rawPage = searchParams.get("page");
    const paginated = rawPage !== null;
    const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "", 10) || DEFAULT_PAGE_SIZE)
    );

    const where: Prisma.EventExhibitorWhereInput = {
      eventSlug,
      ...(q
        ? {
            OR: [
              { companyName: { contains: q, mode: "insensitive" as const } },
              { standNumber: { contains: q, mode: "insensitive" as const } },
              { country: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [totalCount, eventCount, rows] = await Promise.all([
      prisma.eventExhibitor.count({ where }),
      q ? prisma.eventExhibitor.count({ where: { eventSlug } }) : Promise.resolve(-1),
      prisma.eventExhibitor.findMany({
        where,
        orderBy: orderFor(sort),
        ...(paginated ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
      }),
    ]);

    // Cheap headline stat for the panel; counted over the whole event, not the page.
    const withWebsiteCount = await prisma.eventExhibitor.count({
      where: { eventSlug, NOT: { websiteUrl: null } },
    });

    const items = rows.map((row) => ({
      id: row.id,
      name: row.companyName,
      logoUrl: row.logoUrl,
      stand: row.standNumber,
      // Prefer the company's own site; the UI falls back to the source
      // directory page when there isn't one.
      website: row.websiteUrl,
      profileUrl: row.sourceDetailUrl,
      directoryUrl: row.sourceDirectoryUrl,
      country: row.country,
      phone: row.phone,
      companyLinkedInUrl: row.companyLinkedInUrl,
      description: row.description,
      categories: row.categories,
      firstName: row.firstName,
      lastName: row.lastName,
      designation: row.designation,
      email: row.email,
      personLinkedInUrl: row.personLinkedInUrl,
    }));

    return NextResponse.json({
      eventSlug,
      // `imported` stayed the response's "how many rows exist" field, so keep it
      // pointing at the whole event even when a page/filter is applied.
      imported: eventCount === -1 ? totalCount : eventCount,
      totalCount,
      withWebsiteCount,
      page: paginated ? page : 1,
      pageSize: paginated ? pageSize : totalCount,
      totalPages: paginated ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1,
      sort,
      q,
      items,
      // Legacy field name kept for the non-paginated callers.
      exhibitors: items,
    });
  } catch (error) {
    console.error("Failed to fetch exhibitors:", error);
    return NextResponse.json({ error: "Failed to fetch exhibitors" }, { status: 500 });
  }
}
