"use client";

import { motion } from "framer-motion";
import { Briefcase, Ticket, Target, CalendarCheck, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  getMarketingCardHoverStyle,
  marketingCardCopyClass,
  marketingCardHoverLiftClass,
  marketingCardIconMotionClass,
  marketingCardInteractiveClass,
  marketingCardSheenOverlayClass,
  marketingCardTintOverlayClass,
  marketingCardTitleClass,
} from "@/components/landing/marketing-card-hover";

const accentMap = {
  violet: {
    rgb: "139, 92, 246",
    iconGradient: "from-violet-500 to-purple-600",
    borderR_dark: "linear-gradient(to bottom, transparent, rgba(139,92,246,0.12), rgba(139,92,246,0.45), rgba(139,92,246,0.12), transparent)",
    borderB_dark: "linear-gradient(to right, transparent, rgba(139,92,246,0.12), rgba(139,92,246,0.45), rgba(139,92,246,0.12), transparent)",
    borderR_light: "linear-gradient(to bottom, transparent, rgba(139,92,246,0.08), rgba(139,92,246,0.30), rgba(139,92,246,0.08), transparent)",
    borderB_light: "linear-gradient(to right, transparent, rgba(139,92,246,0.08), rgba(139,92,246,0.30), rgba(139,92,246,0.08), transparent)",
  },
  emerald: {
    rgb: "16, 185, 129",
    iconGradient: "from-emerald-500 to-teal-600",
    borderR_dark: "linear-gradient(to bottom, transparent, rgba(52,211,153,0.12), rgba(52,211,153,0.45), rgba(52,211,153,0.12), transparent)",
    borderB_dark: "linear-gradient(to right, transparent, rgba(52,211,153,0.12), rgba(52,211,153,0.45), rgba(52,211,153,0.12), transparent)",
    borderR_light: "linear-gradient(to bottom, transparent, rgba(16,185,129,0.08), rgba(16,185,129,0.30), rgba(16,185,129,0.08), transparent)",
    borderB_light: "linear-gradient(to right, transparent, rgba(16,185,129,0.08), rgba(16,185,129,0.30), rgba(16,185,129,0.08), transparent)",
  },
  amber: {
    rgb: "245, 158, 11",
    iconGradient: "from-amber-500 to-orange-600",
    borderR_dark: "linear-gradient(to bottom, transparent, rgba(245,158,11,0.12), rgba(245,158,11,0.45), rgba(245,158,11,0.12), transparent)",
    borderB_dark: "linear-gradient(to right, transparent, rgba(245,158,11,0.12), rgba(245,158,11,0.45), rgba(245,158,11,0.12), transparent)",
    borderR_light: "linear-gradient(to bottom, transparent, rgba(245,158,11,0.08), rgba(245,158,11,0.30), rgba(245,158,11,0.08), transparent)",
    borderB_light: "linear-gradient(to right, transparent, rgba(245,158,11,0.08), rgba(245,158,11,0.30), rgba(245,158,11,0.08), transparent)",
  },
  pink: {
    rgb: "236, 72, 153",
    iconGradient: "from-pink-500 to-rose-600",
    borderR_dark: "linear-gradient(to bottom, transparent, rgba(236,72,153,0.12), rgba(236,72,153,0.45), rgba(236,72,153,0.12), transparent)",
    borderB_dark: "linear-gradient(to right, transparent, rgba(236,72,153,0.12), rgba(236,72,153,0.45), rgba(236,72,153,0.12), transparent)",
    borderR_light: "linear-gradient(to bottom, transparent, rgba(236,72,153,0.08), rgba(236,72,153,0.30), rgba(236,72,153,0.08), transparent)",
    borderB_light: "linear-gradient(to right, transparent, rgba(236,72,153,0.08), rgba(236,72,153,0.30), rgba(236,72,153,0.08), transparent)",
  },
} as const;

const iconMap = {
  serviceProviders: Briefcase,
  attendees: Ticket,
  exhibitors: Target,
  organizers: CalendarCheck,
} as const;

type Accent = keyof typeof accentMap;

type Persona = {
  id: keyof typeof iconMap;
  title: string;
  accent: Accent;
  description: string;
  flow: string[];
};

function WorkflowCard({ title, accent, description, flow, id }: Persona) {
  const accentStyles = accentMap[accent];
  const Icon = iconMap[id];

  return (
    <div
      className={cn(
        "wf-card flex h-full cursor-default flex-col rounded-2xl border border-slate-200/50 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-transparent dark:bg-white/[0.05] dark:shadow-none",
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

      <div className={cn(`wf-icon mb-3.5 flex size-10 items-center justify-center rounded-[10px] bg-gradient-to-br ${accentStyles.iconGradient} shadow-md group-hover:rotate-[3deg]`, marketingCardIconMotionClass)}>
        <Icon className="size-4.5 text-white" />
      </div>

      <div className="relative flex flex-1 flex-col pb-3">
        <h3 className={cn("text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white", marketingCardTitleClass)}>{title}</h3>
        <p className={cn("mt-1.5 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-300/80", marketingCardCopyClass)}>{description}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        {flow.map((step, index) => (
          <span key={step} className="flex items-center gap-1" style={{ transitionDelay: `${index * 40}ms` }}>
            <span className="wf-chip rounded-md border border-slate-200/60 bg-slate-50/80 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 transition-all duration-300 group-hover:text-slate-800 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300/90 dark:group-hover:text-white/90">
              {step}
            </span>
            {index < flow.length - 1 ? (
              <ArrowRight className="size-2.5 text-slate-300 transition-colors duration-300 group-hover:text-slate-400 dark:text-slate-500/50 dark:group-hover:text-slate-400/70" />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PersonaWorkflows() {
  const t = useTranslations("marketing.home.personas");
  const personas = t.raw("items") as Persona[];

  return (
    <section className="relative py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {t("eyebrow")}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground md:text-4xl lg:text-5xl">
            {t("titlePrefix")} <span className="text-gradient">{t("titleHighlight")}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-500 dark:text-muted-foreground md:text-lg">{t("description")}</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4"
        >
          {personas.map((persona) => (
            <motion.div
              key={persona.id}
              variants={{ hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } } }}
              className="h-full"
            >
              <WorkflowCard {...persona} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
