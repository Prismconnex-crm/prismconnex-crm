import { z } from "zod";

export const WEBHOOK_EVENTS = [
    "lead.created",
    "lead.updated",
    "lead.status_changed",
    "lead.assigned",
    "lead.deleted",
    "deal.created",
    "webhook.test",
] as const;

export const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const WebhookUrlSchema = z.string().trim().max(2048).url().refine((value) => {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password && !url.hash &&
            !/^(localhost|.+\.localhost|.+\.local)$/i.test(url.hostname);
    } catch {
        return false;
    }
}, "Use a public HTTPS URL without embedded credentials or a fragment");

const WebhookEventsSchema = z.array(WebhookEventSchema).min(1).max(WEBHOOK_EVENTS.length)
    .refine((events) => new Set(events).size === events.length, "Choose each event only once");

export const CreateWebhookSchema = z.object({
    name: z.string().trim().min(1).max(100),
    url: WebhookUrlSchema,
    events: WebhookEventsSchema,
});

export const UpdateWebhookSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    url: WebhookUrlSchema.optional(),
    events: WebhookEventsSchema.optional(),
    isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;

export type WebhookEndpointDTO = {
    id: string;
    name: string;
    url: string;
    events: WebhookEvent[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    lastDeliveryAt: string | null;
};

export type WebhookDeliveryDTO = {
    id: string;
    endpointId: string;
    endpointName: string;
    event: string;
    status: "PENDING" | "SUCCEEDED" | "FAILED";
    attempts: number;
    statusCode: number | null;
    responseSummary: string | null;
    errorMessage: string | null;
    createdAt: string;
    deliveredAt: string | null;
};

export type WebhookListResponse = {
    endpoints: WebhookEndpointDTO[];
    deliveries: WebhookDeliveryDTO[];
    schemaReady: boolean;
    signingConfigured: boolean;
    canManage: boolean;
};
