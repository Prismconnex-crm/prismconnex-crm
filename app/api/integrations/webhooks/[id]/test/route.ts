import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonError, jsonOk } from "@/lib/http/response";
import { WebhookService } from "@/services/webhook.service";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        return jsonOk(await new WebhookService(tenant).test(params.id));
    } catch (error) {
        return jsonError(error);
    }
}
