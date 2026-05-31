"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Building2,
  Users,
  Mail,
  Bot,
  BarChart3,
  Shield,
  Cable,
  Zap,
  Database,
  MessageSquare,
  MapPin,
} from "lucide-react";
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
  indigo: { rgb: "99, 102, 241", iconGradient: "from-indigo-500 to-purple-600" },
  emerald: { rgb: "16, 185, 129", iconGradient: "from-emerald-500 to-teal-600" },
  amber: { rgb: "245, 158, 11", iconGradient: "from-amber-500 to-orange-600" },
  pink: { rgb: "236, 72, 153", iconGradient: "from-pink-500 to-rose-600" },
  cyan: { rgb: "6, 182, 212", iconGradient: "from-cyan-500 to-sky-600" },
  violet: { rgb: "139, 92, 246", iconGradient: "from-violet-500 to-fuchsia-600" },
  lime: { rgb: "132, 204, 22", iconGradient: "from-lime-500 to-green-600" },
  red: { rgb: "239, 68, 68", iconGradient: "from-red-500 to-orange-600" },
  yellow: { rgb: "234, 179, 8", iconGradient: "from-yellow-500 to-amber-600" },
} as const;

const iconMap = {
  calendar: Calendar,
  building: Building2,
  users: Users,
  mail: Mail,
  bot: Bot,
  chart: BarChart3,
  cable: Cable,
  shield: Shield,
  zap: Zap,
  database: Database,
  chat: MessageSquare,
  map: MapPin,
} as const;

type Accent = keyof typeof accentMap;
type Card = { icon: keyof typeof iconMap; title: string; desc: string; accent: Accent };

function ProductFeatureCard({ icon, title, desc, accent }: Card) {
  const Icon = iconMap[icon];
  const style = accentMap[accent];

  return (
    <div
      className={cn(
        "pf-card flex h-full cursor-default flex-col rounded-2xl border border-slate-200/50 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-transparent dark:bg-white/[0.07] dark:shadow-none",
        marketingCardInteractiveClass,
        marketingCardHoverLiftClass
      )}
      style={getMarketingCardHoverStyle(style.rgb)}
    >
      <div className={marketingCardTintOverlayClass} />
      <div className={marketingCardSheenOverlayClass} />
      <div className={`pf-icon relative mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${style.iconGradient} shadow-lg hover:brightness-110 ${marketingCardIconMotionClass}`}>
        <Icon className="size-5 text-white" />
      </div>
      <div className="relative flex min-h-[9rem] flex-1 flex-col">
        <h3 className={cn("text-base font-extrabold tracking-tight text-slate-900 dark:text-white md:text-lg", marketingCardTitleClass)}>{title}</h3>
        <p className={cn("mt-2 text-[13px] text-slate-500 dark:text-slate-400/70", marketingCardCopyClass)}>{desc}</p>
      </div>
    </div>
  );
}

export default function ProductPage() {
  const t = useTranslations("marketing.product");
  const sections = t.raw("sections") as Card[];
  const coreSolutions = t.raw("coreSolutions.items") as Card[];

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-14 md:px-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{t("eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900 dark:text-foreground md:text-5xl">
          {t("titlePrefix")} <span className="text-gradient">{t("titleHighlight")}</span>
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-700 dark:text-slate-300">{t("description")}</p>
      </motion.div>

      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }} className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <motion.div key={section.title} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } }} className="h-full">
            <ProductFeatureCard {...section} />
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.5 }} className="mt-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t("coreSolutions.eyebrow")}</span>
        <h2 className="mt-4 text-3xl font-bold text-slate-900 dark:text-foreground md:text-4xl">
          {t("coreSolutions.titlePrefix")} <span className="text-gradient">{t("coreSolutions.titleHighlight")}</span>
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-500 dark:text-muted-foreground">{t("coreSolutions.description")}</p>
      </motion.div>

      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }} className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {coreSolutions.map((solution) => (
          <motion.div key={solution.title} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } }} className="h-full">
            <ProductFeatureCard {...solution} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
