import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { SaveCompanySchema } from "@/models/saved-company";
import { SavedCompanyService } from "@/services/saved-company.service";

export async function GET(req: NextRequest) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const service = new SavedCompanyService(tenant);
        const saved = await service.list();
        return jsonOk(saved);
    } catch (err) {
        return jsonError(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const body = await req.json();
        const data = validateBody(SaveCompanySchema, body);

        const service = new SavedCompanyService(tenant);
        const saved = await service.save(data);
        return jsonOk(saved, 201);
    } catch (err) {
        return jsonError(err);
    }
}
