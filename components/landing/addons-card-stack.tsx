"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, Users } from "lucide-react";
import { useTranslations } from "next-intl";

const iconMap = { sparkles: Sparkles, zap: Zap, users: Users } as const;

type AddOn = {
  name: string;
  desc: string;
  icon: keyof typeof iconMap;
  gradient: string;
  tint: string;
};

export function AddonsCardStack() {
  const t = useTranslations("marketing.pricing.addons");
  const addOns = t.raw("items") as AddOn[];
  const [order, setOrder] = useState([0, 1, 2]);

  const handleClick = useCallback(() => {
    setOrder((previous) => {
      const next = [...previous];
      const front = next.shift();
      if (front !== undefined) next.push(front);
      return next;
    });
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-14">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-foreground">{t("title")}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-muted-foreground">{t("description")}</p>
        </div>
        <p className="text-xs italic text-slate-400 dark:text-slate-500">{t("hint")}</p>
      </div>

      <div className="relative mx-auto w-full cursor-pointer select-none" style={{ height: 280 }} onClick={handleClick}>
        <AnimatePresence mode="popLayout">
          {order.map((cardIndex, stackPos) => {
            const card = addOns[cardIndex];
            const Icon = iconMap[card.icon];
            const isTop = stackPos === 0;
            const yOffset = stackPos * -14;
            const xOffset = stackPos * 10;
            const scale = 1 - stackPos * 0.04;
            const zIndex = 3 - stackPos;
            const rotate = stackPos === 0 ? 0 : stackPos === 1 ? -1.5 : 1.2;
            const shadow = isTop ? `0 20px 50px ${card.tint}0.18), 0 8px 20px rgba(0,0,0,0.08)` : "0 8px 20px rgba(0,0,0,0.06)";

            return (
              <motion.div
                key={card.name}
                layout
                initial={{ opacity: 0, y: 60, scale: 0.9, rotateZ: 5 }}
                animate={{ y: yOffset, x: xOffset, scale, rotateZ: rotate, opacity: 1, zIndex }}
                exit={{ y: -180, x: -40, scale: 0.85, rotateZ: -8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.8 }}
                className="absolute inset-x-0 mx-auto w-full max-w-lg"
                style={{ zIndex, transformOrigin: "bottom center", filter: isTop ? "none" : `brightness(${1 - stackPos * 0.06})` }}
              >
                <div className={`relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 p-6 backdrop-blur-xl transition-all duration-300 dark:border-white/[0.08] dark:bg-white/[0.06] ${isTop ? "ring-1 ring-indigo-500/10 dark:ring-white/[0.06]" : ""}`} style={{ boxShadow: shadow }}>
                  {isTop ? <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-40 dark:opacity-30" style={{ background: `radial-gradient(ellipse at 20% 30%, ${card.tint}0.08) 0%, transparent 70%)` }} /> : null}
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-px transition-opacity duration-300" style={{ opacity: isTop ? 0.6 : 0.15, background: `linear-gradient(to bottom, transparent, ${card.tint}0.20), ${card.tint}0.50), ${card.tint}0.20), transparent)` }} />
                  <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full transition-opacity duration-300" style={{ opacity: isTop ? 0.6 : 0.15, background: `linear-gradient(to right, transparent, ${card.tint}0.20), ${card.tint}0.50), ${card.tint}0.20), transparent)` }} />
                  <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-slate-300/20 via-transparent to-transparent dark:from-white/[0.06]" />
                  <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-slate-300/20 via-transparent to-transparent dark:from-white/[0.06]" />

                  <div className="relative flex items-start gap-4">
                    <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                      <Icon className="size-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{card.name}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{card.desc}</p>
                    </div>
                  </div>

                  {isTop ? (
                    <div className="mt-5 flex items-center gap-2">
                      <div className="h-0.5 flex-1 rounded-full opacity-30" style={{ background: `linear-gradient(to right, ${card.tint}0.50), transparent)` }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t("badge")}</span>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
