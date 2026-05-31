"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Shield,
  Activity,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localizePathname } from "@/lib/locale";
import type { Locale } from "@/types";
import { Button } from "@/components/ui/button";

function MockDashboard() {
  const t = useTranslations("marketing.home.hero.dashboard");
  const kpis = t.raw("kpis") as Array<{ label: string; value: string; color: string }>;
  const events = t.raw("events") as Array<{ name: string; score: string }>;

  return (
    <div className="mock-shimmer w-full rounded-2xl border border-border/40 bg-surface/70 p-4 shadow-lg backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2 border-b border-border/30 pb-3">
        <div className="h-2.5 w-2.5 rounded-full bg-danger/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
        <div className="ml-3 h-2 w-24 rounded bg-border/40" />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border/30 bg-card/50 p-2">
            <p className={`text-xs font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[9px] text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="flex h-16 items-end gap-1.5">
        {[40, 65, 45, 80, 60, 90, 50, 75].map((height, index) => (
          <div
            key={index}
            className="flex-1 rounded-t-sm bg-gradient-to-t from-indigo-500/40 to-indigo-400/20"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {events.map((event) => (
          <div key={event.name} className="flex items-center justify-between rounded-lg bg-border/10 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success/60" />
              <span className="text-[10px] font-medium text-foreground/80">{event.name}</span>
            </div>
            <span className="text-[9px] text-indigo-400">{event.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  const t = useTranslations("marketing.home.hero");
  const locale = useLocale() as Locale;
  const bullets = t.raw("bullets") as Array<{ icon: string; text: string }>;
  const iconMap = {
    shield: Shield,
    activity: Activity,
    chart: BarChart3,
  } as const;

  return (
    <section className="relative overflow-hidden pb-16 pt-8 md:pb-24 md:pt-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="needle needle-1" />
        <div className="needle needle-2" />
        <div className="needle needle-3" />
        <div className="needle needle-4" />
        <div className="needle needle-5" />
        <div className="needle needle-6" />
        <div className="needle needle-7" />
        <div className="needle needle-8" />
        <div className="particle particle-1" />
        <div className="particle particle-2" />
        <div className="particle particle-3" />
        <div className="particle particle-4" />
        <div className="particle particle-5" />
        <div className="particle particle-6" />
      </div>

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-80 w-80 animate-[hero-glow-pulse_8s_ease-in-out_infinite] rounded-full bg-indigo-500/10 blur-[100px]" />
        <div className="absolute right-1/4 top-20 h-60 w-60 animate-[hero-glow-pulse_10s_ease-in-out_infinite_2s] rounded-full bg-emerald-500/8 blur-[80px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-400">
                <Sparkles className="size-3" />
                {t("badge")}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl"
            >
              <span className="text-foreground">{t("headline.prefix")} </span>
              <span className="text-gradient-hero">{t("headline.line1")}</span>
              <br />
              <span className="text-gradient-hero">{t("headline.line2")}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              {t("description")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2"
            >
              {bullets.map((item) => {
                const Icon = iconMap[item.icon as keyof typeof iconMap];
                return (
                  <span key={item.text} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Icon className="size-3.5 text-indigo-400" />
                    {item.text}
                  </span>
                );
              })}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link href="/auth/sign-in">
                <Button
                  size="lg"
                  className="btn-glow gap-2 rounded-full bg-indigo-600 px-7 text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:bg-indigo-500 hover:shadow-indigo-500/40"
                >
                  {t("primaryCta")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href={localizePathname("/product", locale)}>
                <div className="nav-cta-border group/cta relative rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400 bg-[length:400%_100%] p-[3px] transition-all duration-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35),0_0_60px_rgba(59,130,246,0.15)] active:scale-[0.97]">
                  <div className="relative flex items-center justify-center gap-2 rounded-full bg-[#0a0f1e] px-7 py-3 transition-all duration-300 group-hover/cta:bg-[#0e1428]">
                    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-700 group-hover/cta:translate-x-full" />
                    </span>
                    <span className="relative text-sm font-semibold text-white">{t("secondaryCta")}</span>
                  </div>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="mt-8 flex items-center gap-3"
            >
              <div className="flex -space-x-2">
                {["A", "B", "C", "D"].map((letter) => (
                  <div
                    key={letter}
                    className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-indigo-500 to-emerald-500 text-[10px] font-bold text-white"
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{t("socialProof.count")}</span>{" "}
                {t("socialProof.label")}
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" as const }}
            className="relative hidden lg:block"
          >
            <div className="absolute -inset-4 rounded-3xl bg-indigo-500/10 blur-3xl" />
            <div className="relative">
              <MockDashboard />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="absolute -left-8 bottom-8 rounded-xl border border-border/40 bg-surface/90 px-4 py-3 shadow-lg backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{t("floatingCard.title")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("floatingCard.meta")}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

