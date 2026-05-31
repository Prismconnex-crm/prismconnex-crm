"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FeatureHighlightsRow } from "@/components/landing/feature-highlights-row";
import { AddonsCardStack } from "@/components/landing/addons-card-stack";
import {
  getMarketingCardHoverStyle,
  marketingCardCopyClass,
  marketingCardHoverLiftClass,
  marketingCardInteractiveClass,
  marketingCardSheenOverlayClass,
  marketingCardTintOverlayClass,
  marketingCardTitleClass,
} from "@/components/landing/marketing-card-hover";

type Accent = "cyan" | "emerald" | "violet" | "amber";

type Plan = {
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  accent: Accent;
};

const accentMap = {
  cyan: { rgb: "6, 182, 212", checkColor: "text-cyan-500 dark:text-cyan-400" },
  emerald: { rgb: "16, 185, 129", checkColor: "text-emerald-500 dark:text-emerald-400" },
  violet: { rgb: "139, 92, 246", checkColor: "text-violet-500 dark:text-violet-400" },
  amber: { rgb: "245, 158, 11", checkColor: "text-amber-500 dark:text-amber-400" },
} as const;

function PricingCard({ name, price, period, desc, features, cta, accent }: Plan) {
  const style = accentMap[accent];

  return (
    <div
      className={cn(
        "pr-card flex h-full cursor-default flex-col rounded-2xl border border-slate-200/50 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-transparent dark:bg-white/[0.05] dark:shadow-none",
        marketingCardInteractiveClass,
        marketingCardHoverLiftClass
      )}
      style={getMarketingCardHoverStyle(style.rgb)}
    >
      <div className={marketingCardTintOverlayClass} />
      <div className={marketingCardSheenOverlayClass} />
      <div className="relative min-h-[7rem]">
        <h3 className={cn("text-lg font-extrabold tracking-tight text-slate-900 dark:text-white", marketingCardTitleClass)}>{name}</h3>
        <div className="mt-3">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">{price}</span>
          <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">{period}</span>
        </div>
        <p className={cn("mt-2 text-[13px] text-slate-500 dark:text-slate-400/70", marketingCardCopyClass)}>{desc}</p>
      </div>

      <div className="my-5 h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent dark:via-white/[0.06]" />

      <ul className="relative flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-[13px] text-slate-600 dark:text-slate-300/80">
            <div
              className="pr-check-badge relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br opacity-90 transition-all duration-300 group-hover:animate-[float_1.2s_ease-in-out_infinite] group-hover:opacity-100 group-hover:shadow-[0_8px_18px_rgba(var(--marketing-card-accent),0.22)] dark:group-hover:shadow-[0_10px_24px_rgba(var(--marketing-card-accent),0.28)]"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))" }}
            >
              <CheckCircle2 className={`size-3.5 ${style.checkColor} transition-all duration-300`} />
            </div>
            <span className={marketingCardCopyClass}>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="relative mt-6">
        <Link href="/auth/sign-in" className="block">
          <Button className="w-full gap-1.5">
            {cta}
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-200/60 dark:border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-slate-900 transition-colors hover:text-indigo-600 dark:text-foreground dark:hover:text-accent"
      >
        {question}
        <ChevronDown className={`size-4 text-slate-400 transition-transform duration-300 dark:text-muted-foreground ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <p className="pb-4 text-sm leading-relaxed text-slate-500 dark:text-muted-foreground">{answer}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function PricingPage() {
  const t = useTranslations("marketing.pricing");
  const plans = t.raw("plans") as Plan[];
  const faq = t.raw("faq.items") as Array<{ question: string; answer: string }>;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-14 md:px-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{t("eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900 dark:text-foreground md:text-5xl">
          {t("titlePrefix")} <span className="text-gradient">{t("titleHighlight")}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-700 dark:text-slate-300">{t("description")}</p>
      </motion.div>

      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }} className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <motion.div key={plan.name} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } }} className="h-full">
            <PricingCard {...plan} />
          </motion.div>
        ))}
      </motion.div>

      <FeatureHighlightsRow />
      <AddonsCardStack />

      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-14">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-foreground">{t("faq.title")}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-muted-foreground">{t("faq.description")}</p>
        <div className="mt-6 rounded-2xl border border-slate-200/50 bg-white/60 p-6 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.03]">
          {faq.map((item) => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
