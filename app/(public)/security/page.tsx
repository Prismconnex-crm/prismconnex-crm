"use client";

import { motion } from "framer-motion";
import { Lock, FileText, KeyRound, MailCheck, GitBranch, ShieldCheck, Shield, Eye, Ticket } from "lucide-react";
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

const iconMap = {
  lock: Lock,
  shieldCheck: ShieldCheck,
  fileText: FileText,
  key: KeyRound,
  mail: MailCheck,
  branch: GitBranch,
  shield: Shield,
  eye: Eye,
  ticket: Ticket,
} as const;

type Accent = "indigo" | "emerald" | "amber" | "pink" | "cyan" | "violet";
type SecurityCardData = { icon: keyof typeof iconMap; title: string; text: string; accent: Accent };

const accentStyles: Record<
  Accent,
  { rgb: string; iconGradient: string; ruleGradient: string }
> = {
  indigo: {
    rgb: "99, 102, 241",
    iconGradient: "from-indigo-500 to-violet-600",
    ruleGradient: "linear-gradient(to right, rgba(99,102,241,0.85), transparent)",
  },
  emerald: {
    rgb: "16, 185, 129",
    iconGradient: "from-emerald-500 to-teal-600",
    ruleGradient: "linear-gradient(to right, rgba(16,185,129,0.85), transparent)",
  },
  amber: {
    rgb: "245, 158, 11",
    iconGradient: "from-amber-500 to-orange-600",
    ruleGradient: "linear-gradient(to right, rgba(245,158,11,0.85), transparent)",
  },
  pink: {
    rgb: "236, 72, 153",
    iconGradient: "from-pink-500 to-rose-600",
    ruleGradient: "linear-gradient(to right, rgba(236,72,153,0.85), transparent)",
  },
  cyan: {
    rgb: "6, 182, 212",
    iconGradient: "from-cyan-500 to-sky-600",
    ruleGradient: "linear-gradient(to right, rgba(6,182,212,0.85), transparent)",
  },
  violet: {
    rgb: "139, 92, 246",
    iconGradient: "from-violet-500 to-fuchsia-600",
    ruleGradient: "linear-gradient(to right, rgba(139,92,246,0.85), transparent)",
  },
};

const trustBadgeAccents: Accent[] = ["violet", "cyan", "emerald", "amber"];

function Card({ icon, title, text, accent }: SecurityCardData) {
  const Icon = iconMap[icon];
  const accentStyle = accentStyles[accent];

  return (
    <div
      className={cn(
        "sec-card flex h-full cursor-default flex-col rounded-2xl border border-slate-200/50 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-transparent dark:bg-white/[0.05] dark:shadow-none",
        marketingCardInteractiveClass,
        marketingCardHoverLiftClass
      )}
      style={getMarketingCardHoverStyle(accentStyle.rgb)}
    >
      <div className={marketingCardTintOverlayClass} />
      <div className={marketingCardSheenOverlayClass} />
      <div className={cn(`sec-icon relative mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${accentStyle.iconGradient} shadow-lg`, marketingCardIconMotionClass)}>
        <Icon className="size-5 text-white" />
      </div>
      <div className="relative flex min-h-[7.5rem] flex-1 flex-col">
        <h3 className={cn("text-base font-extrabold tracking-tight text-slate-900 dark:text-white md:text-lg", marketingCardTitleClass)}>{title}</h3>
        <p className={cn("mt-2 flex-1 text-[13px] text-slate-500 dark:text-slate-400/70", marketingCardCopyClass)}>{text}</p>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <div className="h-1 w-16 rounded-full opacity-40 transition-all duration-300 group-hover:w-24" style={{ background: accentStyle.ruleGradient }} />
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const t = useTranslations("marketing.security");
  const sections = t.raw("sections") as SecurityCardData[];
  const trustBadges = t.raw("trustBadges") as Array<{ icon: keyof typeof iconMap; label: string; desc: string }>;
  const dataNotes = t.raw("dataNotes") as SecurityCardData;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-14 md:px-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{t("eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900 dark:text-foreground md:text-5xl">
          {t("titlePrefix")} <span className="text-gradient">{t("titleHighlight")}</span>
        </h1>
        <p className="mt-3 text-xl font-semibold text-slate-700 dark:text-slate-200">{t("subtitle")}</p>
        <p className="mt-3 text-base leading-relaxed text-slate-800 dark:text-slate-200">{t("description")}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t("disclaimer")}</p>
      </motion.div>

      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }} className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {trustBadges.map((badge, index) => {
          const Icon = iconMap[badge.icon];
          const accent = trustBadgeAccents[index % trustBadgeAccents.length];
          const accentStyle = accentStyles[accent];
          return (
            <motion.div key={badge.label} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } }} className="h-full">
              <div
                className={cn(
                  "tb-card flex h-full flex-col rounded-2xl border border-slate-200/50 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-transparent dark:bg-white/[0.05] dark:shadow-none",
                  marketingCardInteractiveClass,
                  marketingCardHoverLiftClass
                )}
                style={getMarketingCardHoverStyle(accentStyle.rgb)}
              >
                <div className={marketingCardTintOverlayClass} />
                <div className={marketingCardSheenOverlayClass} />
                <div className={cn(`tb-icon mb-3 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${accentStyle.iconGradient} shadow-lg`, marketingCardIconMotionClass)}>
                  <Icon className="size-4.5 text-white" />
                </div>
                <div className="relative min-h-[6.5rem]">
                  <p className={cn("text-sm font-extrabold tracking-tight text-slate-900 dark:text-white", marketingCardTitleClass)}>{badge.label}</p>
                  <p className={cn("mt-1 text-[12px] text-slate-500 dark:text-slate-400/70", marketingCardCopyClass)}>{badge.desc}</p>
                </div>
                <div className="mt-auto pt-4">
                  <div className="h-px w-14 rounded-full opacity-45 transition-all duration-300 group-hover:w-20" style={{ background: accentStyle.ruleGradient }} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }} className="mt-12 grid gap-5 md:grid-cols-2">
        {sections.map((section) => (
          <motion.div key={section.title} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } }} className="h-full">
            <Card {...section} />
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-5">
        <Card {...dataNotes} />
      </motion.div>
    </div>
  );
}
