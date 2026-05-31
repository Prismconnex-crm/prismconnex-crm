import { getRequestConfig } from "next-intl/server";
import { defaultLocale, normalizeLocale } from "@/lib/locale";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = normalizeLocale(await requestLocale) ?? defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
