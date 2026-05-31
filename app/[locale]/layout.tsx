import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LocaleIntlProvider } from "@/components/providers/locale-intl-provider";
import { getMessages } from "@/lib/i18n";
import { isLocale, locales } from "@/lib/locale";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const messages = await getMessages(params.locale);

  return (
    <LocaleIntlProvider locale={params.locale} messages={messages}>
      {children}
    </LocaleIntlProvider>
  );
}
