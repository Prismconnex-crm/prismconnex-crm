import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// Exhibitors for one event, read from EventExhibitor. Populated by
// scripts/import-bett-exhibitors.mjs (directory listing: name, logo, stand) and
// enriched by scripts/import-bett-exhibitors-pdf.mjs (official website, country,
// phone, LinkedIn, named contact). Contact columns stay null unless a source
// legitimately publishes them — nothing here is inferred.
//
// Link precedence for the UI: website -> profileUrl (this exhibitor's directory
// page) -> directoryUrl (the event's directory root).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("eventSlug")?.trim();

    if (!eventSlug) {
      return NextResponse.json({ error: "eventSlug is required" }, { status: 400 });
    }

    const rows = await prisma.eventExhibitor.findMany({
      where: { eventSlug },
      orderBy: { companyName: "asc" },
    });

    return NextResponse.json({
      eventSlug,
      imported: rows.length,
      exhibitors: rows.map((row) => ({
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
      })),
    });
  } catch (error) {
    console.error("Failed to fetch exhibitors:", error);
    return NextResponse.json({ error: "Failed to fetch exhibitors" }, { status: 500 });
  }
}
