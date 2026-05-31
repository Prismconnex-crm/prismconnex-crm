import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { jsonOk, jsonError } from "@/lib/http/response";
import { prisma } from "@/lib/db/prisma";
import { getSessionPayload } from "@/lib/auth/session";
import { defaultLocale, normalizeLocale } from "@/lib/locale";

const onboardingSchema = z.object({
    workspaceName: z.string().min(2),
    locale: z.string().default(defaultLocale),
    timeZone: z.string().default("Europe/Berlin"),
    currency: z.string().default("EUR"),
});

export async function POST(req: NextRequest) {
    try {
        const payload = await getSessionPayload();
        if (!payload || !payload.sub || !payload.email) {
            return jsonError(new Error("Unauthorized"));
        }

        const email = payload.email as string;

        const body = await req.json();
        const data = validateBody(onboardingSchema, body);
        const locale = normalizeLocale(data.locale) ?? defaultLocale;

        const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
            // Find or create user by email (no cognitoSub in schema)
            let user = await tx.user.findUnique({ where: { email } });
            if (!user) {
                user = await tx.user.create({
                    data: {
                        email,
                        name: email.split("@")[0],
                    },
                });
            }

            const workspace = await tx.workspace.create({
                data: {
                    name: data.workspaceName,
                    region: "EU",
                },
            });

            await tx.membership.create({
                data: {
                    userId: user.id,
                    workspaceId: workspace.id,
                    role: "ADMIN",
                },
            });

            await tx.workspaceSettings.create({
                data: {
                    workspaceId: workspace.id,
                    locale,
                    timeZone: data.timeZone,
                    currency: data.currency,
                    showDualTime: true,
                },
            });

            return { workspaceId: workspace.id };
        });

        return jsonOk({ success: true, workspaceId: result.workspaceId });
    } catch (error) {
        return jsonError(error);
    }
}
