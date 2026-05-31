"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  getMarketingCardHoverStyle,
  marketingCardHoverLiftSubtleClass,
  marketingCardInteractiveClass,
  marketingCardSheenOverlayClass,
  marketingCardTintOverlayClass,
  marketingCardTitleClass,
} from "@/components/landing/marketing-card-hover";

type Accent = "emerald" | "indigo" | "violet" | "amber";

const accents = {
  emerald: {
    rgb: "16, 185, 129",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  indigo: {
    rgb: "99, 102, 241",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  violet: {
    rgb: "139, 92, 246",
    text: "text-violet-600 dark:text-violet-400",
  },
  amber: {
    rgb: "245, 158, 11",
    text: "text-amber-600 dark:text-amber-400",
  },
} as const;

function StatCard({ value, label, accent }: { value: string; label: string; accent: Accent }) {
  const accentStyles = accents[accent];

  return (
    <div
      className={cn(
        "flex cursor-default flex-col rounded-2xl border border-slate-200/60 bg-white/80 p-7 text-center shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none",
        marketingCardInteractiveClass,
        marketingCardHoverLiftSubtleClass
      )}
      style={getMarketingCardHoverStyle(accentStyles.rgb)}
    >
      <div className={marketingCardTintOverlayClass} />
      <div className={marketingCardSheenOverlayClass} />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 hidden h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 dark:block"
        style={{ background: "rgba(var(--marketing-card-accent), 0.1)" }}
      />
      <div className="relative flex min-h-[5.75rem] flex-1 flex-col justify-center">
        <p className={cn(`text-3xl font-extrabold tracking-tight md:text-4xl ${accentStyles.text}`, marketingCardTitleClass)}>{value}</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

export function StatsStrip() {
  const t = useTranslations("marketing.home.stats");
  const stats = t.raw("items") as Array<{ value: string; label: string; accent: Accent }>;

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
      className="relative mx-auto max-w-7xl px-5 md:px-8"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent dark:via-white/[0.06]" />
      <div className="grid gap-4 py-12 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={{
              hidden: { opacity: 0, y: 24 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
            }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
