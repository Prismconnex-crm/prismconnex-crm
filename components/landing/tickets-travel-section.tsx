"use client";

import { motion } from "framer-motion";
import { Ticket, Hotel, Plane, Train, Globe, MapPin, Sparkles, CheckCircle2 } from "lucide-react";
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
  cyan: { rgb: "6, 182, 212", iconGradient: "from-cyan-500 to-sky-600", borderR_dark: "linear-gradient(to bottom, transparent, rgba(34,211,238,0.12), rgba(34,211,238,0.45), rgba(34,211,238,0.12), transparent)", borderB_dark: "linear-gradient(to right, transparent, rgba(34,211,238,0.12), rgba(34,211,238,0.45), rgba(34,211,238,0.12), transparent)", borderR_light: "linear-gradient(to bottom, transparent, rgba(6,182,212,0.08), rgba(6,182,212,0.30), rgba(6,182,212,0.08), transparent)", borderB_light: "linear-gradient(to right, transparent, rgba(6,182,212,0.08), rgba(6,182,212,0.30), rgba(6,182,212,0.08), transparent)" },
  emerald: { rgb: "16, 185, 129", iconGradient: "from-emerald-500 to-teal-600", borderR_dark: "linear-gradient(to bottom, transparent, rgba(52,211,153,0.12), rgba(52,211,153,0.45), rgba(52,211,153,0.12), transparent)", borderB_dark: "linear-gradient(to right, transparent, rgba(52,211,153,0.12), rgba(52,211,153,0.45), rgba(52,211,153,0.12), transparent)", borderR_light: "linear-gradient(to bottom, transparent, rgba(16,185,129,0.08), rgba(16,185,129,0.30), rgba(16,185,129,0.08), transparent)", borderB_light: "linear-gradient(to right, transparent, rgba(16,185,129,0.08), rgba(16,185,129,0.30), rgba(16,185,129,0.08), transparent)" },
  amber: { rgb: "245, 158, 11", iconGradient: "from-amber-500 to-orange-600", borderR_dark: "linear-gradient(to bottom, transparent, rgba(245,158,11,0.12), rgba(245,158,11,0.45), rgba(245,158,11,0.12), transparent)", borderB_dark: "linear-gradient(to right, transparent, rgba(245,158,11,0.12), rgba(245,158,11,0.45), rgba(245,158,11,0.12), transparent)", borderR_light: "linear-gradient(to bottom, transparent, rgba(245,158,11,0.08), rgba(245,158,11,0.30), rgba(245,158,11,0.08), transparent)", borderB_light: "linear-gradient(to right, transparent, rgba(245,158,11,0.08), rgba(245,158,11,0.30), rgba(245,158,11,0.08), transparent)" },
} as const;

const iconMap = { ticket: Ticket, pin: MapPin, globe: Globe } as const;
const previewIconMap = { hotel: Hotel, plane: Plane, train: Train } as const;

type Accent = keyof typeof accentMap;
type TravelCard = { icon: keyof typeof iconMap; title: string; bullets: string[]; accent: Accent };

function Card({ icon, title, bullets, accent }: TravelCard) {
  const accentStyles = accentMap[accent];
  const Icon = iconMap[icon];

  return (
    <div
      className={cn(
        "fg-card flex h-full cursor-default flex-col rounded-2xl border border-slate-200/50 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-transparent dark:bg-white/[0.05] dark:shadow-none",
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
      <div className="relative mb-4">
        <div className={cn("fg-pulse absolute inset-0 m-auto size-14 rounded-xl", marketingCardPulseClass)} style={{ background: "radial-gradient(circle, rgba(var(--marketing-card-accent), 0.16) 0%, transparent 70%)" }} />
        <div className={cn(`fg-icon relative flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${accentStyles.iconGradient} shadow-lg`, marketingCardIconMotionClass)}>
          <Icon className="size-5 text-white" />
        </div>
      </div>

      <div className="relative flex min-h-[8.5rem] flex-1 flex-col">
        <h3 className={cn("text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white", marketingCardTitleClass)}>{title}</h3>
        <ul className="mt-3 flex-1 space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <span className={cn("text-[12px] text-slate-500 dark:text-slate-400/70", marketingCardCopyClass)}>{bullet}</span>
          </li>
        ))}
        </ul>
      </div>
    </div>
  );
}

function TravelerPreview() {
  const t = useTranslations("marketing.home.travel.preview");
  const items = t.raw("nearby") as Array<{ icon: keyof typeof previewIconMap; label: string; detail: string }>;

  return (
    <div className="rounded-2xl border border-slate-200/50 bg-white/60 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.03]">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
          <Sparkles className="size-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{t("eventName")}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("eventMeta")}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button disabled className="flex-1 cursor-not-allowed rounded-lg bg-indigo-600/20 py-2 text-[11px] font-semibold text-indigo-600 opacity-60 dark:bg-indigo-500/15 dark:text-indigo-400">{t("buyTicket")}</button>
        <button disabled className="flex-1 cursor-not-allowed rounded-lg border border-amber-500/30 bg-amber-500/10 py-2 text-[11px] font-semibold text-amber-600 opacity-60 dark:text-amber-400">{t("applyPromo")}</button>
      </div>

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t("nearbyTitle")}</p>
      <div className="space-y-1.5">
        {items.map((item) => {
          const Icon = previewIconMap[item.icon];
          return (
            <div key={item.label} className="flex items-center gap-2.5 rounded-lg bg-slate-100/60 px-3 py-2 dark:bg-white/[0.04]">
              <Icon className="size-3.5 text-slate-400 dark:text-slate-500" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
              <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">{item.detail}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[9px] leading-relaxed text-slate-400 dark:text-slate-500">{t("disclaimer")}</p>
    </div>
  );
}

export function TicketsTravelSection() {
  const t = useTranslations("marketing.home.travel");
  const cards = t.raw("cards") as TravelCard[];

  return (
    <section className="relative py-14 md:py-20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent dark:via-white/[0.06]" />
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground md:text-4xl lg:text-5xl">
            {t("titlePrefix")} <span className="text-gradient">{t("titleHighlight")}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-500 dark:text-muted-foreground md:text-lg">{t("description")}</p>
        </motion.div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {cards.map((card) => (
              <motion.div key={card.title} variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } } }} className="h-full">
                <Card {...card} />
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >
            <div className="sticky top-28">
              <TravelerPreview />
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-8 lg:hidden"
        >
          <TravelerPreview />
        </motion.div>
      </div>
    </section>
  );
}
