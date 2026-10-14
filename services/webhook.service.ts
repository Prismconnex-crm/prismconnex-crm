import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { TenantContext } from "@/lib/auth/tenant";
import { decryptSecret, encryptSecret } from "@/lib/integrations/token-crypto";
import { AuditService } from "@/lib/audit/audit.service";
import { ApiError, BadRequestError, NotFoundError } from "@/lib/http/errors";
import { authorize, Role } from "@/lib/rbac/authorize";
import {
    WEBHOOK_EVENTS,
    type CreateWebhookInput,
    type UpdateWebhookInput,
    type WebhookDeliveryDTO,
    type WebhookEndpointDTO,
    type WebhookEvent,
    type WebhookListResponse,
} from "@/models/webhook";
import { WebhookRepository } from "@/repositories/webhook.repository";

const MAX_ENDPOINTS_PER_WORKSPACE = 20;
const DELIVERY_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_CHARS = 2_000;
const SIGNATURE_VERSION = "v1";

type PublicEvent = { id: string; type: string; createdAt: string; data: unknown };

function signingKey() {
    const key = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();
    if (!key || key.length < 32) {
        throw new ApiError("Configure INTEGRATIONS_ENCRYPTION_KEY (at least 32 characters) before managing webhooks.", 503);
    }
    return key;
}

function toEndpointDTO(row: {
    id: string;
    name: string;
    url: string;
    events: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastDeliveryAt: Date | null;
}): WebhookEndpointDTO {
    return {
        id: row.id,
        name: row.name,
        url: row.url,
        events: row.events as WebhookEvent[],
        isActive: row.isActive,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastDeliveryAt: row.lastDeliveryAt?.toISOString() ?? null,
    };
}

function toDeliveryDTO(row: {
    id: string;
    endpointId: string;
    event: string;
    status: string;
    attempts: number;
    statusCode: number | null;
    responseSummary: string | null;
    errorMessage: string | null;
    createdAt: Date;
    deliveredAt: Date | null;
    endpointName: string;
}): WebhookDeliveryDTO {
    return {
        id: row.id,
        endpointId: row.endpointId,
        endpointName: row.endpointName,
        event: row.event,
        status: row.status as WebhookDeliveryDTO["status"],
        attempts: row.attempts,
        statusCode: row.statusCode,
        responseSummary: row.responseSummary,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt.toISOString(),
        deliveredAt: row.deliveredAt?.toISOString() ?? null,
    };
}

function isPrivateIpv4(address: string) {
    const parts = address.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b, c] = parts;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
        (a === 203 && b === 0 && c === 113);
}

function isPublicAddress(address: string) {
    const family = isIP(address);
    if (family === 4) return !isPrivateIpv4(address);
    if (family !== 6) return false;

    const value = address.toLowerCase().split("%")[0];
    // Only globally allocated unicast space is allowed. This excludes loopback,
    // link-local, unique-local, IPv4-mapped, multicast and documentation ranges.
    return /^[23]/.test(value) && !value.startsWith("2001:db8") && !value.startsWith("2001:0000");
}

async function resolvePublicAddresses(hostname: string): Promise<LookupAddress[]> {
    if (isIP(hostname)) throw new BadRequestError("Webhook URLs must use a public hostname, not an IP address.");
    let addresses: LookupAddress[];
    try {
        addresses = await dnsLookup(hostname, { all: true, verbatim: true });
    } catch {
        throw new Error("The webhook host could not be resolved.");
    }
    if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
        throw new Error("The webhook host resolves to a non-public network address.");
    }
    return addresses;
}

function postPinnedHttps(url: URL, addresses: LookupAddress[], body: string, headers: Record<string, string>) {
    return new Promise<{ statusCode: number; responseSummary: string }>((resolve, reject) => {
        const lookup: LookupFunction = (_hostname, options, callback) => {
            if (options.all) {
                callback(null, addresses);
                return;
            }
            const preferred = addresses.find((entry) => entry.family === options.family) ?? addresses[0];
            callback(null, preferred.address, preferred.family);
        };
        const request = httpsRequest({
            protocol: "https:",
            hostname: url.hostname,
            port: url.port || 443,
            path: `${url.pathname}${url.search}`,
            method: "POST",
            headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
            lookup,
            servername: url.hostname,
        }, (response) => {
            let responseChars = 0;
            let responseTruncated = false;
            response.on("data", (chunk: Buffer | string) => {
                responseChars += Buffer.byteLength(chunk);
                if (responseChars > MAX_RESPONSE_CHARS) {
                    responseTruncated = true;
                    request.destroy(new Error("Response too large"));
                }
            });
            response.on("end", () => {
                const statusCode = response.statusCode ?? 0;
                resolve({ statusCode, responseSummary: responseTruncated ? "Response received (truncated)" : `HTTP ${statusCode}` });
            });
            response.on("error", reject);
        });
        request.setTimeout(DELIVERY_TIMEOUT_MS, () => request.destroy(new Error("Webhook request timed out")));
        request.on("error", reject);
        request.end(body);
    });
}

function safeErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.includes("timed out")) return "The endpoint did not respond before the 8 second timeout.";
    if (error instanceof Error && error.message.includes("could not be resolved")) return error.message;
    if (error instanceof Error && error.message.includes("non-public")) return error.message;
    return "Delivery failed because of a DNS, TLS, or network error.";
}

export class WebhookService {
    constructor(private readonly tenant: TenantContext) {}

    async list(): Promise<WebhookListResponse> {
        authorize(this.tenant, Role.VIEWER);
        try {
            await WebhookRepository.assertReady();
        } catch (error) {
            if (error instanceof ApiError && error.message.includes("Webhook tables are missing")) {
                return {
                    endpoints: [],
                    deliveries: [],
                    schemaReady: false,
                    signingConfigured: Boolean(process.env.INTEGRATIONS_ENCRYPTION_KEY && process.env.INTEGRATIONS_ENCRYPTION_KEY.trim().length >= 32),
                    canManage: this.tenant.role === Role.ADMIN,
                };
            }
            throw error;
        }
        const [endpoints, deliveries] = await Promise.all([
            WebhookRepository.listEndpoints(this.tenant.workspaceId),
            WebhookRepository.listDeliveries(this.tenant.workspaceId),
        ]);
        return {
            endpoints: endpoints.map(toEndpointDTO),
            deliveries: deliveries.map(toDeliveryDTO),
            schemaReady: true,
            signingConfigured: Boolean(process.env.INTEGRATIONS_ENCRYPTION_KEY && process.env.INTEGRATIONS_ENCRYPTION_KEY.trim().length >= 32),
            canManage: this.tenant.role === Role.ADMIN,
        };
    }

    async create(input: CreateWebhookInput) {
        authorize(this.tenant, Role.ADMIN);
        await WebhookRepository.assertReady();
        const key = signingKey();
        if (await WebhookRepository.countEndpoints(this.tenant.workspaceId) >= MAX_ENDPOINTS_PER_WORKSPACE) {
            throw new BadRequestError(`A workspace can have at most ${MAX_ENDPOINTS_PER_WORKSPACE} webhook endpoints.`);
        }
        const secret = `whsec_${randomBytes(32).toString("base64url")}`;
        try {
            const row = await WebhookRepository.createEndpoint({
                ...input,
                workspaceId: this.tenant.workspaceId,
                createdByUserId: this.tenant.userId,
                secretEnc: encryptSecret(secret, key),
            });
            await this.audit(row.id, "CREATE");
            return { endpoint: toEndpointDTO({ ...row, lastDeliveryAt: null }), signingSecret: secret };
        } catch (error) {
            if (typeof error === "object" && error !== null && "code" in error &&
                (error.code === "P2002" || (error.code === "P2010" && "message" in error && String(error.message).includes("WebhookEndpoint_workspaceId_url_key")))) {
                throw new BadRequestError("This URL is already registered in your workspace.");
            }
            throw error;
        }
    }

    async update(id: string, input: UpdateWebhookInput) {
        authorize(this.tenant, Role.ADMIN);
        await WebhookRepository.assertReady();
        await this.requireEndpoint(id);
        await WebhookRepository.updateEndpoint(this.tenant.workspaceId, id, input);
        await this.audit(id, "UPDATE");
        const updated = await this.requireEndpoint(id);
        return toEndpointDTO(updated);
    }

    async remove(id: string) {
        authorize(this.tenant, Role.ADMIN);
        await WebhookRepository.assertReady();
        await this.requireEndpoint(id);
        await this.audit(id, "DELETE");
        const result = await WebhookRepository.deleteEndpoint(this.tenant.workspaceId, id);
        if (result.count === 0) throw new NotFoundError("Webhook endpoint not found.");
    }

