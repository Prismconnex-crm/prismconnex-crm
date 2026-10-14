import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { UpdateLeadSchema } from "@/models/lead";
import { LeadService } from "@/services/lead.service";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const lead = await new LeadService(tenant).get(params.id);
        return jsonOk(lead);
    } catch (err) {
        return jsonError(err);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const body = await req.json().catch(() => null);
        const data = validateBody(UpdateLeadSchema, body);

        const lead = await new LeadService(tenant).update(params.id, data);
        return jsonOk(lead);
    } catch (err) {
        return jsonError(err);
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        await new LeadService(tenant).remove(params.id);
        return jsonOk({ ok: true });
    } catch (err) {
        return jsonError(err);
    }
}
