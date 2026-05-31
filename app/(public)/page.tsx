"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localizePathname } from "@/lib/locale";
import type { Locale } from "@/types";
import { Button } from "@/components/ui/button";
import { Hero } from "@/components/landing/hero";
import { PersonaWorkflows } from "@/components/landing/persona-workflows";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { SecurityStrip } from "@/components/landing/security-strip";
import { StatsStrip } from "@/components/landing/stats-strip";
import { TicketsTravelSection } from "@/components/landing/tickets-travel-section";

export default function HomePage() {
  const t = useTranslations("marketing.home.finalCta");
  const locale = useLocale() as Locale;

  return (
    <div className="relative min-h-screen">
      <Hero />
      <StatsStrip />
      <PersonaWorkflows />
      <FeaturesGrid />
      <TicketsTravelSection />
      <SecurityStrip />

      <section className="relative py-14 md:py-20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2 h-64 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/8 blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto max-w-7xl px-5 text-center md:px-8"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {t("titlePrefix")} <span className="text-gradient">{t("titleHighlight")}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg">{t("description")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/auth/sign-in">
              <Button
                size="lg"
                className="btn-glow gap-2 rounded-full bg-indigo-600 px-8 text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:bg-indigo-500 hover:shadow-indigo-500/40"
              >
                {t("primaryCta")}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href={localizePathname("/product", locale)}>
              <div className="nav-cta-border group/cta relative rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400 bg-[length:400%_100%] p-[3px] transition-all duration-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35),0_0_60px_rgba(59,130,246,0.15)] active:scale-[0.97]">
                <div className="relative flex items-center justify-center gap-2 rounded-full bg-[#0a0f1e] px-8 py-3 transition-all duration-300 group-hover/cta:bg-[#0e1428]">
                  <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-700 group-hover/cta:translate-x-full" />
                  </span>
                  <span className="relative text-sm font-semibold text-white">{t("secondaryCta")}</span>
                </div>
              </div>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