    async test(id: string) {
        authorize(this.tenant, Role.ADMIN);
        await WebhookRepository.assertReady();
        const endpoint = await this.requireEndpoint(id);
        const delivery = await this.deliver(endpoint, "webhook.test", { message: "PrismConnex test delivery" });
        return toDeliveryDTO({ ...delivery, endpointName: endpoint.name });
    }

    /** Called by CRM services after a successful database write. Failures are logged, never roll back the CRM action. */
    static async publish(tenant: TenantContext, event: WebhookEvent, data: unknown) {
        try {
            await WebhookRepository.assertReady();
            const endpoints = await WebhookRepository.listForEvent(tenant.workspaceId, event);
            await Promise.all(endpoints.map(async (endpoint) => {
                try {
                    const service = new WebhookService(tenant);
                    await service.deliver(endpoint, event, data);
                } catch (error) {
                    console.error("[webhook] delivery failed", { endpointId: endpoint.id, event, message: safeErrorMessage(error) });
                }
            }));
        } catch (error) {
            console.error("[webhook] event dispatch failed", { event, message: safeErrorMessage(error) });
        }
    }

    private async deliver(endpoint: {
        id: string;
        name: string;
        url: string;
        secretEnc: string;
        workspaceId: string;
    }, event: string, data: unknown) {
        const delivery = await WebhookRepository.createDelivery({
            workspaceId: this.tenant.workspaceId,
            endpointId: endpoint.id,
            event,
            status: "PENDING",
        });

        let result: { statusCode: number; responseSummary: string } | null = null;
        let errorMessage: string | null = null;
        try {
            const url = new URL(endpoint.url);
            if (url.protocol !== "https:" || url.username || url.password || url.hash) {
                throw new Error("Webhook URL is not an allowed HTTPS destination.");
            }
            const addresses = await resolvePublicAddresses(url.hostname);
            const secret = decryptSecret(endpoint.secretEnc, signingKey());
            const eventEnvelope: PublicEvent = {
                id: delivery.id,
                type: event,
                createdAt: new Date().toISOString(),
                data,
            };
            const body = JSON.stringify(eventEnvelope);
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
            result = await postPinnedHttps(url, addresses, body, {
                "Content-Type": "application/json",
                "User-Agent": "PrismConnex-Webhooks/1.0",
                "X-PrismConnex-Event": event,
                "X-PrismConnex-Delivery": delivery.id,
                "X-PrismConnex-Signature": `t=${timestamp},${SIGNATURE_VERSION}=${digest}`,
            });
            if (result.statusCode < 200 || result.statusCode >= 300) {
                errorMessage = `The endpoint returned HTTP ${result.statusCode}.`;
            }
        } catch (error) {
            errorMessage = safeErrorMessage(error);
        }

        const status = result && !errorMessage ? "SUCCEEDED" : "FAILED";
        const updated = await WebhookRepository.updateDelivery(delivery.id, {
            status,
            statusCode: result?.statusCode,
            responseSummary: result?.responseSummary,
            errorMessage: errorMessage ?? undefined,
            deliveredAt: new Date(),
        });
        await WebhookRepository.updateEndpoint(this.tenant.workspaceId, endpoint.id, { lastDeliveryAt: updated.deliveredAt ?? new Date() });
        return { ...updated, endpoint: { name: endpoint.name } };
    }

    private async requireEndpoint(id: string) {
        const endpoint = await WebhookRepository.findEndpoint(this.tenant.workspaceId, id);
        if (!endpoint) throw new NotFoundError("Webhook endpoint not found in this workspace.");
        return endpoint;
    }

    private audit(endpointId: string, action: string) {
        return AuditService.log(this.tenant.workspaceId, this.tenant.userId, "WEBHOOK_ENDPOINT", endpointId, action)
            .catch((error) => console.warn("[webhook] audit log failed", String(error)));
    }
}

// Exported for receiver documentation and consumers that verify a delivered
// message. The signed bytes are `${timestamp}.${rawRequestBody}`.
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string) {
    if (!header) return false;
    const timestamp = /(?:^|,)t=(\d+)/.exec(header)?.[1];
    const signature = /(?:^|,)v1=([a-f0-9]{64})/.exec(header)?.[1];
    if (!timestamp || !signature || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
    const provided = Buffer.from(signature, "hex");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export const WEBHOOK_EVENT_OPTIONS = WEBHOOK_EVENTS;
