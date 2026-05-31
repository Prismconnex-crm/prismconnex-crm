"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

type Highlight = { text: string; accent: string; accentBorder: string };

function HighlightCard({ text, accent, accentBorder }: Highlight) {
  return (
    <div
      className="fh-card group relative flex h-full min-w-[240px] snap-start items-start gap-2.5 overflow-hidden rounded-2xl border border-slate-200/50 bg-white/80 p-4 shadow-sm backdrop-blur-xl transition-all duration-[250ms] ease-out hover:-translate-y-1 hover:scale-[1.01] dark:border-white/[0.08] dark:bg-white/[0.05] dark:shadow-none"
      style={{
        ['--fh-hover-bg-light' as string]: `${accentBorder}0.06)`,
        ['--fh-hover-bg-dark' as string]: `${accent}0.10)`,
        ['--fh-hover-shadow-light' as string]: `0 8px 30px ${accentBorder}0.12), 0 0 0 1px ${accentBorder}0.08)`,
        ['--fh-hover-shadow-dark' as string]: `0 8px 30px ${accent}0.15), 0 0 0 1px ${accent}0.10)`,
      }}
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
      <span className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{text}</span>
    </div>
  );
}

export function FeatureHighlightsRow() {
  const t = useTranslations("marketing.pricing.highlights");
  const highlights = t.raw("items") as Highlight[];
  const lastY = useRef(0);
  const [scrollDir, setScrollDir] = useState<"down" | "up" | "idle">("idle");
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const delta = latest - lastY.current;
    if (delta > 2) setScrollDir("down");
    else if (delta < -2) setScrollDir("up");
    else setScrollDir("idle");
    lastY.current = latest;
  });

  const getShift = (index: number) => (scrollDir === "down" ? -(6 + index * 6) : 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-10">
      <div className="rounded-2xl border border-slate-200/50 bg-white/60 p-6 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.03] md:p-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-foreground">{t("title")}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((highlight, index) => (
            <motion.div key={highlight.text} animate={{ x: getShift(index) }} transition={{ type: "spring", stiffness: 180, damping: 24 }}>
              <HighlightCard {...highlight} />
            </motion.div>
          ))}
        </div>

        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-none sm:hidden snap-x snap-mandatory">
          {highlights.map((highlight) => (
            <HighlightCard key={highlight.text} {...highlight} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
