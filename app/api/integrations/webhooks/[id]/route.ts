import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonError, jsonOk } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { UpdateWebhookSchema } from "@/models/webhook";
import { WebhookService } from "@/services/webhook.service";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        const body = await request.json().catch(() => null);
        const input = validateBody(UpdateWebhookSchema, body);
        return jsonOk(await new WebhookService(tenant).update(params.id, input));
    } catch (error) {
        return jsonError(error);
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        await new WebhookService(tenant).remove(params.id);
        return jsonOk({ deleted: true });
    } catch (error) {
        return jsonError(error);
    }
}
