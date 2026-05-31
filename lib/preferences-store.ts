import fs from "node:fs/promises";
import path from "node:path";
import { defaultPreferences } from "@/lib/constants";
import { normalizeLocale } from "@/lib/locale";
import type { WorkspacePreferences } from "@/types";

const preferencesFile = path.join(process.cwd(), "data", "workspace-preferences.json");

export async function getPreferences(): Promise<WorkspacePreferences> {
  try {
    const raw = await fs.readFile(preferencesFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences> & { locale?: string };

    return {
      ...defaultPreferences,
      ...parsed,
      locale: normalizeLocale(parsed.locale) ?? defaultPreferences.locale,
    };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(next: WorkspacePreferences) {
  const normalized: WorkspacePreferences = {
    ...next,
    locale: normalizeLocale(next.locale) ?? defaultPreferences.locale,
  };

  await fs.mkdir(path.dirname(preferencesFile), { recursive: true });
  await fs.writeFile(preferencesFile, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}
