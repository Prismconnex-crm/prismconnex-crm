import { NextResponse } from "next/server";
import { defaultPreferences } from "@/lib/constants";
import { normalizeLocale } from "@/lib/locale";
import { getPreferences, savePreferences } from "@/lib/preferences-store";
import { requireSession } from "@/lib/session";
import type { WorkspacePreferences } from "@/types";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preferences = await getPreferences();
  return NextResponse.json({ preferences });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json()) as WorkspacePreferences;
  const preferences = await savePreferences({
    ...defaultPreferences,
    ...payload,
    locale: normalizeLocale(payload.locale) ?? defaultPreferences.locale,
  });

  if (session.workspaceId) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.workspaceSettings.upsert({
        where: { workspaceId: session.workspaceId },
        update: {
          locale: preferences.locale,
          timeZone: preferences.timeZone,
          currency: preferences.currency,
          dateFormat: preferences.dateFormat,
          timeFormat: preferences.timeFormat,
          showDualTime: preferences.showDualTime,
        },
        create: {
          workspaceId: session.workspaceId,
          locale: preferences.locale,
          timeZone: preferences.timeZone,
          currency: preferences.currency,
          dateFormat: preferences.dateFormat,
          timeFormat: preferences.timeFormat,
          showDualTime: preferences.showDualTime,
        },
      });
    } catch {
      // Cookie and local preference persistence remain the fallback when the DB is unavailable.
    }
  }

  const response = NextResponse.json({ preferences });
  response.cookies.set("pc_locale", preferences.locale, { path: "/", maxAge: 60 * 60 * 24 * 180 });
  response.cookies.set("pcx_locale", preferences.locale, { path: "/", maxAge: 60 * 60 * 24 * 180 });
  return response;
}
