import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody, validateQuery } from "@/lib/http/validate";
import { CreateLeadSchema, LeadListQuerySchema } from "@/models/lead";
import { LeadService } from "@/services/lead.service";

export async function GET(req: NextRequest) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const params = Object.fromEntries(new URL(req.url).searchParams);
        const query = validateQuery(LeadListQuerySchema, params);

        const service = new LeadService(tenant);
        const leads = await service.list(query);
        return jsonOk(leads);
    } catch (err) {
        return jsonError(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        // A malformed body is a 400 from validation, not a 500 from JSON.parse.
        const body = await req.json().catch(() => null);
        const data = validateBody(CreateLeadSchema, body);

        const service = new LeadService(tenant);
        const lead = await service.create(data);
        return jsonOk(lead, 201);
    } catch (err) {
        return jsonError(err);
    }
}
