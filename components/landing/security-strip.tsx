"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Cloud, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  getMarketingCardHoverStyle,
  marketingCardCopyClass,
  marketingCardHoverLiftClass,
  marketingCardIconMotionClass,
  marketingCardInteractiveClass,
  marketingCardPulseClass,
  marketingCardSheenOverlayClass,
  marketingCardTintOverlayClass,
  marketingCardTitleClass,
} from "@/components/landing/marketing-card-hover";

const accentMap = {
  emerald: { rgb: "16, 185, 129", iconGradient: "from-emerald-500 to-teal-600", borderR_dark: "linear-gradient(to bottom, transparent, rgba(52,211,153,0.12), rgba(52,211,153,0.45), rgba(52,211,153,0.12), transparent)", borderB_dark: "linear-gradient(to right, transparent, rgba(52,211,153,0.12), rgba(52,211,153,0.45), rgba(52,211,153,0.12), transparent)", borderR_light: "linear-gradient(to bottom, transparent, rgba(16,185,129,0.08), rgba(16,185,129,0.30), rgba(16,185,129,0.08), transparent)", borderB_light: "linear-gradient(to right, transparent, rgba(16,185,129,0.08), rgba(16,185,129,0.30), rgba(16,185,129,0.08), transparent)" },
  indigo: { rgb: "99, 102, 241", iconGradient: "from-indigo-500 to-indigo-600", borderR_dark: "linear-gradient(to bottom, transparent, rgba(99,102,241,0.12), rgba(99,102,241,0.45), rgba(99,102,241,0.12), transparent)", borderB_dark: "linear-gradient(to right, transparent, rgba(99,102,241,0.12), rgba(99,102,241,0.45), rgba(99,102,241,0.12), transparent)", borderR_light: "linear-gradient(to bottom, transparent, rgba(99,102,241,0.08), rgba(99,102,241,0.28), rgba(99,102,241,0.08), transparent)", borderB_light: "linear-gradient(to right, transparent, rgba(99,102,241,0.08), rgba(99,102,241,0.28), rgba(99,102,241,0.08), transparent)" },
  violet: { rgb: "139, 92, 246", iconGradient: "from-violet-500 to-purple-600", borderR_dark: "linear-gradient(to bottom, transparent, rgba(139,92,246,0.12), rgba(139,92,246,0.45), rgba(139,92,246,0.12), transparent)", borderB_dark: "linear-gradient(to right, transparent, rgba(139,92,246,0.12), rgba(139,92,246,0.45), rgba(139,92,246,0.12), transparent)", borderR_light: "linear-gradient(to bottom, transparent, rgba(139,92,246,0.08), rgba(139,92,246,0.28), rgba(139,92,246,0.08), transparent)", borderB_light: "linear-gradient(to right, transparent, rgba(139,92,246,0.08), rgba(139,92,246,0.28), rgba(139,92,246,0.08), transparent)" },
  amber: { rgb: "245, 158, 11", iconGradient: "from-amber-500 to-orange-600", borderR_dark: "linear-gradient(to bottom, transparent, rgba(245,158,11,0.12), rgba(245,158,11,0.45), rgba(245,158,11,0.12), transparent)", borderB_dark: "linear-gradient(to right, transparent, rgba(245,158,11,0.12), rgba(245,158,11,0.45), rgba(245,158,11,0.12), transparent)", borderR_light: "linear-gradient(to bottom, transparent, rgba(245,158,11,0.08), rgba(245,158,11,0.28), rgba(245,158,11,0.08), transparent)", borderB_light: "linear-gradient(to right, transparent, rgba(245,158,11,0.08), rgba(245,158,11,0.28), rgba(245,158,11,0.08), transparent)" },
} as const;

const iconMap = { shield: Shield, lock: Lock, cloud: Cloud, clock: Clock } as const;

type Accent = keyof typeof accentMap;
type Badge = { icon: keyof typeof iconMap; label: string; desc: string; accent: Accent };

function SecurityCard({ icon, label, desc, accent }: Badge) {
  const accentStyles = accentMap[accent];
  const Icon = iconMap[icon];

  return (
    <div
      className={cn(
        "sc-card flex h-full items-start gap-4 rounded-2xl border border-slate-200/50 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-transparent dark:bg-white/[0.05] dark:shadow-none",
        marketingCardInteractiveClass,
        marketingCardHoverLiftClass
      )}
      style={getMarketingCardHoverStyle(accentStyles.rgb)}
    >
      <div className={marketingCardTintOverlayClass} />
      <div className={marketingCardSheenOverlayClass} />
      <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-px opacity-[0.15] transition-opacity duration-300 group-hover:opacity-100 dark:block" style={{ background: accentStyles.borderR_dark }} />
      <div className="pointer-events-none absolute right-0 top-0 block h-full w-px opacity-[0.15] transition-opacity duration-300 group-hover:opacity-100 dark:hidden" style={{ background: accentStyles.borderR_light }} />
      <div className="pointer-events-none absolute bottom-0 left-0 hidden h-px w-full opacity-[0.15] transition-opacity duration-300 group-hover:opacity-100 dark:block" style={{ background: accentStyles.borderB_dark }} />
      <div className="pointer-events-none absolute bottom-0 left-0 block h-px w-full opacity-[0.15] transition-opacity duration-300 group-hover:opacity-100 dark:hidden" style={{ background: accentStyles.borderB_light }} />
      <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-slate-300/30 via-slate-200/20 to-transparent dark:from-white/[0.08] dark:via-white/[0.04]" />
      <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-slate-300/30 via-slate-200/20 to-transparent dark:from-white/[0.08] dark:via-white/[0.04]" />
      <div className="relative shrink-0">
        <div className={cn("sc-pulse absolute inset-0 m-auto size-14 rounded-xl", marketingCardPulseClass)} style={{ background: "radial-gradient(circle, rgba(var(--marketing-card-accent), 0.16) 0%, transparent 70%)" }} />
        <div className={cn(`sc-icon relative flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${accentStyles.iconGradient} shadow-lg`, marketingCardIconMotionClass)}>
          <Icon className="size-5 text-white" />
        </div>
      </div>
      <div className="relative min-w-0 flex-1 min-h-[5.5rem]">
        <p className={cn("text-[15px] font-bold tracking-tight text-slate-900 dark:text-white", marketingCardTitleClass)}>{label}</p>
        <p className={cn("mt-0.5 text-[13px] text-slate-500 dark:text-slate-400/70", marketingCardCopyClass)}>{desc}</p>
      </div>
    </div>
  );
}

export function SecurityStrip() {
  const t = useTranslations("marketing.home.securityStrip");
  const badges = t.raw("items") as Badge[];

  return (
    <section className="relative py-16 md:py-20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent dark:via-white/[0.06]" />
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-slate-200/40 bg-slate-50/60 p-8 shadow-sm backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.03] dark:shadow-none md:p-12"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground md:text-3xl">
              {t("titlePrefix")} <span className="text-gradient">{t("titleHighlight")}</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 dark:text-muted-foreground md:text-base">{t("description")}</p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {badges.map((badge, index) => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" as const }}
                className="h-full"
              >
                <SecurityCard {...badge} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
