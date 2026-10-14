import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { LeadNoteSchema } from "@/models/lead";
import { LeadService } from "@/services/lead.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const body = await req.json().catch(() => null);
        const data = validateBody(LeadNoteSchema, body);

        const note = await new LeadService(tenant).addNote(params.id, data);
        return jsonOk(note, 201);
    } catch (err) {
        return jsonError(err);
    }
}
