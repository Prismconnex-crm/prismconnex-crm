import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en-US", "en-GB", "de", "fr", "es", "pt", "ja", "zh-CN"],
  defaultLocale: "en-US",
  localePrefix: "always",
});
