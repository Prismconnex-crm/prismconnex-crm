import { NextResponse } from "next/server";
import { defaultPreferences } from "@/lib/constants";
import { normalizeLocale } from "@/lib/locale";
import { getPreferences, savePreferences } from "@/lib/preferences-store";
import { requireSession } from "@/lib/session";
import type { WorkspacePreferences } from "@/types";

type LocalePayload = {
  locale?: string;
  timeZone?: string;
  currency?: string;
};

const supportedTimeZones = [
  "Europe/Berlin",
  "Europe/London",
  "America/New_York",
  "Asia/Kolkata",
] as const satisfies ReadonlyArray<WorkspacePreferences["timeZone"]>;

const supportedCurrencies = ["USD", "EUR", "GBP", "INR"] as const satisfies ReadonlyArray<WorkspacePreferences["currency"]>;

function isSupportedTimeZone(value: string | undefined): value is WorkspacePreferences["timeZone"] {
  return value !== undefined && supportedTimeZones.includes(value as WorkspacePreferences["timeZone"]);
}

function isSupportedCurrency(value: string | undefined): value is WorkspacePreferences["currency"] {
  return value !== undefined && supportedCurrencies.includes(value as WorkspacePreferences["currency"]);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as LocalePayload;
  const locale = normalizeLocale(payload.locale) ?? defaultPreferences.locale;
  const timeZone = isSupportedTimeZone(payload.timeZone) ? payload.timeZone : undefined;
  const currency = isSupportedCurrency(payload.currency) ? payload.currency : undefined;

  const nextPreferences: WorkspacePreferences = {
    ...(await getPreferences()),
    locale,
    ...(timeZone ? { timeZone } : {}),
    ...(currency ? { currency } : {}),
  };

  await savePreferences(nextPreferences);

  const session = await requireSession();
  if (session?.workspaceId) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const workspace = await prisma.workspace.findUnique({
        where: { id: session.workspaceId },
        select: { id: true },
      });

      if (workspace) {
        await prisma.workspaceSettings.upsert({
          where: { workspaceId: workspace.id },
          update: {
            locale,
            ...(timeZone ? { timeZone } : {}),
            ...(currency ? { currency } : {}),
          },
          create: {
            workspaceId: workspace.id,
            locale,
            timeZone: timeZone ?? defaultPreferences.timeZone,
            currency: currency ?? defaultPreferences.currency,
            showDualTime: defaultPreferences.showDualTime,
          },
        });
      }
    } catch {
      // Cookie persistence remains the fallback when the DB or workspace is unavailable.
    }
  }

  const response = NextResponse.json({ ok: true, locale });
  const maxAge = 60 * 60 * 24 * 180;

  response.cookies.set("pc_locale", locale, { path: "/", maxAge });
  response.cookies.set("pcx_locale", locale, { path: "/", maxAge });

  return response;
}
