import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionPayload } from "@/lib/auth/session";
import { isEventSlug, readReturnedExhibitor } from "@/lib/exhibitors/crm-return";
import { toExhibitorItem } from "@/lib/exhibitors/exhibitor-item";
import { exhibitorNameKey } from "../../../../scripts/lib/exhibitor-name-key.mjs";

export const dynamic = "force-dynamic";

/**
 * The CRM exhibitor a public "View details" asked for, once the visitor has signed in
 * (lib/exhibitors/crm-return.ts): `?eventSlug=&exhibitorUrl=&exhibitorName=` → `{ exhibitor, matchedBy }`.
 *
 * Only ever within the given event. The directory profile URL first — the CRM sync's own key, so it is
 * exact — then the canonical name key, then the name itself, and a name counts only when it names one row:
 * a directory can list a company twice on different stands, and guessing between them would open the wrong
 * one. `{ exhibitor: null }` is an ordinary answer (the event's list is not in the CRM yet), not an error.
 *
 * Signed-in users only, like /api/exhibitors: the row can carry a named contact.
 */
export async function GET(request: Request) {
  try {
    if (!(await getSessionPayload())) {
      return NextResponse.json({ error: "Sign in to view exhibitors." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get("eventSlug")?.trim() ?? "";
    const wanted = readReturnedExhibitor(searchParams.toString());
    if (!isEventSlug(eventSlug) || !wanted) {
      return NextResponse.json({ error: "eventSlug and exhibitorUrl or exhibitorName are required" }, { status: 400 });
    }

    if (wanted.profileUrl) {
      const row = await prisma.eventExhibitor.findFirst({ where: { eventSlug, sourceDetailUrl: wanted.profileUrl } });
      if (row) return NextResponse.json({ exhibitor: toExhibitorItem(row), matchedBy: "profile" });
    }

    if (wanted.name) {
      const nameKey = exhibitorNameKey(wanted.name);
      if (nameKey) {
        const rows = await prisma.eventExhibitor.findMany({ where: { eventSlug, nameKey }, take: 2 });
        if (rows.length === 1) return NextResponse.json({ exhibitor: toExhibitorItem(rows[0]), matchedBy: "name" });
      }
      const rows = await prisma.eventExhibitor.findMany({
        where: { eventSlug, companyName: { equals: wanted.name, mode: "insensitive" } },
        take: 2,
      });
      if (rows.length === 1) return NextResponse.json({ exhibitor: toExhibitorItem(rows[0]), matchedBy: "name" });
    }

    return NextResponse.json({ exhibitor: null, matchedBy: null });
  } catch (error) {
    console.error("Failed to resolve exhibitor:", error);
    return NextResponse.json({ error: "Failed to resolve exhibitor" }, { status: 500 });
  }
}
