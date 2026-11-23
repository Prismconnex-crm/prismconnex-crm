import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionPayload } from "@/lib/auth/session";
import { importProspeo } from "@/lib/prospeo/service";
import { prospeoErrorResponse } from "../errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  personIds: z.array(z.string().min(1)).min(1).max(5000),
});

/**
 * POST /api/exhibitors/:id/prospeo/import  { personIds: string[] }
 *
 * Imports the approved people (Prospeo person ids from the preview) into the
 * exhibitor's People tab. The search is re-run server-side, so only people
 * Prospeo actually returns for this exhibitor's company can be written.
 * Idempotent: re-running updates instead of duplicating.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await getSessionPayload())) {
    return NextResponse.json({ error: "Sign in to use Prospeo." }, { status: 401 });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Send { personIds: string[] } with at least one id." }, { status: 400 });
  }
  try {
    return NextResponse.json(await importProspeo(params.id, body.personIds));
  } catch (error) {
    return prospeoErrorResponse(error);
  }
}
