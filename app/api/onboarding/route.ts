import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { UnauthorizedError } from "@/lib/http/errors";
import { jsonOk, jsonError } from "@/lib/http/response";
import { prisma } from "@/lib/db/prisma";
import { getSessionPayload } from "@/lib/auth/session";
import { defaultLocale, normalizeLocale } from "@/lib/locale";
import { ProfileService } from "@/services/profile.service";
import { composeFullName } from "@/models/auth";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const onboardingSchema = z.object({
    // trim() before min() so "  " (or " a ") is rejected rather than stored as a
    // whitespace workspace name, and the message names the field for the client.
    workspaceName: z
        .string({ message: "Workspace name is required" })
        .trim()
        .min(2, "Workspace name must be at least 2 characters"),
    locale: z.string().trim().default(defaultLocale),
    timeZone: z.string().trim().default("Europe/Berlin"),
    currency: z.string().trim().default("EUR"),
});

export async function POST(req: NextRequest) {
    try {
        const payload = await getSessionPayload();
        if (!payload || !payload.sub || !payload.email) {
            return jsonError(new UnauthorizedError());
        }

        const email = payload.email as string;

        const body = await req.json();
        const data = validateBody(onboardingSchema, body);
        const locale = normalizeLocale(data.locale) ?? defaultLocale;

        // payload.sub is the Supabase Auth user id for sessions created by
        // Supabase Auth, and a non-uuid placeholder for legacy/demo sessions.
        const supabaseUserId = UUID_PATTERN.test(payload.sub as string)
            ? (payload.sub as string)
            : null;

        const profile = supabaseUserId ? await ProfileService.getByUserId(supabaseUserId) : null;
        const displayName = profile
            ? composeFullName({
                  firstName: profile.firstName,
                  middleName: profile.middleName ?? undefined,
                  lastName: profile.lastName,
              })
            : email.split("@")[0];

        const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
            // Prefer the auth id, then email — matching resolveTenant() so a user
            // who signed up before this migration is not duplicated.
            let user = supabaseUserId
                ? await tx.user.findUnique({ where: { supabaseUserId } })
                : null;

            user ??= await tx.user.findUnique({ where: { email } });

            if (!user) {
                user = await tx.user.create({
                    data: {
                        email,
                        name: displayName,
                        supabaseUserId,
                    },
                });
            } else if (supabaseUserId && !user.supabaseUserId) {
                // Backfill the link for a record originally created by email only.
                user = await tx.user.update({
                    where: { id: user.id },
                    data: { supabaseUserId, name: user.name ?? displayName },
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
