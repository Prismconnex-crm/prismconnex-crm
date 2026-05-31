import { cookies, headers } from "next/headers";
import { defaultLocale, normalizeLocale } from "@/lib/locale";

export async function getLocaleFromCookies() {
  const cookieStore = cookies();
  return (
    normalizeLocale(cookieStore.get("pc_locale")?.value) ??
    normalizeLocale(cookieStore.get("pcx_locale")?.value) ??
    defaultLocale
  );
}

export async function getRequestLocale() {
  const requestHeaders = headers();
  return normalizeLocale(requestHeaders.get("x-pcx-locale")) ?? (await getLocaleFromCookies());
}

export async function getMessages(locale: string) {
  const normalizedLocale = normalizeLocale(locale) ?? defaultLocale;

  try {
    return (await import(`@/messages/${normalizedLocale}.json`)).default;
  } catch {
    return (await import(`@/messages/en-US.json`)).default;
  }
}
