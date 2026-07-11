import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError, BadRequestError } from "@/lib/http/errors";
import { jsonOk, jsonError } from "@/lib/http/response";
import { SavedCompanyService } from "@/services/saved-company.service";

export async function DELETE(
    req: NextRequest,
    { params }: { params: { companyId: string } }
) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();

        const companyId = params.companyId?.trim();
        if (!companyId) throw new BadRequestError("Missing companyId");

        const service = new SavedCompanyService(tenant);
        await service.remove(companyId);
        return jsonOk({ companyId });
    } catch (err) {
        return jsonError(err);
    }
}
