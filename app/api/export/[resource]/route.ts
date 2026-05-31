import { NextResponse } from "next/server";
import { companies, deals, events, people } from "@/lib/mock-data";
import { requireSession } from "@/lib/session";

function toCsv(headers: string[], rows: string[][]) {
  return [headers.join(","), ...rows.map((row) => row.map((col) => `"${String(col).replaceAll('"', '""')}"`).join(","))].join("\n");
}

export async function GET(_: Request, { params }: { params: { resource: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resource = params.resource;

  if (resource === "events") {
    const csv = toCsv(["id", "name", "city", "country", "confidence"], events.map((event) => [event.id, event.name, event.city, event.country, String(event.confidence)]));
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=events.csv" } });
  }

  if (resource === "people") {
    const csv = toCsv(["name", "title", "company", "verified"], people.map((person) => [person.name, person.title, person.company, String(person.verified)]));
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=people.csv" } });
  }

  if (resource === "companies") {
    const csv = toCsv(["name", "industry", "stage", "owner"], companies.map((company) => [company.name, company.industry, company.stage, company.owner]));
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=companies.csv" } });
  }

  if (resource === "deals") {
    const csv = toCsv(["name", "stage", "amount", "margin", "roi"], deals.map((deal) => [deal.name, deal.stage, String(deal.amount), String(deal.margin), String(deal.roi)]));
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=deals.csv" } });
  }

  return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
}
