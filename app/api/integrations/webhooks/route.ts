import { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/auth/tenant";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonError, jsonOk } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { CreateWebhookSchema } from "@/models/webhook";
import { WebhookService } from "@/services/webhook.service";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        return jsonOk(await new WebhookService(tenant).list());
    } catch (error) {
        return jsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const tenant = await resolveTenant();
        if (!tenant) throw new UnauthorizedError();
        const body = await request.json().catch(() => null);
        const input = validateBody(CreateWebhookSchema, body);
        return jsonOk(await new WebhookService(tenant).create(input), 201);
    } catch (error) {
        return jsonError(error);
    }
}
