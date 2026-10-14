import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/http/errors";

export type WebhookEndpointRow = {
    id: string;
    workspaceId: string;
    createdByUserId: string | null;
    name: string;
    url: string;
    secretEnc: string;
    events: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastDeliveryAt: Date | null;
};

export type WebhookDeliveryRow = {
    id: string;
    workspaceId: string;
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
};

export class WebhookRepository {
    static async assertReady() {
        const rows = await prisma.$queryRaw<Array<{ endpoints: string | null; deliveries: string | null }>>`
            SELECT to_regclass('public."WebhookEndpoint"')::text AS endpoints,
                   to_regclass('public."WebhookDelivery"')::text AS deliveries
        `;
        if (!rows[0]?.endpoints || !rows[0]?.deliveries) {
            throw new ApiError("Webhook tables are missing. Apply the new workspace-webhooks migration to this database.", 503);
        }
    }

    static async countEndpoints(workspaceId: string) {
        const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) AS count FROM "WebhookEndpoint" WHERE "workspaceId" = ${workspaceId}
        `;
        return Number(rows[0]?.count ?? 0);
    }

    static listEndpoints(workspaceId: string) {
        return prisma.$queryRaw<Array<Omit<WebhookEndpointRow, "workspaceId" | "createdByUserId" | "secretEnc">>>`
            SELECT "id", "name", "url", "events", "isActive", "createdAt", "updatedAt", "lastDeliveryAt"
            FROM "WebhookEndpoint" WHERE "workspaceId" = ${workspaceId}
            ORDER BY "createdAt" DESC
        `;
    }

    static listForEvent(workspaceId: string, event: string) {
        return prisma.$queryRaw<WebhookEndpointRow[]>`
            SELECT * FROM "WebhookEndpoint"
            WHERE "workspaceId" = ${workspaceId} AND "isActive" = TRUE AND ${event} = ANY("events")
            ORDER BY "createdAt" ASC LIMIT 20
        `;
    }

    static async findEndpoint(workspaceId: string, id: string) {
        const rows = await prisma.$queryRaw<WebhookEndpointRow[]>`
            SELECT * FROM "WebhookEndpoint" WHERE "workspaceId" = ${workspaceId} AND "id" = ${id} LIMIT 1
        `;
        return rows[0] ?? null;
    }

    static async createEndpoint(data: {
        workspaceId: string;
        createdByUserId: string;
        name: string;
        url: string;
        secretEnc: string;
        events: string[];
    }) {
        const rows = await prisma.$queryRaw<WebhookEndpointRow[]>`
            INSERT INTO "WebhookEndpoint" ("id", "workspaceId", "createdByUserId", "name", "url", "secretEnc", "events", "isActive", "createdAt", "updatedAt")
            VALUES (${`wh_${randomUUID()}`}, ${data.workspaceId}, ${data.createdByUserId}, ${data.name}, ${data.url}, ${data.secretEnc}, ARRAY[${Prisma.join(data.events.map((event) => Prisma.sql`${event}`))}]::TEXT[], TRUE, NOW(), NOW())
            RETURNING *
        `;
        return rows[0];
    }

    static async updateEndpoint(workspaceId: string, id: string, data: {
        name?: string;
        url?: string;
        events?: string[];
        isActive?: boolean;
        lastDeliveryAt?: Date;
    }) {
        const setters: Prisma.Sql[] = [];
        if (data.name !== undefined) setters.push(Prisma.sql`"name" = ${data.name}`);
        if (data.url !== undefined) setters.push(Prisma.sql`"url" = ${data.url}`);
        if (data.events !== undefined) setters.push(Prisma.sql`"events" = ARRAY[${Prisma.join(data.events.map((event) => Prisma.sql`${event}`))}]::TEXT[]`);
        if (data.isActive !== undefined) setters.push(Prisma.sql`"isActive" = ${data.isActive}`);
        if (data.lastDeliveryAt !== undefined) setters.push(Prisma.sql`"lastDeliveryAt" = ${data.lastDeliveryAt}`);
        if (!setters.length) return 0;
        setters.push(Prisma.sql`"updatedAt" = NOW()`);
        return prisma.$executeRaw(Prisma.sql`
            UPDATE "WebhookEndpoint" SET ${Prisma.join(setters, ", ")}
            WHERE "workspaceId" = ${workspaceId} AND "id" = ${id}
        `);
    }

    static async deleteEndpoint(workspaceId: string, id: string) {
        const count = await prisma.$executeRaw`
            DELETE FROM "WebhookEndpoint" WHERE "workspaceId" = ${workspaceId} AND "id" = ${id}
        `;
        return { count };
    }

    static listDeliveries(workspaceId: string) {
        return prisma.$queryRaw<WebhookDeliveryRow[]>`
            SELECT d."id", d."workspaceId", d."endpointId", d."event", d."status", d."attempts",
                   d."statusCode", d."responseSummary", d."errorMessage", d."createdAt", d."deliveredAt",
                   e."name" AS "endpointName"
            FROM "WebhookDelivery" d
            INNER JOIN "WebhookEndpoint" e ON e."id" = d."endpointId"
            WHERE d."workspaceId" = ${workspaceId}
            ORDER BY d."createdAt" DESC LIMIT 50
        `;
    }

    static async createDelivery(data: {
        workspaceId: string;
        endpointId: string;
        event: string;
        status: string;
    }) {
        const rows = await prisma.$queryRaw<Omit<WebhookDeliveryRow, "endpointName">[]>`
            INSERT INTO "WebhookDelivery" ("id", "workspaceId", "endpointId", "event", "status", "attempts", "createdAt")
            VALUES (${`whd_${randomUUID()}`}, ${data.workspaceId}, ${data.endpointId}, ${data.event}, ${data.status}, 1, NOW())
            RETURNING *
        `;
        return rows[0];
    }

    static async updateDelivery(id: string, data: {
        status: string;
        statusCode?: number;
        responseSummary?: string;
        errorMessage?: string;
        deliveredAt: Date;
    }) {
        const rows = await prisma.$queryRaw<Array<Omit<WebhookDeliveryRow, "endpointName">>>`
            UPDATE "WebhookDelivery"
            SET "status" = ${data.status}, "statusCode" = ${data.statusCode ?? null},
                "responseSummary" = ${data.responseSummary ?? null}, "errorMessage" = ${data.errorMessage ?? null},
                "deliveredAt" = ${data.deliveredAt}
            WHERE "id" = ${id}
            RETURNING *
        `;
        return rows[0];
    }
}
