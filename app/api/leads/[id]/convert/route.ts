import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { ConvertLeadToDealSchema } from "@/models/lead";
import { LeadService } from "@/services/lead.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new Error("Unauthorized");

        const body = await req.json();
        const data = validateBody(ConvertLeadToDealSchema, body);

        const service = new LeadService(tenant);
        const deal = await service.convertToDeal(params.id, data);

        return jsonOk(deal, 201);
    } catch (err) {
        return jsonError(err);
    }
}
