import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session";
import { previewProspeo } from "@/lib/prospeo/service";
import { prospeoErrorResponse } from "../errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/exhibitors/:id/prospeo/preview
 *
 * Runs Prospeo People Search for the exhibitor (pilot allow-list only) and
 * returns every matched person with what an import would do to each. Writes
 * nothing. Costs 1 Prospeo search credit per page of 25 that returns people;
 * repeating it within 30 days is free. No email/mobile enrichment.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!(await getSessionPayload())) {
    return NextResponse.json({ error: "Sign in to use Prospeo." }, { status: 401 });
  }
  try {
    return NextResponse.json(await previewProspeo(params.id));
  } catch (error) {
    return prospeoErrorResponse(error);
  }
}
