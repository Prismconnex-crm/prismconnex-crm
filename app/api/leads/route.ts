import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { CreateLeadSchema } from "@/models/lead";
import { LeadService } from "@/services/lead.service";

export async function GET(req: NextRequest) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const service = new LeadService(tenant);
        const leads = await service.list();
        return jsonOk(leads);
    } catch (err) {
        return jsonError(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const body = await req.json();
        const data = validateBody(CreateLeadSchema, body);

        const service = new LeadService(tenant);
        const lead = await service.create(data);
        return jsonOk(lead, 201);
    } catch (err) {
        return jsonError(err);
    }
}
