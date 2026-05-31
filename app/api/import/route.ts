import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";

export async function POST() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    status: "queued",
    message: "CSV/XLSX import wizard placeholder created job record.",
  });
}
