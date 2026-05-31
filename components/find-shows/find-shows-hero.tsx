'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';

type StatItem = {
  value: number;
  suffix?: string;
  label: string;
};



function CountUpStat({ value, suffix, label }: StatItem) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) {
      return;
    }

    const duration = 900;
    const start = performance.now();

    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplayValue(Math.round(value * progress));

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    requestAnimationFrame(frame);
  }, [started, value]);

  return (
    <div
      ref={ref}
      className="glass-card rounded-2xl px-4 py-4 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
    >
      <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
        {displayValue}
        {suffix}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}

export function FindShowsHero({
  searchQuery,
  onSearchQueryChange,
  stats,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  stats: StatItem[];
}) {
  return (
    <section className="relative overflow-hidden px-5 pb-10 pt-10 md:px-8 md:pb-14 md:pt-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_34%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.14),transparent_34%)]" />
        <div className="absolute left-[8%] top-6 h-44 w-44 rounded-full bg-indigo-500/18 blur-3xl" />
        <div className="absolute right-[10%] top-12 h-48 w-48 rounded-full bg-cyan-500/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-500 dark:text-indigo-300">
            <Sparkles className="size-3.5" />
            Worldwide trade show catalog
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
            <span className="text-gradient-hero block">Discover Trade Shows</span>
            <span className="text-gradient-hero block mt-1 md:mt-2">Shaping the Future of</span>
            <span className="text-gradient-hero block mt-1 md:mt-2">Industries Worldwide</span>
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-300 md:text-lg">
            Explore verified exhibitions across the globe, compare categories, plan your
            calendar, and focus on the shows that matter most for Prism Connex users.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="mx-auto mt-8 max-w-3xl"
        >
          <div className="group relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/88 p-2 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-300 focus-within:border-indigo-400/70 focus-within:shadow-[0_30px_80px_rgba(79,70,229,0.18)] dark:border-white/[0.08] dark:bg-[#0f1729]/88 dark:shadow-[0_24px_70px_rgba(0,0,0,0.38)] dark:focus-within:border-indigo-400/40 dark:focus-within:shadow-[0_26px_80px_rgba(79,70,229,0.2)]">
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100">
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,102,241,0.08),transparent_42%,rgba(6,182,212,0.08))]" />
            </div>
            <div className="relative flex items-center gap-3 rounded-[22px] px-4 py-3 md:px-5">
              <Search className="size-5 shrink-0 text-slate-400 dark:text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search by event name, industry, or city..."
                aria-label="Search trade shows by name, industry, or city"
                className="h-auto border-0 bg-transparent px-0 py-0 text-base shadow-none ring-0 focus:border-0 focus:ring-0 md:text-lg"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="mx-auto mt-8 grid max-w-5xl gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {stats.map((stat) => (
            <CountUpStat
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
