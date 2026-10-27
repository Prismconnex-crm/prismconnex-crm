"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { BrandWordmark } from "@/components/brand-wordmark";
import { localizePathname } from "@/lib/locale";
import type { Locale } from "@/types";

const productLinks = [
  { href: "/product", labelKey: "features" },
  { href: "/pricing", labelKey: "plans" },
  { href: "/security", labelKey: "security" },
] as const;

const companyLinks = [
  { href: "#", labelKey: "about" },
  { href: "#", labelKey: "blog" },
  { href: "#", labelKey: "careers" },
  { href: "#", labelKey: "contact" },
] as const;

const legalLinks = [
  { href: "#", labelKey: "privacy" },
  { href: "#", labelKey: "terms" },
  { href: "#", labelKey: "cookies" },
] as const;

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="footer-link relative text-sm text-slate-500 transition-all duration-300 hover:bg-gradient-to-r hover:from-sky-400 hover:via-blue-500 hover:to-cyan-300 hover:bg-clip-text hover:text-transparent dark:text-slate-400"
      >
        {label}
        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-sky-400 via-blue-500 to-cyan-300 transition-all duration-300 group-hover:w-full" />
      </Link>
    </li>
  );
}

export function PublicFooter() {
  const t = useTranslations("marketing.footer");
  const locale = useLocale() as Locale;

  return (
    <footer className="relative bg-[#F7F8FC] dark:bg-[#0B1220]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
      <div className="absolute inset-x-0 top-px h-px bg-gradient-to-r from-transparent via-sky-400/20 to-transparent" />
      <div className="absolute inset-0 bg-white/30 backdrop-blur-sm dark:bg-white/[0.02]" />

      <div className="relative mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-18">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {/* The same lockup the app sidebar uses — emblem, then the wordmark
                with BrandMark standing in for the "o", then "Global Solutions".
                It previously set the name as plain text with a gradient on
                "connex" and sat the logo in a bordered plate, so the public
                footer and the signed-in app disagreed about what the brand
                looks like. Brand blue on light, white on dark: #005C9D is only
                2.47:1 on the dark footer, while white reads 15.8:1. */}
            <Link href={localizePathname("/", locale)} className="inline-flex items-center gap-3">
              <div className="relative h-9 w-9 shrink-0">
                <BrandMark fill sizes="36px" className="object-contain" />
              </div>
              <div className="overflow-hidden whitespace-nowrap leading-tight">
                <p className="text-sm font-bold tracking-wide text-brand dark:text-white">
                  <BrandWordmark />
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-brand dark:text-white">
                  Global Solutions
                </p>
              </div>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">{t("description")}</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                SOC 2
              </span>
              <span className="inline-flex items-center rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                GDPR
              </span>
              <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                SLA-Ready
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t("sections.product")}</h4>
            <ul className="mt-4 space-y-2.5">
              {productLinks.map((link) => (
                <FooterLink key={link.labelKey} href={localizePathname(link.href, locale)} label={t(`productLinks.${link.labelKey}`)} />
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t("sections.company")}</h4>
            <ul className="mt-4 space-y-2.5">
              {companyLinks.map((link) => (
                <FooterLink key={link.labelKey} href={link.href} label={t(`companyLinks.${link.labelKey}`)} />
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t("sections.legal")}</h4>
            <ul className="mt-4 space-y-2.5">
              {legalLinks.map((link) => (
                <FooterLink key={link.labelKey} href={link.href} label={t(`legalLinks.${link.labelKey}`)} />
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200/50 pt-6 dark:border-white/[0.06] md:flex-row">
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("copyright")}</p>
          <p className="group/heart text-xs text-slate-500 dark:text-slate-400">
            {/* An icon, not a character: this was a literal "?" — a heart glyph
                that had been mangled somewhere in the file's encoding history
                and rendered as the replacement character. An SVG cannot be
                corrupted that way. */}
            {t("builtWithPrefix")}{" "}
            <Heart
              aria-label="love"
              className="footer-heart inline-block size-3.5 fill-red-500 align-text-bottom text-red-500 transition-transform duration-300 group-hover/heart:scale-110"
            />{" "}
            {t("builtWithSuffix")}
          </p>
        </div>
      </div>
    </footer>
  );
}
